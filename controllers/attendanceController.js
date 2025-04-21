const Attendance = require("../models/Attendance");
const FaceScanLog = require("../models/FaceScanLog");
const CheckinSession = require("../models/CheckinSession");
const User = require("../models/User");

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

exports.checkIn = async (req, res) => {
  try {
    const { studentId, fullName, latitude, longitude, sessionId, locationName } = req.body;

    const missingFields = [];
    if (!studentId) missingFields.push("studentId");
    if (!fullName) missingFields.push("fullName");
    if (!latitude) missingFields.push("latitude");
    if (!longitude) missingFields.push("longitude");
    if (!sessionId) missingFields.push("sessionId");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "ข้อมูลไม่ครบ",
        missing: missingFields,
      });
    }

    const now = new Date();
    const session = await CheckinSession.findById(sessionId).populate({
      path: "classId",
      populate: { path: "teacherId", select: "fullName" },
    });

    if (!session) {
      return res.status(404).json({ message: "ไม่พบ session นี้" });
    }

    if (
      session.status !== "active" ||
      now < session.openAt ||
      now > session.closeAt
    ) {
      return res.status(403).json({ message: "หมดเวลาเช็คชื่อแล้ว" });
    }

    if (session.location?.latitude && session.location?.longitude) {
      const distance = getDistanceInMeters(
        session.location.latitude,
        session.location.longitude,
        latitude,
        longitude
      );

      if (distance > session.location.radiusInMeters) {
        return res.status(403).json({
          message: `คุณอยู่นอกพื้นที่เช็คชื่อ (${Math.round(distance)} เมตร)`,
          distance,
          allowedRadius: session.location.radiusInMeters,
        });
      }
    }

    const user = await User.findOne({ studentId: String(studentId).trim() });
    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้ในระบบ" });
    }

    const duplicate = await Attendance.findOne({
      studentId: studentId,
      sessionId,
    });
    if (duplicate) {
      return res.status(409).json({ message: "คุณเช็คชื่อในรอบนี้ไปแล้ว" });
    }

    const status = now <= session.closeAt ? "Present" : "Late";

    await Attendance.create({
      studentId: studentId,
      fullName,
      classId: session.classId._id,
      courseCode: session.classId.courseCode,
      courseName: session.classId.courseName,
      section: session.classId.section,
      sessionId: session._id,
      status,
      location_data: {
        latitude,
        longitude,
        name: locationName || session.location?.name || null,
      },
      scan_time: now,
      withTeacherFace: session.withTeacherFace || false,
      withMapPreview: session.withMapPreview || false,
      teacherName: session.classId.teacherId?.fullName || "ไม่ทราบชื่ออาจารย์",
    });

    await FaceScanLog.create({
      userId: user._id,
      classId: session.classId._id,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      location: {
        lat: latitude,
        lng: longitude,
        name: locationName || session.location?.name || null,
      },
      status: "success",
    });

    res.json({ message: "เช็คชื่อสำเร็จ", status });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.getHistoryByStudent = async (req, res) => {
  try {
    const studentId = String(req.params.studentId).trim();
    const history = await Attendance.find({ studentId })
      .sort({ scan_time: -1 })
      .populate("classId", "courseCode courseName section");

    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: "ไม่สามารถดึงข้อมูลประวัติได้", error: err.message });
  }
};

exports.getAllFaceScanLogs = async (req, res) => {
  try {
    const logs = await FaceScanLog.find()
      .populate("userId", "fullName username")
      .populate("classId", "courseName courseCode");

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "ไม่สามารถโหลดข้อมูลได้", error: err.message });
  }
};

exports.getAttendanceByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const records = await Attendance.find({ classId });

    const summary = {};
    for (const rec of records) {
      const sid = String(rec.studentId).trim();
      if (!summary[sid]) {
        summary[sid] = {
          studentId: sid,
          fullName: rec.fullName,
          present: 0,
          late: 0,
          absent: 0,
        };
      }

      if (rec.status === "Present") summary[sid].present++;
      else if (rec.status === "Late") summary[sid].late++;
      else if (rec.status === "Absent") summary[sid].absent++;
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({
      message: "โหลดข้อมูลการเช็คชื่อไม่สำเร็จ",
      error: err.message,
    });
  }
};

exports.getAttendanceByClassRaw = async (req, res) => {
  try {
    const { classId } = req.params;
    const records = await Attendance.find({ classId });
    res.json(records);
  } catch (err) {
    res.status(500).json({
      message: "โหลดข้อมูลการเช็คชื่อล้มเหลว",
      error: err.message,
    });
  }
};

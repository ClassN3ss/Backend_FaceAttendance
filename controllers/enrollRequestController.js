const mongoose = require("mongoose");
const EnrollRequest = require("../models/EnrollmentRequest");
const Enroll = require("../models/Enroll");
const Class = require("../models/Class");

exports.createRequest = async (req, res) => {
  try {
    const { student, classId } = req.body;
    const exists = await EnrollRequest.findOne({ student, classId });
    if (exists) return res.status(400).json({ message: "ส่งคำขอซ้ำไม่ได้" });

    const cls = await Class.findById(classId);
    const now = new Date();
    const request = new EnrollRequest({
      student,
      classId,
      subjectCode: cls.courseCode,
      section: cls.section,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
    });
    await request.save();
    res.status(201).json({ message: "ส่งคำขอเข้าร่วมคลาสสำเร็จ", request });
  } catch (error) {
    res.status(500).json({ message: "ไม่สามารถส่งคำขอได้", error: error.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await EnrollRequest.find()
      .populate("student", "fullName studentId")
      .populate("classId", "courseCode courseName section");
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "โหลดคำขอไม่สำเร็จ", error: error.message });
  }
};

exports.getStudentRequests = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const requests = await EnrollRequest.find({ student: studentId })
      .populate("classId", "courseCode section");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "ไม่สามารถดึงคำร้อง", error: err.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    console.log("approving id:", req.params.id);
    const request = await EnrollRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "ไม่พบคำขอ" });

    const already = await Enroll.findOne({ student: request.student, classId: request.classId });
    if (already) {
      await request.deleteOne();
      return res.status(409).json({ message: "มีรายชื่อนักเรียนในคลาสนี้อยู่แล้ว" });
    }

    const now = new Date();
    await Enroll.create({ 
      student: request.student, 
      classId: request.classId, 
      approved: true,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8), 
    });

    await Class.findByIdAndUpdate(request.classId, { $addToSet: { students: request.student } });
    await request.deleteOne();

    res.json({ message: "อนุมัติเข้าคลาสแล้ว" });
  } catch (error) {
    console.error("ERROR Approve:", error);
    res.status(500).json({ message: "ไม่สามารถอนุมัติได้", error: error.message });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    await EnrollRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "ลบคำขอแล้ว" });
  } catch (error) {
    res.status(500).json({ message: "ลบคำขอไม่สำเร็จ", error: error.message });
  }
};

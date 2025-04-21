const xlsx = require("xlsx");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Class = require("../models/Class");
const Enroll = require("../models/Enroll");
const Attendance = require("../models/Attendance");
const FaceScanLog = require("../models/FaceScanLog");
const EnrollmentRequest = require("../models/EnrollmentRequest");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

function cleanName(raw) {
  return raw
    .replace(/\b(ศ\.|รศ\.|ผศ\.|อ\.|ดร\.|อาจารย์|ศาสตราจารย์|รองศาสตราจารย์|ผู้ช่วยศาสตราจารย์|ผู้สอน)\b\s*/g, '')
    .trim();
}

function removeSectionFromCourseName(name) {
  return name.replace(/ตอน\s*\d+/g, '').trim();
}

exports.createClass = [
  upload.single("file"),
  async (req, res) => {
    try {
      const { email, section } = req.body;
      const file = req.file;

      if (!file || !email) {
        return res.status(400).json({ message: "กรุณาแนบไฟล์และอีเมลอาจารย์" });
      }

      const { classDoc, newTeacherCreated } = await createClassFromXlsx(file.buffer, email, section || "1");

      const message = newTeacherCreated
        ? ` สร้างคลาสและเพิ่มอาจารย์ใหม่ (${email}) สำเร็จ`
        : ` สร้างคลาสสำเร็จ`;

      res.json({ message, classId: classDoc._id });
    } catch (err) {
      res.status(500).json({ message: err.message || "เกิดข้อผิดพลาด" });
    }
  }
];

async function createClassFromXlsx(buffer, email, section) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const courseRow = rows.find(r => r?.[0]?.toString().includes("วิชา"));
  const teacherRow = rows.find(r => r?.[5]?.toString().includes("ผู้สอน"));
  if (!courseRow || !teacherRow) throw new Error("ไม่พบข้อมูลวิชา หรือ ผู้สอนในไฟล์");

  const courseParts = courseRow[0].split(/\s+/);
  const courseCode = courseParts[1];
  let courseName = courseParts.slice(2).join(" ");
  courseName = removeSectionFromCourseName(courseName);

  const sectionStr = String(section || "1");
  const teacherName = cleanName(teacherRow[5]);

  let teacher = await User.findOne({ fullName: teacherName.trim(), role: "teacher" });
  let newTeacherCreated = false;

  if (!teacher) {
    const hashed = await bcrypt.hash("teacher123", 10);
    teacher = await User.create({
      username: email.trim(),
      fullName: teacherName.trim(),
      email: email.trim(),
      password_hash: hashed,
      role: "teacher"
    });
    newTeacherCreated = true;
  } else {
    if (teacher.email !== email.trim()) {
      teacher.email = email.trim();
      teacher.username = email.trim();
      await teacher.save();
    }
  }

  // ✅ ค้นหา index ของ header ก่อน
  const headerRowIndex = rows.findIndex(row =>
    row.includes("ลำดับ") && row.includes("รหัสนักศึกษา") && row.includes("ชื่อ - สกุล")
  );

  if (headerRowIndex === -1) throw new Error("ไม่พบหัวตาราง 'ลำดับ', 'รหัสนักศึกษา', 'ชื่อ - สกุล'");

  const students = [];
  const seen = new Set();

  let hasData = false;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const studentId = row[1]?.toString().trim();
    const fullName = row[2]?.toString().trim();

    const bothEmpty = (!studentId || studentId === "") && (!fullName || fullName === "");

    if (i === headerRowIndex + 1 && bothEmpty) {
      throw new Error(`แถวแรกหลัง header ว่างเปล่า กรุณาอัปโหลดไฟล์ใหม่`);
    }

    if (bothEmpty) {
      // ตรวจดูแถวถัดไปทั้งหมดจนสุดว่ามีข้อมูลไหม
      const restHasData = rows.slice(i + 1, 100).some(r => {
        const sid = r[1]?.toString().trim();
        const name = r[2]?.toString().trim();
        return sid || name;
      });
      if (!restHasData) break; // ✅ จบ loop อย่างปลอดภัย
      else continue;
    }

    if (!studentId || !fullName) {
      throw new Error(`ข้อมูลไม่ครบในแถวที่ ${i + 1} กรุณาอัปโหลดไฟล์ใหม่`);
    }

    if (seen.has(studentId)) continue;
    seen.add(studentId);

    const studentEmail = `s${studentId}@email.kmutnb.ac.th`;
    let user = await User.findOne({ studentId });

    if (!user) {
      const hashed = await bcrypt.hash(studentId, 10);
      user = await User.create({
        studentId,
        username: studentId,
        fullName,
        email: studentEmail,
        password_hash: hashed,
        role: "student"
      });
    } else {
      if (user.fullName !== fullName) {
        user.fullName = fullName;
        await user.save();
      }
    }

    students.push(user._id);
    hasData = true;
  }

  if (!hasData || students.length === 0) throw new Error("ไม่พบนักศึกษาในไฟล์");

  let classDoc = await Class.findOne({ courseCode, section: sectionStr });
  if (classDoc) {
    classDoc.courseName = courseName;
    classDoc.teacherId = teacher._id;
    classDoc.students = students;
    await classDoc.save();
  } else {
    classDoc = await Class.create({
      courseCode,
      courseName,
      section: sectionStr,
      teacherId: teacher._id,
      students
    });
  }

  return { classDoc, newTeacherCreated };
}

exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("teacherId", "fullName email")
      .populate("students", "fullName email username");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "ดึงข้อมูลคลาสล้มเหลว", error: err.message });
  }
};

exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("teacherId", "fullName email")
      .populate("students", "fullName studentId email");

    if (!cls) return res.status(404).json({ message: "ไม่พบคลาสนี้" });
    res.json(cls);
  } catch (err) {
    res.status(500).json({ message: "โหลดคลาสล้มเหลว", error: err.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const deleted = await Class.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "ไม่พบคลาส" });

    await Enroll.deleteMany({ classId: req.params.id });
    await Attendance.deleteMany({ classId: req.params.id });
    await FaceScanLog.deleteMany({ classId: req.params.id });
    await EnrollmentRequest.deleteMany({ classId: req.params.id });

    res.json({ message: "ลบคลาสแล้ว และลบการลงทะเบียนของคลาสนี้เรียบร้อย" });
  } catch (err) {
    res.status(500).json({ message: "ลบคลาสล้มเหลว", error: err.message });
  }
};

exports.getClassesByStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const classes = await Class.find({ students: studentId })
      .populate("teacherId", "fullName")
      .populate("students", "fullName email username")
      .select("courseCode courseName section");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "โหลดคลาสของนักศึกษาล้มเหลว", error: err.message });
  }
};

exports.getClassesByTeacher = async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user._id });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "โหลดคลาสของอาจารย์ล้มเหลว", error: err.message });
  }
};

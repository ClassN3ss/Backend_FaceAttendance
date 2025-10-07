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
    .replace(/ผู้สอน/g, '')
    .trim();
}

function removeSectionFromCourseName(name) {
  return name.replace(/ตอน\s*\d+/g, '').trim();
}

// ✅ สร้างคลาสจากไฟล์ Excel
exports.createClass = [
  upload.single("file"),
  async (req, res) => {
    try {
      const { email, section } = req.body;
      const file = req.file;

      if (!file || !email) {
        return res.status(400).json({ message: "❌ กรุณาแนบไฟล์และอีเมลอาจารย์" });
      }

      const { classDoc, newTeacherCreated } = await createClassFromXlsx(file.buffer, email, section || "1");

      const message = newTeacherCreated
        ? `✅ สร้างคลาสและเพิ่มอาจารย์ใหม่ (${email}) สำเร็จ`
        : `✅ สร้างคลาสสำเร็จ`;

      res.json({ message, classId: classDoc._id });
    } catch (err) {
      res.status(500).json({ message: err.message || "❌ เกิดข้อผิดพลาด" });
    }
  }
];

// ✅ Internal: อ่านข้อมูลจากไฟล์ Excel และสร้างคลาส
async function createClassFromXlsx(buffer, email) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const headerRow = rows[6];
  if (!headerRow || !headerRow[1]?.toString().includes("เลข") || !headerRow[2]?.toString().includes("ชื่อ")) {
    throw new Error(`❌ รูปแบบไฟล์ไม่ถูกต้อง: ไม่พบหัวคอลัมน์ "เลข" หรือ "ชื่อ - สกุล" ที่แถวที่ 8`);
  }

  const courseRow = rows.find(r => r?.[0]?.toString().includes("วิชา"));
  const teacherRow = rows.find(r => r?.[5]?.toString().includes("ผู้สอน"));
  if (!courseRow || !teacherRow) throw new Error("❌ ไม่พบข้อมูลวิชา หรือ ผู้สอนในไฟล์");

  const courseParts = courseRow[0].split(/\s+/);
  const courseCode = courseParts[1];
  const fullCourseName = courseParts.slice(2).join(" ");
  const sectionMatch = fullCourseName.match(/ตอน\s*(\d+)/);
  const sectionStr = sectionMatch ? sectionMatch[1] : "1";
  const courseName = fullCourseName.replace(/ตอน\s*\d+/, '').trim();

  const teacherName = cleanName(teacherRow[5]);
  const newEmail = email.trim();
  let newTeacherCreated = false;

  // ✅ ค้นหาหรือสร้างอาจารย์
  let teacher = await User.findOne({ fullName: teacherName.trim(), role: "teacher" });
  if (!teacher) {
    const hashed = bcrypt.hashSync("teacher123", 10);
    teacher = await User.create({
      username: newEmail,
      fullName: teacherName.trim(),
      email: newEmail,
      password_hash: hashed,
      role: "teacher"
    });
    newTeacherCreated = true;
  } else {
    if (teacher.email !== newEmail || teacher.username !== newEmail) {
      const existing = await User.findOne({ username: newEmail });
      if (existing && existing._id.toString() !== teacher._id.toString()) {
        throw new Error(`❌ Email นี้ถูกใช้แล้วกับผู้ใช้งานอื่น (${newEmail})`);
      }
      teacher.email = newEmail;
      teacher.username = newEmail;
      await teacher.save();
    }
  }

  // ✅ เตรียมข้อมูลนักศึกษา
  const seen = new Set();
  const studentDocs = [];
  const defaultHash = bcrypt.hashSync("student123", 10);

  for (let i = 8; i < rows.length; i++) {
    const row = rows[i];
    const rawId = String(row[1] || "").trim();
    const fullName = String(row[2] || "").trim();
    if (!rawId && !fullName) break;
    if (!rawId || !fullName) continue;
    if (seen.has(rawId)) continue;
    seen.add(rawId);

    const emailId = rawId.replace(/-/g, "");
    const usernameId = emailId;
    const studentEmail = `s${emailId}@email.kmutnb.ac.th`;

    studentDocs.push({
      studentId: rawId,
      username: usernameId,
      fullName,
      email: studentEmail,
      password_hash: defaultHash,
      role: "student"
    });
  }

  if (studentDocs.length === 0) throw new Error("❌ ไม่พบนักศึกษาในไฟล์");

  // ✅ ใช้ bulkWrite เพื่อ insert/update ทั้งหมดในรอบเดียว
  await User.bulkWrite(
    studentDocs.map(doc => ({
      updateOne: {
        filter: { studentId: doc.studentId },
        update: { $set: doc },
        upsert: true
      }
    }))
  );

  // ✅ ดึง _id ของนักศึกษาทั้งหมด
  const studentIds = await User.find(
    { studentId: { $in: studentDocs.map(s => s.studentId) } },
    { _id: 1 }
  ).lean();

  // ✅ สร้างหรืออัปเดตคลาส
  let classDoc = await Class.findOne({ courseCode, section: sectionStr });
  if (classDoc) {
    classDoc.courseName = courseName;
    classDoc.teacherId = teacher._id;
    classDoc.students = studentIds.map(s => s._id);
    await classDoc.save();
  } else {
    classDoc = await Class.create({
      courseCode,
      courseName,
      section: sectionStr,
      teacherId: teacher._id,
      students: studentIds.map(s => s._id)
    });
  }

  return { classDoc, newTeacherCreated };
}

// ✅ GET /classes
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("teacherId", "fullName email")
      .populate("students", "fullName email username");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "❌ ดึงข้อมูลคลาสล้มเหลว", error: err.message });
  }
};

// ✅ GET /classes/:id
exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("teacherId", "fullName email")
      .populate("students", "fullName studentId email");

    if (!cls) return res.status(404).json({ message: "❌ ไม่พบคลาสนี้" });
    res.json(cls);
  } catch (err) {
    res.status(500).json({ message: "❌ โหลดคลาสล้มเหลว", error: err.message });
  }
};

// ✅ DELETE /classes/:id
exports.deleteClass = async (req, res) => {
  try {
    const deleted = await Class.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "❌ ไม่พบคลาส" });

    // ✅ เพิ่มตรงนี้: ลบ Enroll ที่ชี้มาคลาสนี้
    await Enroll.deleteMany({ classId: req.params.id });
    await Attendance.deleteMany({ classId: req.params.id });
    await FaceScanLog.deleteMany({ classId: req.params.id });
    await EnrollmentRequest.deleteMany({ classId: req.params.id });

    res.json({ message: "✅ ลบคลาสแล้ว และลบการลงทะเบียนของคลาสนี้เรียบร้อย" });
  } catch (err) {
    res.status(500).json({ message: "❌ ลบคลาสล้มเหลว", error: err.message });
  }
};

// ✅ GET /classes/student/:id
exports.getClassesByStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const classes = await Class.find({ students: studentId })
      .populate("teacherId", "fullName")
      .populate("students", "fullName email username")
      .select("courseCode courseName section");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "❌ โหลดคลาสของนักศึกษาล้มเหลว", error: err.message });
  }
};

// ✅ GET /classes/teacher
exports.getClassesByTeacher = async (req, res) => {
  try {
    const classes = await Class.find({ teacherId: req.user._id });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "❌ โหลดคลาสของอาจารย์ล้มเหลว", error: err.message });
  }
};

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const Class = require("../models/Class");

// นักศึกษาลงทะเบียนจากข้อมูลที่มีอยู่
exports.register = async (req, res) => {
  try {
    const { studentId, fullName } = req.body;

    const foundById = await User.findOne({ studentId });
    const foundByName = await User.findOne({ fullName });

    if (!foundById && !foundByName) {
      return res.status(404).json({ message: "ไม่พบชื่อและรหัสในระบบ ต้องการลงทะเบียนใหม่หรือไม่?" });
    }

    if (!foundById || !foundByName) {
      return res.status(400).json({ message: "ข้อมูลบางส่วนไม่ตรงกับระบบ กรุณาตรวจสอบให้ครบ" });
    }

    const strippedId = studentId.replace(/-/g, "");
    const username = strippedId;
    const password_hash = await bcrypt.hash(strippedId, 10);

    foundById.username = username;
    foundById.password_hash = password_hash;
    await foundById.save();

    res.json({ username, password: strippedId });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      $or: [
        { username },
        { studentId: username },
        { email: username }
      ]
    });

    if (!user) return res.status(401).json({ message: "ไม่พบผู้ใช้งานจากข้อมูลที่ให้มา" });

    if (user.role === "student") {
      const cleanStudentId = user.studentId.replace(/-/g, "");
      if (cleanStudentId !== username) {
        return res.status(401).json({ message: "นักศึกษาต้องใช้รหัสนักศึกษาในการเข้าสู่ระบบ" });
      }
    }

    if (user.role === "teacher" && user.email !== username) {
      return res.status(401).json({ message: "อาจารย์ต้องใช้ Email ในการเข้าสู่ระบบ" });
    }

    if (user.role === "admin" && user.studentId.replace(/-/g, "") !== username && user.username !== username) {
      return res.status(401).json({ message: "ผู้ดูแลระบบต้องใช้ Username หรือรหัสนักศึกษา" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });

    const token = jwt.sign({ id: user._id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ", error: err.message });
  }
};

function euclideanDistance(desc1, desc2) {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

exports.uploadFace = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    if (!req.body.faceDescriptor) {
      return res.status(400).json({ message: "❌ ไม่ได้ส่ง faceDescriptor มา" });
    }

    const inputDescriptor = Float32Array.from(JSON.parse(req.body.faceDescriptor));
    const savedDescriptor = Float32Array.from(user.faceDescriptor);

    const distance = euclideanDistance(savedDescriptor, inputDescriptor);
    console.log("📏 ค่าระยะห่างใบหน้า (euclidean distance):", distance.toFixed(6));

    if (distance > 0.5) {
      return res.status(403).json({ message: `❌ ใบหน้าไม่ตรงกัน (ระยะห่าง ${distance.toFixed(4)})` });
    }

    return res.json({
      message: `✅ ใบหน้าตรงกัน (ระยะห่าง ${distance.toFixed(4)})`,
      studentId: user.studentId,
      fullName: user.fullName,
    });

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดใน uploadFace:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

exports.verifyTeacherFace = async (req, res) => {
  try {
    const { classId, faceDescriptor } = req.body;

    const classroom = await Class.findById(classId).populate("teacherId");
    if (!classroom || !classroom.teacherId) {
      return res.status(404).json({ message: "ไม่พบอาจารย์ในคลาสนี้" });
    }

    const teacher = classroom.teacherId;
    if (!teacher.faceDescriptor) {
      return res.status(403).json({ message: "อาจารย์ยังไม่ได้สแกนใบหน้า" });
    }

    const savedDescriptor = Float32Array.from(teacher.faceDescriptor);
    const inputDescriptor = Float32Array.from(faceDescriptor);
    const distance = euclideanDistance(savedDescriptor, inputDescriptor);
    console.log("📏 ค่าระยะห่างใบหน้าอาจารย์:", distance.toFixed(6));

    if (distance > 0.5) {
      return res.status(403).json({ message: "ใบหน้าไม่ตรงกับอาจารย์" });
    }

    res.json({ message: "ยืนยันตัวตนสำเร็จ" });
  } catch (err) {
    console.error("ตรวจสอบอาจารย์ล้มเหลว:", err);
    res.status(500).json({ message: "ตรวจสอบอาจารย์ล้มเหลว", error: err.message });
  }
};

exports.saveTeacherFace = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "teacher") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    user.faceDescriptor = faceDescriptor;
    user.faceScanned = true;
    await user.save();

    res.json({ message: "Teacher face saved!" });
  } catch (err) {
    res.status(500).json({ message: "Save teacher face failed", error: err.message });
  }
};

exports.newRegister = async (req, res) => {
  try {
    const { studentId, fullName, email } = req.body;
    const strippedId = studentId.replace(/-/g, "");

    if (!/^s\d{13}@email\.kmutnb\.ac\.th$/.test(email) || email !== `s${strippedId}@email.kmutnb.ac.th`) {
      return res.status(400).json({ message: "อีเมลไม่ถูกต้อง หรือไม่ตรงกับรหัสนักศึกษา" });
    }

    if (!/^(นาย|นางสาว|นาง)/.test(fullName)) {
      return res.status(400).json({ message: "ชื่อต้องขึ้นต้นด้วย นาย, นางสาว หรือ นาง" });
    }

    if (!/^\d{2}-\d{6}-\d{4}-\d{1}$/.test(studentId)) {
      return res.status(400).json({ message: "รหัสนักศึกษาต้องอยู่ในรูปแบบ xx-xxxxxx-xxxx-x" });
    }

    const exists = await User.findOne({ studentId });
    if (exists) {
      return res.status(409).json({ message: "นักศึกษาคนนี้มีในระบบแล้ว" });
    }

    const password_hash = await bcrypt.hash(strippedId, 10);

    const newUser = new User({
      studentId,
      fullName,
      email,
      username: strippedId,
      password_hash,
      role: "student",
    });

    await newUser.save();

    res.json({
      message: "ลงทะเบียนสำเร็จ",
      username: strippedId,
      password: strippedId,
    });
  } catch (err) {
    res.status(500).json({
      message: "ลงทะเบียนใหม่ไม่สำเร็จ",
      error: err.message,
    });
  }
};
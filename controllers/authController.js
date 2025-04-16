const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const faceapi = require("face-api.js");
const Class = require("../models/Class");

// นักศึกษาลงทะเบียนจากข้อมูลที่มีอยู่
exports.register = async (req, res) => {
  try {
    const { studentId, fullName } = req.body;

    const foundById = await User.findOne({ studentId });
    const foundByName = await User.findOne({ fullName });

    // ❌ ไม่เจอทั้งชื่อและรหัส
    if (!foundById && !foundByName) {
      return res.status(404).json({ message: "ไม่พบชื่อและรหัสในระบบ ต้องการลงทะเบียนใหม่หรือไม่?" });
    }

    // ⚠️ อย่างใดอย่างหนึ่งไม่ตรง
    if (!foundById || !foundByName) {
      return res.status(400).json({ message: "ข้อมูลบางส่วนไม่ตรงกับระบบ กรุณาตรวจสอบให้ครบ" });
    }

    // ✅ ทั้งชื่อและรหัสตรงกัน
    const username = studentId;
    const password_hash = await bcrypt.hash(studentId, 10);

    foundById.username = username;
    foundById.password_hash = password_hash;
    await foundById.save();

    res.json({ username, password: studentId });
  } catch (err) {
    res.status(500).json({ message: "❌ เกิดข้อผิดพลาด", error: err.message });
  }
};

// Login โดยใช้ username หรือ studentId หรือ email
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

    if (!user) {
      return res.status(401).json({ message: "Invalid username or student ID or email" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: "Login error", error: err.message });
  }
};

// ✨ อัปเดตใบหน้าและส่ง studentId + fullName กลับ
exports.uploadFace = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.faceScanned = true;
    user.faceDescriptor = faceDescriptor;
    await user.save();

    res.json({
      message: "Face saved successfully!",
      studentId: user.studentId,
      fullName: user.fullName
    });
  } catch (err) {
    res.status(500).json({ message: "Face upload failed", error: err.message });
  }
};

// ✨ ตรวจสอบใบหน้าอาจารย์ก่อนให้นักศึกษาเช็คชื่อ
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
    const distance = faceapi.euclideanDistance(savedDescriptor, inputDescriptor);
    console.log("🔍 Face distance:", distance);

    if (distance > 0.5) {
      return res.status(403).json({ message: "❌ ใบหน้าไม่ตรงกับอาจารย์" });
    }

    res.json({ message: "✅ ยืนยันตัวตนสำเร็จ" });
  } catch (err) {
    console.error("❌ ตรวจสอบอาจารย์ล้มเหลว:", err);
    res.status(500).json({ message: "❌ ตรวจสอบอาจารย์ล้มเหลว", error: err.message });
  }
};

// ✨ บันทึกใบหน้าอาจารย์
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

    res.json({ message: "👨‍🏫 Teacher face saved!" });
  } catch (err) {
    res.status(500).json({ message: "Save teacher face failed", error: err.message });
  }
};

// นักศึกษาที่ยังไม่มีในระบบ → ลงทะเบียนใหม่
exports.newRegister = async (req, res) => {
  try {
    const { studentId, fullName, email } = req.body;

    // ตรวจสอบความถูกต้องเบื้องต้น
    if (!/^s\d{13}@email\.kmutnb\.ac\.th$/.test(email)) {
      return res.status(400).json({ message: "📧 อีเมลไม่ถูกต้อง" });
    }

    if (!/^(นาย|นางสาว|นาง)/.test(fullName)) {
      return res.status(400).json({ message: "⚠️ ชื่อต้องขึ้นต้นด้วย นาย, นางสาว หรือ นาง" });
    }

    if (!/^\d{13}$/.test(studentId)) {
      return res.status(400).json({ message: "📛 รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก" });
    }

    const exists = await User.findOne({ studentId });
    if (exists) {
      return res.status(409).json({ message: "🚫 นักศึกษาคนนี้มีในระบบแล้ว" });
    }

    const password_hash = await bcrypt.hash(studentId, 10);

    const newUser = new User({
      studentId,
      fullName,
      email,
      username: studentId,
      password_hash,
      role: "student",
    });

    await newUser.save();

    res.json({
      message: "✅ ลงทะเบียนสำเร็จ",
      username: studentId,
      password: studentId,
    });
  } catch (err) {
    res.status(500).json({
      message: "❌ ลงทะเบียนใหม่ไม่สำเร็จ",
      error: err.message,
    });
  }
};

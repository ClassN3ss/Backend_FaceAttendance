const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const faceapi = require("face-api.js");
const Class = require("../models/Class");

const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

// นักศึกษาลงทะเบียนจากข้อมูลที่มีอยู่
exports.register = async (req, res) => {
  try {
    const { studentId, fullName } = req.body;

    const foundById = await User.findOne({ studentId });
    const foundByName = await User.findOne({ fullName });

    // ไม่เจอทั้งชื่อและรหัส
    if (!foundById && !foundByName) {
      return res.status(404).json({ message: "ไม่พบชื่อและรหัสในระบบ ต้องการลงทะเบียนใหม่หรือไม่?" });
    }

    // อย่างใดอย่างหนึ่งไม่ตรง
    if (!foundById || !foundByName) {
      return res.status(400).json({ message: "ข้อมูลบางส่วนไม่ตรงกับระบบ กรุณาตรวจสอบให้ครบ" });
    }

    // ทั้งชื่อและรหัสตรงกัน
    const strippedId = studentId.replace(/-/g, ""); // ตัดขีดออก

    const username = strippedId;
    const password_hash = await bcrypt.hash(strippedId, 10); // เข้ารหัสแบบไม่มีขีด

    foundById.username = username;
    foundById.password_hash = password_hash;
    await foundById.save();

    res.json({ username, password: strippedId });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
};

// Login โดยใช้ username หรือ studentId หรือ email
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // หาผู้ใช้จาก DB โดยพิจารณาทั้ง 3 ช่อง
    const user = await User.findOne({
      $or: [
        { username },
        { studentId: username },
        { email: username }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: "ไม่พบผู้ใช้งานจากข้อมูลที่ให้มา" });
    }

    // ตรวจสอบว่า login ด้วยช่องที่เหมาะสมกับ role
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

    // ตรวจสอบรหัสผ่าน
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
    }

    // สร้าง JWT Token
    const token = jwt.sign({ id: user._id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({ token, user });

  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ", error: err.message });
  }
};

// อัปเดตใบหน้าและส่ง studentId + fullName กลับ
exports.saveFaceImagesToModel = async (req, res) => {
  try {
    const { fullname, studentID } = req.body;
    const files = req.files;

    const requiredKeys = ["front", "left", "right", "up", "down"];
    for (const key of requiredKeys) {
      if (!files[key]) {
        return res.status(400).json({ status: "error", message: `Missing ${key} image` });
      }
    }

    // เตรียมฟอร์มส่งให้ Python
    const form = new FormData();
    form.append("fullname", fullname);
    form.append("studentID", studentID);
    requiredKeys.forEach((key) => {
      form.append(key, files[key][0].buffer, `${key}.jpg`);
    });

    // เรียก model
    const response = await axios.post("http://localhost:5000/api/verify-face", form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const result = response.data;

    if (!result.verified) {
      return res.json({ status: "not_verified", matchCount: result.matchCount ?? 0 });
    }

    // --- verified = true ---
    // 1) หา user จาก DB (ระวังชื่อฟิลด์ใน schema: ส่วนมากใช้ fullName / studentId)
    const user = await User.findOne({
      $or: [{ studentId: studentID }, { fullName: fullname }]
    });

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found for saving face data" });
    }

    // 2) บันทึกเวกเตอร์ทั้ง 5 มุม + mark faceScanned
    //    แนะนำโครงสร้างเก็บแบบนี้ (ยืดหยุ่นและอ่านง่าย):
    //    user.faceEncodings = { front: [...], left: [...], right: [...], up: [...], down: [...] }
    user.faceEncodings = result.encodings; // object {front,left,right,up,down}
    user.faceScanned = true;

    await user.save();

    // 3) ส่งกลับไปให้ frontend
    return res.json({
      status: "verified",
      matchCount: result.matchCount,
      user: {
        id: user._id,
        fullName: user.fullName,
        studentId: user.studentId,
        faceScanned: user.faceScanned
      }
    });

  } catch (err) {
    console.error("Error saving face:", err);
    return res.status(500).json({ status: "error", message: "Internal server error", error: err.message });
  }
};

// ตรวจสอบใบหน้าอาจารย์ก่อนให้นักศึกษาเช็คชื่อ
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
    console.log("Face distance:", distance);

    if (distance > 0.5) {
      return res.status(403).json({ message: "ใบหน้าไม่ตรงกับอาจารย์" });
    }

    res.json({ message: "ยืนยันตัวตนสำเร็จ" });
  } catch (err) {
    console.error("ตรวจสอบอาจารย์ล้มเหลว:", err);
    res.status(500).json({ message: "ตรวจสอบอาจารย์ล้มเหลว", error: err.message });
  }
};

// บันทึกใบหน้าอาจารย์
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

// นักศึกษาที่ยังไม่มีในระบบ → ลงทะเบียนใหม่
exports.newRegister = async (req, res) => {
  try {
    const { studentId, fullName, email } = req.body;

    //  ลบขีดสำหรับตรวจอีเมลและสร้าง username/password
    const strippedId = studentId.replace(/-/g, "");

    // ตรวจสอบความถูกต้องเบื้องต้น
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
      studentId,            // เก็บแบบมีขีด
      fullName,
      email,
      username: strippedId, // ใช้แบบไม่มีขีด
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

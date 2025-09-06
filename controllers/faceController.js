const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const Class = require("../models/Class");
const FormData = require("form-data");
const axios = require("axios");

const INTERNAL_KEY = process.env.INTERNAL_FACE_API_KEY || "dev-internal-key";
const THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.4);
const TEACHER_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.5);
const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "https://face-api-md-fb756422d243.herokuapp.com";

exports.verifyByImage = async (req, res) => {
  try {
    const file = req.file; // multer.single("image")
    const { studentID, fullname } = req.body || {};

    if (!file) return res.status(400).json({ ok: false, message: "image is required" });
    if (!studentID || !String(studentID).trim())
      return res.status(400).json({ ok: false, message: "studentID is required" });

    const form = new (require("form-data"))();
    form.append("image", file.buffer, {
      filename: file.originalname || "face.jpg",
      contentType: file.mimetype || "image/jpeg",
    });
    form.append("studentID", String(studentID).trim());
    if (fullname) form.append("fullname", String(fullname).trim());
    // ส่ง threshold จากฝั่ง Backend ไปคุมค่ากลาง
    form.append("threshold", String(THRESHOLD));

    const { data } = await axios.post(`${MODEL_BASE_URL}/api/scan-face`, form, {
      headers: { ...form.getHeaders(), "x-internal-key": INTERNAL_KEY },
      timeout: 15000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("verifyByImage failed:", err?.message);
    return res.status(500).json({ ok: false, message: "verify by image failed", error: err?.message });
  }
};

exports.verifyTeacherFace = async (req, res) => {
  try {
    const { classId } = req.body;
    const file = req.file; // multer.single("image")

    if (!file) return res.status(400).json({ ok: false, message: "image is required" });
    if (!classId) return res.status(400).json({ ok: false, message: "classId is required" });

    // หา teacherId จาก class โดยไม่ต้อง populate ตัวเต็ม
    const classroom = await Class.findById(classId).select("teacherId").lean();
    if (!classroom || !classroom.teacherId) {
      return res.status(404).json({ ok: false, message: "ไม่พบอาจารย์ในคลาสนี้" });
    }
    // รองรับทั้งกรณีเป็น ObjectId ตรง ๆ หรือ {_id: ...}
    const teacherId = classroom.teacherId?.toString?.() || String(classroom.teacherId);

    // ส่งรูป + teacherID + threshold ไปให้ Model เทียบกับ MongoDB ที่ Model
    const form = new (require("form-data"))();
    form.append("image", file.buffer, {
      filename: file.originalname || "face.jpg",
      contentType: file.mimetype || "image/jpeg",
    });
    form.append("teacherID", teacherId);                    // ← users._id
    form.append("threshold", String(TEACHER_THRESHOLD));

    const { data } = await axios.post(`${MODEL_BASE_URL}/api/scan-teacher`, form, {
      headers: { ...form.getHeaders(), "x-internal-key": INTERNAL_KEY },
      timeout: 15000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // ส่งผล match/distance/threshold กลับ FE ตรง ๆ
    return res.status(200).json(data);
  } catch (err) {
    console.error("verifyTeacherFace (new flow) failed:", err?.message);
    return res.status(500).json({ ok: false, message: "verify teacher failed", error: err?.message });
  }
};

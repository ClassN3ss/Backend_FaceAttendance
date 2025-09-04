const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const Class = require("../models/Class");
const FormData = require("form-data");
const axios = require("axios");

const INTERNAL_KEY = process.env.INTERNAL_FACE_API_KEY || "dev-internal-key";
const THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.4);
const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "https://face-api-md-4791c16f45ff.herokuapp.com";

const isVec = (v) =>
  Array.isArray(v) && v.length === 128 && v.every((n) => typeof n === "number");

function euclidean(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function collectRefVectors(user) {
  const refs = [];

  // encodings
  const enc = user.faceEncodings;
  if (enc) {
    if (Array.isArray(enc)) {
      enc.forEach((v, i) => {
        if (isVec(v)) refs.push({ vec: v, label: `enc[${i}]` });
      });
    } else if (typeof enc === "object") {
      ["front", "left", "right", "up", "down"].forEach((k) => {
        const v = enc?.[k];
        if (isVec(v)) refs.push({ vec: v, label: k });
      });
    }
  }

  return refs;
}

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
    const { fullname, classId } = req.body;
    const file = req.file; // multer.single("image")

    if (!file) return res.status(400).json({ ok: false, message: "image is required" });
    if (!fullname || !fullname.trim()) return res.status(400).json({ ok: false, message: "fullname is required" });
    if (!classId) return res.status(400).json({ ok: false, message: "classId is required" });

    // 1) หา class -> teacher
    const classroom = await Class.findById(classId).populate("teacherId");
    if (!classroom || !classroom.teacherId) {
      return res.status(404).json({ ok: false, message: "ไม่พบอาจารย์ในคลาสนี้" });
    }

    const teacher = classroom.teacherId;
    // ✅ ใช้ faceEncodings ให้ตรงกับ Schema
    const saved = teacher.faceEncodings;  
    if (!saved) {
      return res.status(403).json({ ok: false, message: "อาจารย์ยังไม่ได้สแกนใบหน้า" });
    }

    // 2) ส่งรูปไปหา Model เพื่อ encode
    const form = new (require("form-data"))();
    form.append("image", file.buffer, { filename: file.originalname, contentType: file.mimetype });
    form.append("fullname", fullname.trim());

    const { data } = await axios.post(`${MODEL_BASE_URL}/api/teacher-scan`, form, {
      headers: form.getHeaders(),
      timeout: 15000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (!data?.ok || !data?.descriptor) {
      return res.status(400).json({ ok: false, message: data?.message || "encode failed" });
    }

    // 3) เทียบเวกเตอร์
    const fv1 = Array.from(saved);              // ที่บันทึกไว้ใน DB
    const fv2 = Array.from(data.descriptor);    // ที่ encode จากรูปใหม่
    const distance = euclidean(fv1, fv2);

    const threshold = Number(process.env.FACE_MATCH_THRESHOLD || 0.5);
    const match = distance <= threshold;

    return res.json({
      ok: true,
      match,
      distance,
      threshold,
      teacher: { id: teacher._id, fullName: teacher.fullName || fullname.trim() },
    });
  } catch (err) {
    console.error("verifyTeacherFace failed:", err.message);
    return res.status(500).json({ ok: false, message: "verify teacher failed", error: err.message });
  }
};

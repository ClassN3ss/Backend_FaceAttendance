const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");
const Class = require("../models/Class");
const FormData = require("form-data");
const axios = require("axios");

const INTERNAL_KEY = process.env.INTERNAL_FACE_API_KEY || "dev-internal-key";
const THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.4);

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

exports.verifyVectorById = async (req, res) => {
  try {
    // อนุญาตเฉพาะ service ภายใน (Face API) เรียก
    if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }

    console.log("[verifyVectorById] headers:", req.headers);
    console.log("[verifyVectorById] raw body:", req.body);

    const { studentID, faceVector } = req.body || {};
    if (!studentID || !Array.isArray(faceVector)) {
      return res
        .status(400)
        .json({ ok: false, message: "missing studentID or faceVector" });
    }

    // แปลงเป็น number array
    const fv = faceVector.map((n) => Number(n));
    if (!isVec(fv)) {
      return res.status(400).json({ ok: false, message: "invalid faceVector" });
    }

    const user = await User.findOne({
      studentId: String(studentID).trim(),
    }).lean();

    if (!user) {
      return res.status(404).json({ ok: false, message: "user not found" });
    }

    const refs = collectRefVectors(user);
    if (!refs.length) {
      return res
        .status(422)
        .json({ ok: false, message: "no reference vectors for this user" });
    }

    // คำนวณระยะกับทุกเวกเตอร์ แล้วเรียงน้อย -> มาก
    const distances = refs.map((r) => ({
      label: r.label,
      distance: euclidean(r.vec, fv),
    })).sort((a, b) => a.distance - b.distance);

    const best = distances[0];
    const match = best.distance <= THRESHOLD;

    return res.json({
      ok: true,
      match,
      distance: best.distance,
      threshold: THRESHOLD,
      bestRef: best.label,
      allDistances: distances,
      userId: user._id,
      studentID: String(studentID).trim(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
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
    const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "https://face-api-md-97765e8728dc.herokuapp.com/";
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

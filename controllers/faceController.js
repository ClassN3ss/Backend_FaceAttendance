const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../configuration/config");

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

  // 1) centroid
  if (isVec(user.faceCentroid)) {
    refs.push({ vec: user.faceCentroid, label: "centroid" });
  }

  // 2) encodings
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
    const { faceDescriptor } = req.body;
    const teacher = await User.findById(req.user.id);

    if (!teacher || teacher.role !== "teacher" || !teacher.faceDescriptor) {
      return res.status(403).json({ message: "คุณไม่ใช่อาจารย์ หรือยังไม่บันทึกใบหน้า" });
    }

    const distance = cosineDistance(faceDescriptor, teacher.faceDescriptor);

    if (distance > 0.5) {
      return res.status(403).json({ message: "ใบหน้าไม่ตรงกับอาจารย์" });
    }

    teacher.lastVerifiedAt = new Date(); // (Optional) สำหรับบันทึกเวลา
    await teacher.save();

    res.json({ message: "ใบหน้าอาจารย์ถูกต้อง", distance: distance.toFixed(4) });
  } catch (err) {
    res.status(500).json({ message: "ตรวจสอบใบหน้าอาจารย์ล้มเหลว", error: err.message });
  }
};
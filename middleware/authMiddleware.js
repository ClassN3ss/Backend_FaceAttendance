const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../configuration/config");

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("📥 [middleware] รับ token:", token);

  if (!token) {
    console.log("❌ [middleware] ไม่พบ token ใน header");
    return res.status(401).json({ message: "❌ Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    console.log("✅ [middleware] token ผ่านการ decode แล้ว:", decoded);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.log("❌ [middleware] ไม่พบผู้ใช้ในระบบจาก decoded.id:", decoded.id);
      return res.status(404).json({ message: "❌ User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.log("❌ [middleware] Token ไม่ถูกต้อง:", err.message);
    return res.status(401).json({ message: "❌ Invalid token", error: err.message });
  }
};

const isStudent = (req, res, next) => {
  if (req.user?.role === "student") return next();
  return res.status(403).json({ message: "❌ Only students allowed" });
};

const isTeacher = (req, res, next) => {
  if (req.user?.role === "teacher") return next();
  return res.status(403).json({ message: "❌ Only teachers allowed" });
};

const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ message: "❌ Only admins allowed" });
};

const isTeacherOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role === "teacher" || role === "admin") return next();
  return res.status(403).json({ message: "❌ Only teacher or admin allowed" });
};

module.exports = {
  verifyToken,
  isStudent,
  isTeacher,
  isAdmin,
  isTeacherOrAdmin,
};

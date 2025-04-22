const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  createClass,
  getAllClasses,
  deleteClass,
  getClassesByStudent,
  getClassesByTeacher,
  getClassById
} = require("../controllers/classController");


// สร้างหรืออัปเดตคลาสจาก .xlsx
router.post("/create", verifyToken, createClass);

// อ่านคลาสทั้งหมดที่นักเรียนเคยเรียน
router.get("/student/:id", verifyToken, getClassesByStudent);

// อ่านคลาสทั้งหมดของอาจารย์ที่ล็อกอิน
router.get("/teacher", verifyToken, getClassesByTeacher);

// *อ่านคลาสทั้งหมด (admin)
router.get("/", verifyToken, getAllClasses);

// ลบคลาส
router.delete("/:id", verifyToken, deleteClass);

// อ่านข้อมูลคลาสจาก ID (ควรอยู่ล่างสุด)
router.get("/:id", verifyToken, getClassById);

module.exports = router;

const express = require("express");
const router = express.Router();
const {openSession, cancelSession, getActiveSessions, getActiveSessionByClass} = require("../controllers/checkinSessionController");
const { verifyToken, isStudent, isTeacher} = require("../middleware/authMiddleware");

// สำหรับอาจารย์เปิด session
router.post("/open", verifyToken, isTeacher, openSession);

// ยกเลิก session
router.put("/cancel/:id", verifyToken, isTeacher, cancelSession);

// โหลดทุก session ที่เปิดอยู่ (admin/teacher)
router.get("/current", verifyToken, getActiveSessions);

// student ดู session ของห้องตัวเอง
router.get("/class/:classId", verifyToken, getActiveSessionByClass);

module.exports = router;

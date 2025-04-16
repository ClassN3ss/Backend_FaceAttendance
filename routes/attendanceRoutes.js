const express = require("express");
const router = express.Router();
const {
  checkIn,
  getHistoryByStudent,
  getAllFaceScanLogs,
  getAttendanceByClass,
  getAttendanceByClassRaw
} = require("../controllers/attendanceController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

router.post("/checkin", verifyToken, checkIn);
router.get("/history/:studentId", verifyToken, getHistoryByStudent);
router.get("/history-student", verifyToken, getAllFaceScanLogs);
router.get("/class/:classId", verifyToken, getAttendanceByClass);
router.get("/class-row/:classId", verifyToken, getAttendanceByClassRaw);

module.exports = router;

const express = require("express");
const router = express.Router();
const { findStudentByFace, verifyTeacherFace } = require("../controllers/faceController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/find-student", verifyToken, findStudentByFace);

router.post("/find-teacher", verifyToken, verifyTeacherFace);

module.exports = router;

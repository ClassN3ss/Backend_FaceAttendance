const express = require("express");
const router = express.Router();
const { verifyVectorById, verifyTeacherFace } = require("../controllers/faceController");
const { verifyToken } = require("../middleware/authMiddleware");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/verify-vector-by-id", verifyVectorById);

router.post("/verify-teacher-face", verifyToken, upload.single("image"), verifyTeacherFace);

module.exports = router;

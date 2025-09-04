const express = require("express");
const router = express.Router();
const { verifyByImage, verifyTeacherFace } = require("../controllers/faceController");
const { verifyToken } = require("../middleware/authMiddleware");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/verify-by-image", upload.single("image"),verifyByImage);

router.post("/verify-teacher-face", verifyToken, upload.single("image"), verifyTeacherFace);

module.exports = router;

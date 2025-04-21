const express = require("express");
const multer = require("multer");
const { uploadCSV } = require("../controllers/uploadStudentsController");
const { verifyToken,} = require("../middleware/authMiddleware");

//บันทึกไฟล์ลง /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

const router = express.Router(); // เพิ่ม const router ให้ชัดเจน
router.post("/csv", verifyToken, upload.single("file"), uploadCSV);

module.exports = router;

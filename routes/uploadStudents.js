const express = require("express");
const multer = require("multer");
const { uploadCSV } = require("../controllers/uploadStudentsController");
const { verifyToken,} = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

const router = express.Router();
router.post("/csv", verifyToken, upload.single("file"), uploadCSV);

module.exports = router;

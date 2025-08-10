const express = require("express");
const router = express.Router();
const { verifyVectorById, verifyTeacherFace } = require("../controllers/faceController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/verify-vector-by-id", verifyVectorById);

router.post("/find-teacher", verifyToken, verifyTeacherFace);

module.exports = router;

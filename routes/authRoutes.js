const express = require("express");
const router = express.Router();
const { register, login, uploadFace, verifyTeacherFace, saveTeacherFace, newRegister, getDescriptorByUserId } = require("../controllers/authController");
const { verifyToken,} = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/new-register", newRegister);
router.post("/login", login);

router.post("/upload-face", verifyToken, uploadFace);

router.post("/verify-teacher-face", verifyToken, verifyTeacherFace);
router.post("/save-teacher-face", verifyToken, saveTeacherFace);

router.get("/get-descriptor/:userId", verifyToken, (req, res, next) => {
  if (req.user.id !== req.params.userId) {
    return res.status(403).json({ message: "ห้ามเข้าถึงข้อมูลของผู้ใช้อื่น" });
  }
  getDescriptorByUserId(req, res, next);
});


router.get("/me", verifyToken, (req, res) => {
  res.json(req.user);
});

router.get("/debug-token", verifyToken, (req, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { getEnrolledSubjects } = require("../controllers/enrollController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/enrolled/:studentId", verifyToken, getEnrolledSubjects);

module.exports = router;

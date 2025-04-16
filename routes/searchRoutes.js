const express = require("express");
const router = express.Router();
const { searchUsers, searchClasses } = require("../controllers/searchController");
const { verifyToken, isTeacherOrAdmin } = require("../middleware/authMiddleware");

// ✅ จำกัดให้เฉพาะผู้มีสิทธิ์เท่านั้นถึงค้นหาได้
router.get("/users", verifyToken, searchUsers);
router.get("/classes", verifyToken, searchClasses);

module.exports = router;

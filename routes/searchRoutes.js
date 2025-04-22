const express = require("express");
const router = express.Router();
const { searchUsers, searchClasses } = require("../controllers/searchController");
const { verifyToken, isTeacherOrAdmin } = require("../middleware/authMiddleware");

router.get("/users", verifyToken, searchUsers);
router.get("/classes", verifyToken, searchClasses);

module.exports = router;

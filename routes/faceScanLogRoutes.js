const express = require("express");
const router = express.Router();
const { getAllFaceScanLogs } = require("../controllers/faceScanLogController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// ✅ จำกัดเฉพาะ admin เท่านั้นที่ดู log ทั้งหมดได้
router.get("/history1", verifyToken, isAdmin, getAllFaceScanLogs);

module.exports = router;

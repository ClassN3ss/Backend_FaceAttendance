const express = require("express");
const router = express.Router();
const { getAllFaceScanLogs } = require("../controllers/faceScanLogController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.get("/history1", verifyToken, isAdmin, getAllFaceScanLogs);

module.exports = router;

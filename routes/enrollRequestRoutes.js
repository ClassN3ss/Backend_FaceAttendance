const express = require("express");
const router = express.Router();
const {
  createRequest,
  getAllRequests,
  approveRequest,
  deleteRequest,
  getStudentRequests
} = require("../controllers/enrollRequestController");

const { verifyToken } = require("../middleware/authMiddleware");

router.post("/", verifyToken, createRequest);
router.get("/messages", verifyToken, getAllRequests);
router.put("/approve/:id", verifyToken, approveRequest);
router.delete("/:id", verifyToken, deleteRequest);
router.get("/requests/:studentId", verifyToken, getStudentRequests);

module.exports = router;

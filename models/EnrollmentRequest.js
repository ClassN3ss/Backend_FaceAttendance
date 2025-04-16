const mongoose = require("mongoose");

const enrollRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true, },
  reason: { type: String, },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", },
  date: { type: String, required: true },
  time: { type: String, required: true },
});

module.exports = mongoose.model("EnrollRequest", enrollRequestSchema);

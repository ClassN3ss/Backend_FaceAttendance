const mongoose = require("mongoose");

const enrollSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true, },
  approved: { type: Boolean, default: true, },
  date: { type: String, required: true },
  time: { type: String, required: true },
});

module.exports = mongoose.model("Enroll", enrollSchema);

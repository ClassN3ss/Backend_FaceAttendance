const mongoose = require("mongoose");

const checkinSessionSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  openAt: { type: Date, required: true },
  closeAt: { type: Date, required: true },
  withTeacherFace: { type: Boolean, default: false },
  withMapPreview: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "cancelled", "expired"], default: "active" },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    radiusInMeters: { type: Number, default: 100 },
    name: { type: String },
  }
});

module.exports = mongoose.model("CheckinSession", checkinSessionSchema);

const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true, unique: true, sparse: true },
  password: { type: String },
  password_hash: { type: String },
  role: { type: String, enum: ["student", "teacher", "admin"], default: "student", required: true },
  email: { type: String, trim: true, lowercase: true, default: "" },
  faceScanned: { type: Boolean, default: false },
  faceEncodings: { type: Schema.Types.Mixed, default: null },
});

module.exports = mongoose.model("User", userSchema);

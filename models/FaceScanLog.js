const mongoose = require('mongoose');

const faceScanLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  imageUrl: { type: String },
  location: { lat: Number, lng: Number },
  status: { type: String, enum: ['success', 'fail'], default: 'success' }
}
);

module.exports = mongoose.model('FaceScanLog', faceScanLogSchema);

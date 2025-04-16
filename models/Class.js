const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
    courseName: { type: String, required: true, trim: true, },
    courseCode: { type: String, required: true, trim: true, },
    section: { type: String, required: true, trim: true, },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, },
    students: [ { type: mongoose.Schema.Types.ObjectId, ref: "User", }, ],
    attendanceTable: {
      type: Map, // 🔐 date → [studentIds]
      of: [mongoose.Schema.Types.ObjectId],
      default: {},
    },
  }
);

module.exports = mongoose.model("Class", classSchema);

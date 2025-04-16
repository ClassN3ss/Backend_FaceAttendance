const Enroll = require("../models/Enroll");

exports.getEnrolledSubjects = async (req, res) => {
  try {
    const studentId = req.params.studentId;

    const enrolled = await Enroll.find({ student: studentId, approved: true })
      .populate("classId", "courseCode courseName section");

    // กรองเฉพาะ Enroll ที่ยังมี classId อยู่
    const subjects = enrolled
      .filter(e => e.classId && e.classId.courseCode && e.classId.courseName)
      .map(e => ({
        classId: e.classId._id,
        courseCode: e.classId.courseCode,
        courseName: e.classId.courseName,
        section: e.classId.section
      }));

    res.json({ enrolled: subjects });
  } catch (err) {
    res.status(500).json({ message: "❌ ดึงวิชาที่ลงทะเบียนล้มเหลว", error: err.message });
  }
};

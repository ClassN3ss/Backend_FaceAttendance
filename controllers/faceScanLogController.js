const FaceScanLog = require("../models/FaceScanLog");

exports.getAllFaceScanLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 500;
    const skip = (page - 1) * limit;

    const logs = await FaceScanLog.find()
      .skip(skip)
      .limit(limit)
      .populate("userId", "fullName username")
      .populate("classId", "courseName courseCode")

    res.json({ page, logs });
  } catch (err) {
    console.error("❌ ดึงประวัติการสแกนล้มเหลว:", err);
    res.status(500).json({ message: "❌ ไม่สามารถโหลดข้อมูลได้" });
  }
};

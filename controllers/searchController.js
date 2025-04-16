const User = require("../models/User");
const Class = require("../models/Class");

// ✅ ค้นหาผู้ใช้จากชื่อหรือรหัส
exports.searchUsers = async (req, res) => {
  try {
    const { q, role } = req.query;

    const query = {
      $and: [
        role ? { role } : {},
        {
          $or: [
            { fullName: { $regex: q, $options: "i" } },
            { username: { $regex: q, $options: "i" } },
            { studentId: { $regex: q, $options: "i" } },
          ],
        },
      ],
    };

    const users = await User.find(query).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "❌ ค้นหาผู้ใช้ล้มเหลว", error: err.message });
  }
};

// ✅ ค้นหาคลาสจากชื่อ / รหัสวิชา / section
exports.searchClasses = async (req, res) => {
  try {
    const { q } = req.query;
    const regex = new RegExp(q, "i");

    const classes = await Class.find({
      $or: [
        { courseName: regex },
        { courseCode: regex },
        { section: regex },
      ],
    }).populate("teacherId", "fullName");

    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "❌ ค้นหาคลาสล้มเหลว", error: err.message });
  }
};

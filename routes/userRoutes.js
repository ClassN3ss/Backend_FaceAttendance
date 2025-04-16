const express = require("express");
const router = express.Router();
const {
  getTeachers,
  searchUsers,
  getAllUsers,
  deleteUser,
  updateUser
} = require("../controllers/userController");

const { verifyToken } = require("../middleware/authMiddleware");
const User = require('../models/User');
const Class = require('../models/Class');

// ✅ GET /teachers - รายชื่ออาจารย์
router.get("/teachers", verifyToken, getTeachers);

// ✅ GET /search/users?q=&role= - ค้นหาผู้ใช้
router.get("/search/users", verifyToken, searchUsers);

// ✅ GET /users - ผู้ใช้ทั้งหมด (admin)
router.get("/users", verifyToken, getAllUsers);

// ✅ PUT /users/:id - แก้ไขข้อมูลผู้ใช้
router.put("/users/:id", verifyToken, updateUser);

// ✅ DELETE /users/:id - ลบผู้ใช้
router.delete("/users/:id", verifyToken, deleteUser);

// ✅ GET /with-classes - ผู้ใช้ทั้งหมด + คลาสที่เกี่ยวข้อง
router.get('/with-classes', verifyToken, async (req, res) => {
  try {
    const users = await User.find();
    const allClasses = await Class.find();

    const result = users.map(user => {
      let classesTaught = [];
      let classesEnrolled = [];

      if (user.role === 'teacher') {
        classesTaught = allClasses.filter(c => c.teacherId?.toString() === user._id.toString());
      } else if (user.role === 'student') {
        classesEnrolled = allClasses.filter(c =>
          c.students?.some(s => s.toString() === user._id.toString())
        );
      }

      return {
        ...user.toObject(),
        classesTaught,
        classesEnrolled
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
});

module.exports = router;

const CheckinSession = require("../models/CheckinSession");

exports.openSession = async (req, res) => {
  try {
    const { classId, openAt, closeAt, withTeacherFace, location, withMapPreview } = req.body;

    if (!openAt || !closeAt) {
      return res.status(400).json({ message: "❌ ต้องมีเวลาที่ชัดเจน" });
    }

    const open = new Date(openAt);
    const close = new Date(closeAt);

    if (isNaN(open) || isNaN(close)) {
      return res.status(400).json({ message: "❌ เวลาที่ระบุไม่ถูกต้อง" });
    }

    const overlap = await CheckinSession.findOne({
      classId,
      status: "active",
      $or: [
        { openAt: { $lt: close }, closeAt: { $gt: open } },
      ],
    });

    if (overlap) {
      return res.status(400).json({ message: "❌ มี session ที่ทับเวลาอยู่แล้ว" });
    }

    const session = await CheckinSession.create({
      classId,
      openAt: open,
      closeAt: close,
      withTeacherFace: !!withTeacherFace,
      withMapPreview: !!withMapPreview,
      status: "active",
      location: {
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        radiusInMeters: location?.radiusInMeters ?? 100,
        name: location?.name ?? null,
      },
    });

    res.status(201).json({ message: "✅ เปิดเวลาเช็คชื่อแล้ว", session });
  } catch (err) {
    res.status(500).json({ message: "❌ เปิด session ไม่สำเร็จ", error: err.message });
  }
};

exports.cancelSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await CheckinSession.findById(id);
    if (!session) return res.status(404).json({ message: "❌ ไม่พบ session" });

    session.status = "cancelled";
    await session.save();
    res.json({ message: "🚫 ยกเลิก session แล้ว" });
  } catch (err) {
    res.status(500).json({ message: "❌ ยกเลิกไม่สำเร็จ", error: err.message });
  }
};

exports.autoExpireSessions = async () => {
  try {
    const now = new Date();
    console.log("🕒 Running expire session check at:", now.toISOString());
    const expiredSessions = await CheckinSession.updateMany(
      { status: "active", closeAt: { $lt: now } },
      { $set: { status: "expired" } }
    );
    console.log(`⏰ อัปเดตหมดเวลาแล้ว: ${expiredSessions.modifiedCount} sessions`);
  } catch (err) {
    console.error("❌ ไม่สามารถอัปเดต session ที่หมดเวลา:", err.message);
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const now = new Date();
    const sessions = await CheckinSession.find({
      status: "active",
      openAt: { $lte: now },
      closeAt: { $gte: now },
    }).populate("classId", "courseName section");

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: "❌ โหลด session ไม่สำเร็จ", error: err.message });
  }
};

// controllers/checkinSessionController.js

exports.getActiveSessionByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const now = new Date();

    // เพิ่ม buffer เวลาเผื่อโหลดไม่ทัน
    const nowPlus10Sec = new Date(now.getTime() + 10000);
    const nowMinus10Sec = new Date(now.getTime() - 10000);

    const session = await CheckinSession.findOne({
      classId,
      status: "active",
      openAt: { $lte: nowPlus10Sec },     // เผื่อ session เปิดในไม่กี่วินี้
      closeAt: { $gte: nowMinus10Sec }    // เผื่อยังไม่ expired เป๊ะ ๆ
    });

    res.set("Cache-Control", "no-store");

    if (!session) return res.status(204).json();
    res.json(session);

  } catch (error) {
    res.status(500).json({
      message: "❌ ไม่สามารถโหลด session",
      error: error.message,
    });
  }
};

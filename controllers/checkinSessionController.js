const CheckinSession = require("../models/CheckinSession");

exports.openSession = async (req, res) => {
  try {
    const { classId, openAt, closeAt, withTeacherFace, location, withMapPreview } = req.body;

    if (!openAt || !closeAt) {
      return res.status(400).json({ message: "ต้องมีเวลาที่ชัดเจน" });
    }

    const open = new Date(openAt);
    const close = new Date(closeAt);

    const overlap = await CheckinSession.findOne({
      classId,
      status: "active",
      $or: [
        { openAt: { $lt: close }, closeAt: { $gt: open } },
      ],
    });

    if (overlap) {
      return res.status(400).json({ message: "มี session ที่ทับเวลาอยู่แล้ว" });
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
        radiusInMeters: location?.radiusInMeters ?? 50,
        name: location?.name ?? null,
      },
    });

    res.status(201).json({ message: "เปิดเวลาเช็คชื่อแล้ว", session });
  } catch (err) {
    res.status(500).json({ message: "เปิด session ไม่สำเร็จ", error: err.message });
  }
};

exports.cancelSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await CheckinSession.findById(id);
    if (!session) return res.status(404).json({ message: "ไม่พบ session" });

    session.status = "cancelled";
    await session.save();
    res.json({ message: "ยกเลิก session แล้ว" });
  } catch (err) {
    res.status(500).json({ message: "ยกเลิกไม่สำเร็จ", error: err.message });
  }
};

exports.autoExpireSessions = async () => {
  try {
    const now = new Date();
    const expiredSessions = await CheckinSession.updateMany(
      { status: "active", closeAt: { $lt: now } },
      { $set: { status: "expired" } }
    );
    console.log(`อัปเดตหมดเวลาแล้ว: ${expiredSessions.modifiedCount} sessions`);
  } catch (err) {
    console.error("ไม่สามารถอัปเดต session ที่หมดเวลา:", err.message);
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
    res.status(500).json({ message: "โหลด session ไม่สำเร็จ", error: err.message });
  }
};

exports.getActiveSessionByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const now = new Date();

    let session = await CheckinSession.findOne({
      classId,
      status: "active"
    });

    if (!session) return res.status(204).json({ message: "ไม่มี session ที่เปิดอยู่" });

    if (new Date(session.closeAt) < now) {
      session.status = "expired";
      await session.save();
      return res.status(204).json({ message: "session หมดเวลาแล้ว" });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: "ไม่สามารถโหลด session", error: error.message });
  }
};
// cron/sessionExpiry.js

const cron = require("node-cron");
const CheckinSession = require("../models/CheckinSession");

/**
 * Cron job to auto-expire check-in sessions
 * Runs every minute
 */
const startSessionExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      console.log("🔁 Cron job started");
      const now = new Date();
      console.log("🕒 Running expire session check:", now.toISOString());

      const result = await CheckinSession.updateMany(
        { status: { $eq: "active" }, closeAt: { $lt: now } },
        { $set: { status: "expired" } }
      );

      if (result.modifiedCount > 0) {
        console.log(`⏰ อัปเดตหมดเวลาแล้ว: ${result.modifiedCount} sessions`);
      } else {
        console.log("✅ ไม่มี session ที่หมดเวลา");
      }
    } catch (err) {
      console.error("❌ ไม่สามารถอัปเดต session ที่หมดเวลา:", err.message);
    }
  });
};

module.exports = { startSessionExpiryCron };

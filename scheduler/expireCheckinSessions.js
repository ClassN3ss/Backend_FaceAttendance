const cron = require("node-cron");
const CheckinSession = require("../models/CheckinSession");

const startSessionExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      console.log("🔁 Cron job started");
      const now = new Date();
      console.log("🕒 Running expire session check:", now.toISOString());
      const result = await CheckinSession.updateMany(
        { status: "active", closeAt: { $lt: now } },
        { $set: { status: "expired" } }
      );

      if (result.modifiedCount > 0) {
        console.log(`🕒 expired ${result.modifiedCount} checkin session(s)`);
      }
    } catch (err) {
      console.error("❌ Cron error:", err.message);
    }
  });
};

module.exports = { startSessionExpiryCron };

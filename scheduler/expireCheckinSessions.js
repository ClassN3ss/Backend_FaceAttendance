const cron = require("node-cron");
const CheckinSession = require("../models/CheckinSession");

const startSessionExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      console.log("🔁 Cron job started");
      const now = new Date();
      console.log("🕒 Now:", now.toISOString());

      const sessions = await CheckinSession.find({ status: "active" });

      sessions.forEach(session => {
        const closeAt = new Date(session.closeAt);
        const isExpired = closeAt < now;

        console.log("🧪 Session:", {
          id: session._id.toString(),
          closeAt: closeAt.toISOString(),
          now: now.toISOString(),
          status: session.status,
          expired: isExpired
        });
      });

      const result = await CheckinSession.updateMany(
        { status: "active", closeAt: { $lt: now } },
        { $set: { status: "expired" } }
      );

      if (result.modifiedCount > 0) {
        console.log(`✅ Updated ${result.modifiedCount} expired session(s)`);
      } else {
        console.log("✅ ไม่มี session ที่หมดเวลา");
      }

    } catch (err) {
      console.error("❌ Cron error:", err.message);
    }
  });
};

module.exports = { startSessionExpiryCron };

const fs = require("fs");
const csv = require("csv-parser");
const bcrypt = require("bcryptjs");

async function parseCSVAndHash(filePath) {
  const results = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        if (!row.username || !row.password || !row.fullName) return;

        results.push({
          studentId: row.username.trim(),
          passwordRaw: row.password,
          fullName: row.fullName.trim(),
          role: row.role || "student",
        });
      })
      .on("end", async () => {
        try {
          const hashedResults = await Promise.all(
            results.map(async (r) => ({
              studentId: r.studentId,
              password: await bcrypt.hash(r.passwordRaw, 10),
              fullName: r.fullName,
              role: r.role,
            }))
          );
          resolve(hashedResults);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);
  });
}

module.exports = { parseCSVAndHash };

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const faceRoutes = require("./routes/faceRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const userRoutes = require("./routes/userRoutes");
const classRoutes = require("./routes/classRoutes");
const enrollRoutes = require("./routes/enrollRoutes");
const enrollRequestRoutes = require("./routes/enrollRequestRoutes");
const searchRoutes = require("./routes/searchRoutes");
const uploadRoutes = require("./routes/uploadStudents");
const checkinSessionRoutes = require("./routes/checkinSessionRoutes");

const { startSessionExpiryCron } = require("./scheduler/expireCheckinSessions");
startSessionExpiryCron();

dotenv.config();

const app = express();
app.use(express.json());

const allowedOrigins = [
  'http://localhost:3000',
  'https://project-face-attendance.vercel.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(helmet());
app.use(morgan("dev"));

const connectDB = require("./configuration/database/db");
connectDB();

app.use("/auth", authRoutes);

app.use("/api/students", faceRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use("/api", userRoutes);

app.use("/api/classes", classRoutes);
app.use("/api/enrollments", enrollRequestRoutes);
app.use("/api/enrolls", enrollRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/checkin-sessions", checkinSessionRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

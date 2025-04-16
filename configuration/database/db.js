const mongoose = require("mongoose");
const config = require("../config");

const connectDB = async () => {
  try {
    console.log("DB URI:", config.database.uri);
    await mongoose.connect(config.database.uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

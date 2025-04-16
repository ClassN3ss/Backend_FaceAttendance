module.exports = {
  appName: "Face Attendance System",

  jwt: {
    secret: process.env.JWT_SECRET || "default_secret_key",
    expiresIn: "1d",
  },

  database: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/facescan",
  },

  roles: {
    admin: "admin",
    teacher: "teacher",
    student: "student",
  },

  face: {
    descriptorLength: 128,
  },
};

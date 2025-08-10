module.exports = {
  appName: "Face Attendance System",

  jwt: {
    secret: process.env.JWT_SECRET || "default_secret_key",
    expiresIn: "1d",
  },

  database: {
    uri: process.env.MONGO_URI || "mongodb+srv://Aadmin:facescan_ab@cluster0.7jxizye.mongodb.net/facescan?retryWrites=true&w=majority&appName=Cluster0",
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

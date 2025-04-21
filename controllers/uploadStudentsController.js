const parseCSV = require('../utils/parseCSV');
const User = require('../models/User');
const path = require('path');

exports.uploadCSV = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '❌ No file uploaded' });

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const parsedUsers = await parseCSV.parseCSVAndHash(filePath);

    const inserted = [];

    for (const userData of parsedUsers) {
      const exists = await User.findOne({ username: userData.username });
      if (exists) continue;

      const user = new User({
        studentId: userData.username,             
        fullName: userData.fullName,              
        password_hash: userData.password,          
        role: userData.role || 'student',
      });

      await user.save();
      inserted.push(user.username);
    }

    res.json({ message: '✅ Students created', count: inserted.length, inserted });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ message: '❌ Failed to upload students', error: err.message });
  }
};

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, required: true, default: "/profile1.svg" },
  level: { type: Number, required: true, default: 1 }, // เริ่มที่ Level 1
});

module.exports = mongoose.model('User', UserSchema);
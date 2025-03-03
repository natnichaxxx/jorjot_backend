const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const config = require('../config');

const availableProfiles = [
  "/profile1.svg", "/profile2.svg", "/profile3.svg", "/profile4.svg",
  "/profile5.svg", "/profile6.svg", "/profile7.svg", "/profile8.svg", "/profile9.svg"
];

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    let user = await User.findOne({ name, email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({ name, email, password: hashedPassword, profileImage: "/profile1.svg", level: 1 });
    await user.save();

    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { name, password } = req.body;

  try {
    let user = await User.findOne({ name });
    if (!user) {
      return res.status(400).json({ message: "Invalid Username" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect Password" });
    }

    const token = jwt.sign({ userId: user._id }, config.secrets, { expiresIn: "7d" });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// เปลี่ยนชื่อ
router.put('/change-name', authMiddleware, async (req, res) => {
  const { newName } = req.body;

  if (!newName) {
    return res.status(400).json({ message: "New name is required" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = newName;
    await user.save();

    res.json({ message: "Name updated successfully", name: newName });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ดึงชื่อ && profileImage && level
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // กำหนดชื่อของระดับ (level)
    const levelNames = {
      1: "เบบี้ลิงจ๋อ",
      2: "ลิงจ๋อหัดเดิน",
      3: "ลิงจ๋อวัยแรกรุ่น",
      4: "ลิงจ๋อติดแกลม",
      5: "ลิงจ๋อทองคำ"
    };

    // กำหนดระดับ (level)
    const levelNum = {
      1: "ระดับเริ่มต้น",
      2: "ระดับ 2",
      3: "ระดับ 3",
      4: "ระดับ 4",
      5: "ระดับ 5"
    };

    const userLevelName = levelNames[user.level] || "ระดับไม่ระบุ";
    const userLevelNum = levelNum[user.level] || "ระดับไม่ระบุ";

    res.json({ name: user.name, profileImage: user.profileImage, level: userLevelName, levelNum: userLevelNum });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// เปลี่ยนรหัสผ่าน
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newpassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newpassword || !confirmNewPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (newpassword !== confirmNewPassword) {
    return res.status(400).json({ message: "New passwords do not match" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newpassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Logout (Client ต้องลบ Token เอง)
router.post('/logout', (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// เปลี่ยนรูปโปรไฟล์
router.put('/profile', authMiddleware, async (req, res) => {
  const profileImage = req.body.profileImage;

  if (!availableProfiles.includes(profileImage)) {
    return res.status(400).json({ message: "Invalid profile image selection" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profileImage = profileImage;
    await user.save();

    res.json({ message: "Profile image updated successfully", profileImage });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
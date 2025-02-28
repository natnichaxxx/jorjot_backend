const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.js');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// บันทึกค่ารายรับรายจ่าย
router.post('/', authMiddleware, async (req, res) => {
    try {
        console.log("UserId:", req.user.userId);
        console.log("Received Data:", req.body); // ตรวจสอบค่าที่ได้รับ
        const { transaction_type, amount, category, wallet, date } = req.body;
        
        if (!transaction_type || !amount || !category || !wallet || !date) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newTransaction = new Transaction({
            user: req.user.userId,
            transaction_type,
            amount,
            category,
            wallet,
            date
        });

        await newTransaction.save();
        res.status(201).json(newTransaction);
    } catch (error) {
        console.error("Error Saving Transaction:", error); // แสดง error
        res.status(500).json({ error: "Server error" });
    }
});

// ดึงข้อมูลธุรกรรมทั้งหมดของผู้ใช้ที่ล็อกอินอยู่
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('🛠 User from Middleware:', req.user.userId);

        // ค้นหาธุรกรรมที่เป็นของผู้ใช้คนนี้
        const transactions = await Transaction.find({ user: req.user.userId }).sort({ date: -1 });

        res.json({
            user: req.user.userId, // แสดง userId ของผู้ใช้ที่ดึงข้อมูล
            transactions
        });
    } catch (error) {
        console.error('❌ Error in GET /transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// แก้ไขค่ารายรับรายจ่าย
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // ตรวจสอบว่าธุรกรรมเป็นของผู้ใช้ที่ล็อกอินอยู่หรือไม่
        const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.userId });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }

        // อัปเดตข้อมูลธุรกรรม
        const updatedTransaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json(updatedTransaction);
    } catch (err) {
        console.error('Error in PUT /transactions/:id:', err);
        res.status(500).json({ error: err.message });
    }
});


// ลบค่ารายรับรายจ่าย
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // ตรวจสอบว่าธุรกรรมเป็นของผู้ใช้ที่ล็อกอินอยู่หรือไม่
        const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.userId });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }

        // ลบธุรกรรม
        await Transaction.findByIdAndDelete(req.params.id);
        res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
        console.error('Error in DELETE /transactions/:id:', err);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;

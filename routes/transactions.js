const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.js');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// บันทึกธุรกรรม
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
        console.error("Error Saving Transaction:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ดึงข้อมูลของผู้ใช้ที่ล็อกอินอยู่
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('UserId:', req.user.userId);

        const { year, month } = req.query; // รับค่า year และ month จาก query string
        let filter = { user: req.user.userId };

        // กรองข้อมูลyear และ month
        if (year || month) {
            let startDate, endDate;

            if (year && month) {
                // ค้นหาธุรกรรมเฉพาะเดือนและปีที่ระบุ
                startDate = new Date(year, month - 1, 1); // วันที่ 1 ของเดือนที่เลือก
                endDate = new Date(year, month, 1); // วันที่ 1 ของเดือนถัดไป
            } else if (year) {
                // ค้นหาธุรกรรมของทั้งปี
                startDate = new Date(year, 0, 1); // วันที่ 1 มกราคมของปีที่เลือก
                endDate = new Date(parseInt(year) + 1, 0, 1); // วันที่ 1 มกราคมของปีถัดไป
            }

            filter.date = { $gte: startDate, $lt: endDate }; // กรองช่วงวันที่
        }

        // ค้นหาธุรกรรมของผู้ใช้
        const transactions = await Transaction.find(filter).sort({ date: -1 });

        res.json({
            user: req.user.userId,
            transactions
        });
    } catch (error) {
        console.error('Error in GET /transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// แก้ไขธุรกรรม
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        // ตรวจสอบว่าธุรกรรมเป็นของผู้ใช้ที่ล็อกอินอยู่
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

// ลบธุรกรรม
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // ตรวจสอบว่าธุรกรรมเป็นของผู้ใช้ที่ล็อกอินอยู่
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

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

// API ใหม่: ดึงธุรกรรมตามปีและเดือน พร้อมสรุปยอดตามหมวดหมู่
router.get('/category', authMiddleware, async (req, res) => {
    try {
        console.log('UserId:', req.user.userId);

        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({ error: "Year and month are required" });
        }

        let startDate = new Date(year, month - 1, 1);
        let endDate = new Date(year, month, 1);

        // กรองธุรกรรมของผู้ใช้เฉพาะปีและเดือนที่เลือก
        const filter = {
            user: req.user.userId,
            date: { $gte: startDate, $lt: endDate }
        };

        const transactions = await Transaction.find(filter);

        // จัดกลุ่มธุรกรรมตามหมวดหมู่ และคำนวณยอดรวมของแต่ละหมวดหมู่
        const categorySummary = transactions.reduce((acc, transaction) => {
            const { category, amount, transaction_type } = transaction;
            if (!acc[category]) {
                acc[category] = { total: 0, transactions: [] };
            }
            acc[category].total += transaction_type === 'income' ? amount : -amount;
            acc[category].transactions.push(transaction);
            return acc;
        }, {});

        res.json({
            user: req.user.userId,
            category: categorySummary
        });
    } catch (error) {
        console.error('Error in GET /transactions/summary:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ดึงข้อมูลยอดเงินคงเหลือ GET /transactions/balance
router.get('/balance', authMiddleware, async (req, res) => {
    try {
        const { wallet } = req.query;
        let filter = { user: req.user.userId };

        if (wallet) {
            filter.wallet = wallet;
        }

        const transactions = await Transaction.find(filter);

        // GET /transactions/balance?wallet=cash
        const balance = transactions.reduce((total, tx) => {
            return tx.transaction_type === 'income' ? total + tx.amount : total - tx.amount;
        }, 0);

        res.json({ user: req.user.userId, balance, wallet: wallet || "all" });
    } catch (error) {
        console.error('Error in GET /transactions/balance:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// ดึงรายรับและรายจ่ายของวันนี้ของวันปัจจุบัน GET /transactions/today
router.get('/today', authMiddleware, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const transactions = await Transaction.find({
            user: req.user.userId,
            date: { $gte: today, $lt: tomorrow }
        });

        const incomeToday = transactions
            .filter(tx => tx.transaction_type === 'income')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const expenseToday = transactions
            .filter(tx => tx.transaction_type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0);

        res.json({ user: req.user.userId, incomeToday, expenseToday });
    } catch (error) {
        console.error('Error in GET /transactions/today:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ดึงจำนวนเงินที่เหลือในแต่ละกระเป๋า GET /transactions/wallets
router.get('/wallets', authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.userId });
        const walletSummary = transactions.reduce((acc, tx) => {
            if (!acc[tx.wallet]) {
                acc[tx.wallet] = 0;
            }
            acc[tx.wallet] += tx.transaction_type === 'income' ? tx.amount : -tx.amount;
            return acc;
        }, {});

        res.json({ user: req.user.userId, wallets: walletSummary });
    } catch (error) {
        console.error('Error in GET /transactions/wallets:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ดึงธุรกรรมแยกเป็นรายวัน GET /transactions/daily?date=YYYY-MM-DD
router.get('/daily', authMiddleware, async (req, res) => {
    try {
        console.log('UserId:', req.user.userId);

        const { date, wallet } = req.query;
        if (!date) {
            return res.status(400).json({ error: "Date is required (YYYY-MM-DD)" });
        }

        // แปลง string เป็น Date และกำหนดช่วงเวลา 00:00 - 23:59
        let startDate = new Date(date);
        let endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        let filter = {
            user: req.user.userId,
            date: { $gte: startDate, $lt: endDate }
        };

        if (wallet) {
            filter.wallet = wallet;
        }

        // ค้นหาธุรกรรมที่อยู่ในวันนั้น
        const transactions = await Transaction.find(filter).sort({ date: -1 });

        res.json({
            date,
            user: req.user.userId,
            transactions
        });
    } catch (error) {
        console.error('Error in GET /transactions/daily:', error);
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

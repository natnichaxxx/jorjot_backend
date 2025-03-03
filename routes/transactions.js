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
        res.status(200).json(newTransaction);
    } catch (error) {
        console.error("Error Saving Transaction:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const transactions = await Transaction.find({ user: userId });

        // คำนวณยอดรวมโดยการบวกลบเลขของ amount ตามประเภทของธุรกรรม
        const totalAmount = transactions.reduce((acc, transaction) => {
            return transaction.transaction_type === 'รายรับ' ? acc + transaction.amount : acc - transaction.amount;
        }, 0);

        const filteredTransactions = transactions.map(transaction => ({
            transaction_type: transaction.transaction_type,
            amount: transaction.amount,
            category: transaction.category,
            wallet: transaction.wallet,
            date: transaction.date,
            createdAt: transaction.createdAt
        }));

        res.send({data: filteredTransactions, totalAmount: totalAmount});

    } catch (e) {
        console.log(e.message);
    }
});

router.get('/wallet', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const transactions = await Transaction.find({ user: userId });
        console.log(transactions);

        // คำนวณยอดรวมของแต่ละ wallet
        const walletSummary = transactions.reduce((acc, transaction) => {
            const { wallet, amount, transaction_type } = transaction;
            if (!acc[wallet]) {
                acc[wallet] = 0;
            }
            acc[wallet] += transaction_type === 'รายรับ' ? amount : -amount;
            return acc;
        }, {});

        res.json(walletSummary);

        res.json(filteredTransactions);

    } catch (e) {
        console.log(e.message);
    }
});


// ดึงธุรกรรมตามปีและเดือน พร้อมสรุปยอดตามหมวดหมู่
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

const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

// ระยะเวลาของแต่ละระดับ
const challengeLevels = {
    1: { months: 3 },
    2: { months: 6 },
    3: { months: 9 },
    4: { months: 12 },
};

// สร้าง Challenge ใหม่
router.post('/start', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { monthlyTarget } = req.body;

        if (!monthlyTarget || monthlyTarget <= 0) {
            return res.status(400).json({ error: "Invalid monthly target amount" });
        }

        // หาระดับปัจจุบันของผู้ใช้
        let currentChallenge = await Challenge.findOne({ user: userId, completed: false });

        let currentLevel = currentChallenge ? currentChallenge.level : 1;
        if (currentLevel >= 5) {
            return res.status(400).json({ error: "Already at the maximum level" });
        }

        let monthsRequired = challengeLevels[currentLevel].months;
        let endDate = new Date();
        endDate.setMonth(endDate.getMonth() + monthsRequired);

        const newChallenge = new Challenge({
            user: userId,
            level: currentLevel,
            monthlyTarget,
            monthsRequired,
            endDate
        });

        await newChallenge.save();
        res.status(201).json({ message: "Challenge started!", challenge: newChallenge });

    } catch (error) {
        console.error("Error starting challenge:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ตรวจสอบสถานะ Challenge
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        let activeChallenge = await Challenge.findOne({ user: userId, completed: false });

        if (!activeChallenge) {
            return res.status(404).json({ error: "No active challenge found" });
        }

        let currentDate = new Date();
        let challengeStartDate = new Date(activeChallenge.startDate);
        let monthsPassed = Math.floor((currentDate - challengeStartDate) / (1000 * 60 * 60 * 24 * 30)); // คำนวณเดือนที่ผ่านไป

        let successfulMonths = 0;
        let successfulMonthNames = []; // เก็บเดือนที่ทำสำเร็จ

        for (let i = 0; i <= monthsPassed; i++) {
            let monthStart = new Date(challengeStartDate);
            monthStart.setMonth(monthStart.getMonth() + i);
            monthStart.setHours(0, 0, 0, 0);

            let monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            monthEnd.setHours(23, 59, 59, 999);

            // ดึงธุรกรรมในเดือนนั้น
            const transactions = await Transaction.find({
                user: userId,
                date: { $gte: monthStart, $lt: monthEnd }
            });

            // คำนวณยอดเงินคงเหลือ
            const totalIncome = transactions
                .filter(tx => tx.transaction_type === "income")
                .reduce((sum, tx) => sum + tx.amount, 0);

            const totalExpense = transactions
                .filter(tx => tx.transaction_type === "expense")
                .reduce((sum, tx) => sum + tx.amount, 0);

            const balance = totalIncome - totalExpense;

            if (balance >= activeChallenge.monthlyTarget) {
                successfulMonths++;

            // แปลงเดือนเป็นชื่อ เช่น "2024-03" → "March 2024"
            let monthName = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            successfulMonthNames.push(monthName);

            }
        }

         // แสดงผลเดือนที่ทำสำเร็จใน console
         if (successfulMonthNames.length > 0) {
            console.log(`🎉 Challenge success in: ${successfulMonthNames.join(', ')}`);
        } else {
            console.log("⚠️ No successful challenge months yet.");
        }

        // ตรวจสอบว่าเก็บครบทุกเดือนตามที่กำหนดหรือไม่
        if (successfulMonths >= activeChallenge.monthsRequired) {
            activeChallenge.completed = true;
            await activeChallenge.save();

            if (activeChallenge.level < 5) {
                const nextLevel = activeChallenge.level + 1;
                let newMonthsRequired = challengeLevels[nextLevel].months;
                let newEndDate = new Date();
                newEndDate.setMonth(newEndDate.getMonth() + newMonthsRequired);

                const newChallenge = new Challenge({
                    user: userId,
                    level: nextLevel,
                    monthlyTarget: activeChallenge.monthlyTarget,
                    monthsRequired: newMonthsRequired,
                    endDate: newEndDate
                });

                await newChallenge.save();
            }

            return res.json({ message: "Challenge completed!", newLevel: activeChallenge.level + 1 });
        }

        res.json({
            message: "Challenge in progress",
            successfulMonths,
            targetMonths: activeChallenge.monthsRequired
        });

    } catch (error) {
        console.error("Error checking challenge status:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ดูยอดเงินคงเหลือของเดือนที่ต้องการ
router.get('/monthly', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { year, month } = req.query;

        // ตรวจสอบว่ามีการส่งค่าปีและเดือนหรือไม่
        if (!year || !month) {
            return res.status(400).json({ error: "Please provide 'year' and 'month' in the query parameters" });
        }

        // แปลงค่าเป็นตัวเลข
        const yearInt = parseInt(year, 10);
        const monthInt = parseInt(month, 10);

        if (isNaN(yearInt) || isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
            return res.status(400).json({ error: "Invalid 'year' or 'month' format" });
        }

        // กำหนดช่วงเวลาเป็นต้นเดือน - สิ้นเดือน
        const startDate = new Date(yearInt, monthInt - 1, 1, 0, 0, 0);
        const endDate = new Date(yearInt, monthInt, 0, 23, 59, 59); // วันที่ 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนที่เลือก

        // ค้นหาธุรกรรมที่อยู่ในช่วงเดือนที่เลือก
        const transactions = await Transaction.find({
            user: userId,
            date: { $gte: startDate, $lte: endDate }
        });

        // คำนวณยอดเงินคงเหลือ
        const totalIncome = transactions
            .filter(tx => tx.transaction_type === "income")
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalExpense = transactions
            .filter(tx => tx.transaction_type === "expense")
            .reduce((sum, tx) => sum + tx.amount, 0);

        const balance = totalIncome - totalExpense;

        res.json({
            year: yearInt,
            month: monthInt,
            income: totalIncome,
            expense: totalExpense,
            balance
        });

    } catch (error) {
        console.error("Error fetching monthly balance:", error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
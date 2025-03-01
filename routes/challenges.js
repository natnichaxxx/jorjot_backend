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

// กำหนดให้ startDate เป็นวันที่ 1 ของเดือนเสมอ
const getChallengeStartDate = () => {
    let today = new Date();
    today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็น 00:00:00

    if (today.getDate() === 1) {
        return today; // ถ้าวันนี้เป็นวันที่ 1 ใช้วันนี้เลย
    }

    // ใช้ Date.UTC() เพื่อให้เริ่มต้นที่ UTC เสมอ และบังคับให้เป็นวันที่ 1
    let nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return nextMonth;
};

// เริ่ม Challenge
router.post('/start', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { monthlyTarget } = req.body;

        if (!monthlyTarget || monthlyTarget <= 0) {
            return res.status(400).json({ error: "Invalid monthly target amount" });
        }

        let currentChallenge = await Challenge.findOne({ user: userId, completed: false });

        let currentLevel = currentChallenge ? currentChallenge.level : 1;
        if (currentLevel >= 5) {
            return res.status(400).json({ error: "Already at the maximum level" });
        }

        let monthsRequired = challengeLevels[currentLevel].months;
        let startDate = getChallengeStartDate(); // ใช้ฟังก์ชันที่แก้ไขแล้ว

        // คำนวณ endDate ให้เป็นวันสุดท้ายของเดือนรองสุดท้าย
        let endDate = new Date(startDate);
        endDate.setUTCMonth(endDate.getUTCMonth() + monthsRequired - 1); // ไปเดือนรองสุดท้าย
        endDate.setUTCDate(1); // ตั้งเป็นวันที่ 1 ของเดือนนั้นก่อน
        endDate.setUTCMonth(endDate.getUTCMonth() + 1); // เลื่อนไปเดือนถัดไป
        endDate.setUTCDate(0); // ได้วันสุดท้ายของเดือนรองสุดท้าย
        endDate.setUTCHours(23, 59, 59, 999); // ตั้งเป็น 23:59:59

        console.log(`🎯 Challenge Start Date (Fixed): ${startDate.toISOString()}`);
        console.log(`🏁 Challenge End Date (Fixed): ${endDate.toISOString()}`);

        const newChallenge = new Challenge({
            user: userId,
            level: currentLevel,
            monthlyTarget,
            monthsRequired,
            startDate,
            endDate
        });

        await newChallenge.save();
        res.status(201).json({ message: "Challenge started!", challenge: newChallenge });

    } catch (error) {
        console.error("Error starting challenge:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ผู้ใช้ต้องกำหนด monthlyTarget ใหม่ก่อนเริ่มชาเลนจ์ระดับถัดไป
router.post('/continue', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { monthlyTarget } = req.body;

        if (!monthlyTarget || monthlyTarget <= 0) {
            return res.status(400).json({ error: "Invalid monthly target amount" });
        }

        // ค้นหา Challenge ที่สำเร็จล่าสุด
        let lastChallenge = await Challenge.findOne({ user: userId, completed: true }).sort({ endDate: -1 });

        if (!lastChallenge || lastChallenge.level >= 5) {
            return res.status(400).json({ error: "No eligible challenge to continue or maximum level!" });
        }

        const nextLevel = lastChallenge.level + 1;
        let newMonthsRequired = challengeLevels[nextLevel].months;
        let startDate = getChallengeStartDate();

        // คำนวณวันสิ้นสุด
        let newEndDate = new Date(startDate);
        newEndDate.setUTCMonth(newEndDate.getUTCMonth() + newMonthsRequired - 1);
        newEndDate.setUTCDate(1);
        newEndDate.setUTCMonth(newEndDate.getUTCMonth() + 1);
        newEndDate.setUTCDate(0);
        newEndDate.setUTCHours(23, 59, 59, 999);

        console.log(`🏆 New Challenge Level: ${nextLevel}, Start Date: ${startDate.toISOString()}, End Date: ${newEndDate.toISOString()}`);

        // สร้างชาเลนจ์ใหม่
        const newChallenge = new Challenge({
            user: userId,
            level: nextLevel,
            monthlyTarget,
            monthsRequired: newMonthsRequired,
            startDate,
            endDate: newEndDate
        });

        await newChallenge.save();
        res.status(201).json({ message: "Next challenge started!", challenge: newChallenge });

    } catch (error) {
        console.error("Error continuing challenge:", error);
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
            monthStart.setUTCMonth(monthStart.getUTCMonth() + i);
            monthStart.setUTCDate(1); // ตั้งค่าเป็นวันที่ 1 ของเดือน
            monthStart.setUTCHours(0, 0, 0, 0);

            let monthEnd = new Date(monthStart);
            monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
            monthEnd.setUTCDate(0); // วันสุดท้ายของเดือน
            monthEnd.setUTCHours(23, 59, 59, 999);

            // ดึงธุรกรรมในเดือนนั้น
            const transactions = await Transaction.find({
                user: userId,
                date: { $gte: monthStart, $lte: monthEnd }
            });

            // คำนวณยอดเงินคงเหลือ
            const totalIncome = transactions
                .filter(tx => tx.transaction_type === "income")
                .reduce((sum, tx) => sum + tx.amount, 0);

            const totalExpense = transactions
                .filter(tx => tx.transaction_type === "expense")
                .reduce((sum, tx) => sum + tx.amount, 0);

            const balance = totalIncome - totalExpense;

            // ถ้าเดือนใดไม่ถึงเป้า ให้ล้มเหลวทันที
            if (balance < activeChallenge.monthlyTarget) {
                await Challenge.findByIdAndDelete(activeChallenge._id); // ลบ Challenge ออกไป
                return res.status(400).json({ error: `Challenge failed in ${monthStart.toISOString().slice(0, 7)}` });
            }

            // ถ้าผ่านเป้า นับเป็นเดือนที่สำเร็จ
                successfulMonths++;

                // แปลงเดือนเป็นชื่อ เช่น "2024-03" → "March 2024"
                let monthName = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                successfulMonthNames.push(monthName);
            
        }

        console.log(`🎯 Successful Challenge Months: ${successfulMonthNames.join(', ')}`);

        // ตรวจสอบว่าเก็บครบทุกเดือนตามที่กำหนดหรือไม่
        if (successfulMonths >= activeChallenge.monthsRequired) {
            activeChallenge.completed = true;
            await activeChallenge.save();

            if (activeChallenge.level < 5) {
                const nextLevel = activeChallenge.level + 1;
                let newMonthsRequired = challengeLevels[nextLevel].months;
                let startDate = getChallengeStartDate(); // ใช้ฟังก์ชันคำนวณวันเริ่มต้น

                // คำนวณ newEndDate ให้เป็นวันสุดท้ายของเดือนรองสุดท้าย
                let newEndDate = new Date(startDate);
                newEndDate.setUTCMonth(newEndDate.getUTCMonth() + newMonthsRequired - 1);
                newEndDate.setUTCDate(1); // วันที่ 1 ของเดือน
                newEndDate.setUTCMonth(newEndDate.getUTCMonth() + 1); // ขยับไปเดือนถัดไป
                newEndDate.setUTCDate(0); // วันสุดท้ายของเดือนรองสุดท้าย
                newEndDate.setUTCHours(23, 59, 59, 999);

                console.log(`🏆 New Challenge Level: ${nextLevel}, Start Date: ${startDate.toISOString()}, End Date: ${newEndDate.toISOString()}`);

                const newChallenge = new Challenge({
                    user: userId,
                    level: nextLevel,
                    monthlyTarget: activeChallenge.monthlyTarget,
                    monthsRequired: newMonthsRequired,
                    startDate,
                    endDate: newEndDate
                });

                await newChallenge.save();
            }

            return res.json({ message: "Challenge completed!", newLevel: activeChallenge.level + 1 });
        }

        res.json({
            user: userId,
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

        if (!year || !month) {
            return res.status(400).json({ error: "Please provide 'year' and 'month' in the query parameters" });
        }

        const yearInt = parseInt(year, 10);
        const monthInt = parseInt(month, 10);

        if (isNaN(yearInt) || isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
            return res.status(400).json({ error: "Invalid 'year' or 'month' format" });
        }

        // กำหนดวันที่ปัจจุบัน
        const today = new Date();
        const currentYear = today.getUTCFullYear();
        const currentMonth = today.getUTCMonth() + 1; // getUTCMonth() เริ่มจาก 0

        // ตรวจสอบว่าผู้ใช้กำลังขอดูยอดเงินของเดือนที่ยังไม่สิ้นสุดหรือไม่
        if (currentYear < yearInt || (currentYear === yearInt && currentMonth <= monthInt)) {
            return res.status(400).json({ error: "Balance for this month is not yet available. Please wait until the next month." });
        }

        // กำหนดช่วงเวลาเป็นต้นเดือน - สิ้นเดือน (ใช้ UTC)
        const startDate = new Date(Date.UTC(yearInt, monthInt - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(yearInt, monthInt, 0, 23, 59, 59));

        console.log(`🔍 Fetching balance for: ${startDate.toISOString()} - ${endDate.toISOString()}`);

        // ค้นหาธุรกรรมของผู้ใช้ในช่วงเดือนที่เลือก
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
            user: userId,
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

// ดึงข้อมูลวันเริ่มต้นและวันสิ้นสุดของ Challenge
router.get('/dates', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // ค้นหา Challenge ที่ยังไม่สำเร็จของผู้ใช้
        let activeChallenge = await Challenge.findOne({ user: userId, completed: false });

        if (!activeChallenge) {
            return res.status(404).json({ error: "No active challenge found" });
        }

        let startDate = new Date(activeChallenge.startDate); // ใช้ค่าที่บันทึกไว้แล้ว
        let monthsRequired = activeChallenge.monthsRequired; // ดึงค่าจาก Challenge

        // คำนวณ endDate ให้เป็นวันสุดท้ายของเดือนรองสุดท้าย
        let endDate = new Date(startDate);
        endDate.setUTCMonth(endDate.getUTCMonth() + monthsRequired - 1); // ไปเดือนรองสุดท้าย
        endDate.setUTCDate(1); // ตั้งเป็นวันที่ 1 ของเดือนนั้นก่อน
        endDate.setUTCMonth(endDate.getUTCMonth() + 1); // เลื่อนไปเดือนถัดไป
        endDate.setUTCDate(0); // ได้วันสุดท้ายของเดือนรองสุดท้าย
        endDate.setUTCHours(23, 59, 59, 999); // ตั้งเป็น 23:59:59

        res.json({
            user: userId,
            message: "Challenge dates retrieved",
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

    } catch (error) {
        console.error("Error fetching challenge dates:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ดึงค่า monthlyTarget ของ Challenge ปัจจุบัน
router.get('/target', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // ค้นหา Challenge ที่ยังไม่สำเร็จของผู้ใช้
        let activeChallenge = await Challenge.findOne({ user: userId, completed: false });

        if (!activeChallenge) {
            return res.status(404).json({ error: "No active challenge found" });
        }

        res.json({
            user: userId,
            message: "Challenge target retrieved",
            monthlyTarget: activeChallenge.monthlyTarget
        });

    } catch (error) {
        console.error("Error fetching challenge target:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ดึงค่า level ปัจจุบันของ Challenge
router.get('/level', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // ค้นหา Challenge ที่ยังไม่สำเร็จของผู้ใช้
        let activeChallenge = await Challenge.findOne({ user: userId, completed: false });

        if (!activeChallenge) {
            return res.status(404).json({ error: "No active challenge found" });
        }

        res.json({
            user: userId,
            message: "Current challenge level retrieved",
            level: activeChallenge.level
        });

    } catch (error) {
        console.error("Error fetching challenge level:", error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
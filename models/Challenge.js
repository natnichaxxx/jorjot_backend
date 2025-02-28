const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    level: { type: Number, required: true, default: 1 }, // เริ่มที่ Level 1
    monthlyTarget: { type: Number, required: true }, // เป้าหมายที่ต้องเก็บในแต่ละเดือน
    startDate: { type: Date, default: Date.now }, // วันเริ่มต้นชาเลนจ์
    monthsRequired: { type: Number, required: true }, // จำนวนเดือนที่ต้องทำให้สำเร็จ
    completedMonths: { type: Number, default: 0 }, // จำนวนเดือนที่สำเร็จแล้ว
    endDate: { type: Date, required: true }, // วันจบชาเลนจ์
    completed: { type: Boolean, default: false }, // สำเร็จหรือไม่
});
//{ timestamps: true });

module.exports = mongoose.model('Challenge', challengeSchema);
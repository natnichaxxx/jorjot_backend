const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transaction_type: { type: String, enum: ['รายรับ', 'รายจ่าย'] , required: true}, // รายรับหรือรายจ่าย
    amount:  Number,
    category: { 
        type: String,
        enum: ["อาหาร", "ช้อปปิ้ง", "จ่ายบิล", "เดินทาง", "บันเทิง", "เที่ยว", "เงินเก็บ", "อื่นๆ"], 
        required: true 
    },
    wallet: { 
        type: String,
        enum: ['เงินสด', 'บัญชีธนาคาร', 'บัตรเครดิต', 'เงินออม', 'เงินลงทุน'], 
        required: true 
    },
    date: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);

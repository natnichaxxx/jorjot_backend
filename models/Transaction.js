const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transaction_type: { type: String, enum: ['income', 'expense'] , required: true}, // รายรับหรือรายจ่าย
    amount:  Number,
    category: { 
        type: String,
        enum: ['food', 'shopping', 'bills', 'transportation', 'entertainment', 'travel', 'savings', 'other'], 
        required: true 
    },
    wallet: { 
        type: String,
        enum: ['cash', 'bank_account', 'savings', 'credit_card', 'investment'], 
        required: true 
    },
    date: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);

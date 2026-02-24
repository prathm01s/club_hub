const mongoose = require("mongoose");

const PasswordResetRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    userName: {
        type: String
    },
    userRole: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    // Populated only after admin approves – shown once then cleared
    generatedPassword: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);

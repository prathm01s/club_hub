const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
    // COMMON FIELDS
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['participant', 'organizer', 'admin'],
        default: 'participant'
    },
    // PARTICIPANT FIELDS
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    contactNumber: {
        type: Number
    },
    collegeName: {
        type: String
    },
    isIIIT: {
        type: Boolean,
        default: false,
    },
    // ORGANIZER FIELDS
    organizerName: {
        type: String
    },
    organizerCategory: {
        type: String
    },
    description: {
        type: String
    },
    contactEmail: {
        type: String
    },
    discordWebhook: { type: String },
    isActive: {
        type: Boolean,
        default: true
    },
    // <--- NEW: PREFERENCES --->
    interests: {
        type: [String], // e.g., ["Coding", "Music", "Art"]
        default: []
    },
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // List of Organizers they follow
    }],
    onboardingComplete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
module.exports = mongoose.model('User', UserSchema);
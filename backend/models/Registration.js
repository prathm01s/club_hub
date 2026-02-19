const mongoose = require("mongoose");
const RegistrationSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ticketId: {
        type: String,
        unique: true,
        required: true
    },
    status: {
        type: String,
        enum: ['registered', 'cancelled', 'attended'],
        default: 'registered'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    // for merchandise events
    quantity: {
        type: Number,
        default: 1, // Normal events = 1. Merch can be > 1.
        min: 1
    },

    // <--- NEW: Store form answers here --->
    // Example: { "Github Profile": "github.com/rahul", "Diet": "Veg" }
    responses: {
        type: Map,
        of: String 
    },

    // Optional team name for team-based events
    teamName: {
        type: String,
        default: ''
    }
}, {timestamps : true});
RegistrationSchema.index({ event: 1, user: 1}, {unique: true});
module.exports = mongoose.model("Registration", RegistrationSchema);
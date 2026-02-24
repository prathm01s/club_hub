const mongoose = require("mongoose");

// Stores each member's form responses before the team completes
const MemberResponseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responses: { type: Map, of: String, default: {} }
}, { _id: false });

const TeamSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    event:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    leader:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Array of user IDs that have ACCEPTED (including leader)
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Per-member form responses, collected at join time
    memberResponses: [MemberResponseSchema],
    targetSize:  { type: Number, required: true },
    inviteCode:  { type: String, required: true, unique: true },
    // Specific email invites sent by the leader
    invites: [{
        email: { type: String, required: true },
        status: { type: String, enum: ['pending', 'joined'], default: 'pending' }
    }],
    // 'forming'   = open for members to join
    // 'completed' = all slots filled; Registration docs created for all members
    status:      { type: String, enum: ['forming', 'completed'], default: 'forming' }
}, { timestamps: true });

module.exports = mongoose.model('Team', TeamSchema);
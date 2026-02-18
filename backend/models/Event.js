const mongoose = require('mongoose');
const EventSchema = new mongoose.Schema({
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {type: String, required: true},
    description: {type: String, required: true},
    eventType: {
        type: String,
        enum: ['normal', 'merchandise'],
        required: true
    },
    eligibility: {type: String, required: true},
    registrationCount: {
        type: Number,
        default: 0
    },
    registrationDeadline: {type: Date, required: true},
    startDate: {type: Date, required: true},
    endDate: {type: Date, required: true},
    registrationLimit: {type: Number, required: true},

    // NORMAL EVENT SPECIFICS
    fee: {type: Number, default: 0},
    tags: [String],

    // DYNAMIC FORM BUILDER SCHEMA
    formFields: [
        {
            label: { type: String },    // Question text (e.g., "Github Profile")
            fieldType: { type: String, enum: ['text', 'number', 'dropdown', 'file', 'checkbox'] }, 
            required: { type: Boolean, default: false },
            options: [String]           // For dropdowns/checkboxes
        }
    ],

    // MERCHANDISE SPECIFICS
    stock: {type: Number},
    maxItemsPerUser: { 
        type: Number, 
        default: 1 // Default to 1 (Normal events are always 1)
    },
    itemDetails: { type: Object },
    status: {type: String, enum: ['draft', 'published', 'ongoing', 'closed'], default: 'draft'}
}, {timestamps: true});
module.exports = mongoose.model('Event', EventSchema);
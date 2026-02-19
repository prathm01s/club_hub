const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Registration = require("../models/Registration");
const Event = require("../models/Event");
const {v4: uuidv4} = require("uuid");
const User = require('../models/User');
const sendTicketEmail = require('../config/sendTicket'); // Add this import


// @route   POST /api/registrations/:eventId
// @desc    Register for an event
// @access  Private (Participants only)
router.post("/:eventID", auth, async (req, res) => {
    try {
        const eventId = req.params.eventID;
        const userId = req.user.id; 
        const { responses, quantity = 1 } = req.body;

        // Does event exist?
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ msg : "Event not found" });
        }

        const now = new Date();
        if (event.registrationDeadline && now > event.registrationDeadline) {
            return res.status(400).json({ msg: "Registration deadline has passed" });
        }

        // --- CHECK B: ELIGIBILITY ---
        // We need to fetch the full User object to check 'isIIIT'
        const user = await User.findById(userId);
        if (event.eligibility === 'iiit-only' && !user.isIIIT) {
            return res.status(403).json({ msg: "This event is restricted to IIIT students only." });
        }

        // --- CHECK: PURCHASE LIMIT (The "Configurable" Check) ---
        if (quantity > event.maxItemsPerUser) {
            return res.status(400).json({ 
                msg: `You can only purchase up to ${event.maxItemsPerUser} items.` 
            });
        }

        // --- CHECK: GLOBAL STOCK (For Merchandise) ---
        if (event.eventType === 'merchandise') {
            if (event.stock < quantity) {
                return res.status(400).json({ msg: "Not enough stock available" });
            }
        }

        // --- NEW VALIDATION CODE STARTS HERE ---
        // We assume 'responses' is an object like { "Github": "url...", "Size": "M" }
        // We also need to handle the case where responses might be undefined/null
        const userResponses = responses || {}; 
        const missingFields = [];
        // Loop through the Event's requirements
        if (event.formFields && event.formFields.length > 0) {
            event.formFields.forEach(field => {
                // If the field is required...
                if (field.required) {
                    // ...and the user did NOT provide an answer (or answer is empty string)
                    if (!userResponses[field.label] || userResponses[field.label].trim() === '') {
                        missingFields.push(field.label);
                    }
                }
            });
        }
        // If there are any missing fields, STOP and throw error
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                msg: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Check if user has already registered
        const existingReg = await Registration.findOne({ event: eventId, user: userId });
        if (existingReg) {
            return res.status(400).json({ msg: "You are already registered for this event"});
        }
        /*
        // Check seat availability
        const currentRegCount = await Registration.countDocuments({ event: eventId });
        if (currentRegCount >= event.registrationLimit) {
            return res.status(400).json({ msg : "Event is full"});
        }*/
        if (event.eventType === 'merchandise') {
            // Find event and reduce stock ONLY if stock >= quantity requested
            updatedEvent = await Event.findOneAndUpdate(
                { _id: eventId, stock: { $gte: quantity } }, 
                { 
                    $inc: { stock: -quantity, registrationCount: 1 } 
                },
                { new: true }
            );
            if (!updatedEvent) {
                return res.status(400).json({ msg: "Not enough stock available." });
            }
        } else {
            // Find event and increase count ONLY if count < limit
            updatedEvent = await Event.findOneAndUpdate(
                { _id: eventId, registrationCount: { $lt: event.registrationLimit } },
                { 
                    $inc: { registrationCount: 1 } 
                },
                { new: true }
            );
            if (!updatedEvent) {
                return res.status(400).json({ msg: "Event is full." });
            }
        }

        // Create new registration
        const newRegistration = new Registration({
            event: eventId,
            user: userId,
            ticketId: uuidv4(),
            status: "registered",
            responses: userResponses,
            quantity: quantity
        });

        await newRegistration.save();
        /*
        await Event.findByIdAndUpdate(eventId, { 
            $inc: { registrationCount: 1 } 
        });
        // --- CRITICAL: REDUCE STOCK ---
        if (event.eventType === 'merchandise') {
            event.stock = event.stock - quantity;
            await event.save();
        }*/

        // --- NEW: GENERATE QR & SEND EMAIL ---
        // Pass the user, event, and the newly generated ticket ID
        // Note: We don't 'await' this so the user gets their API response instantly
        // Fire and forget
        sendTicketEmail(user, event, newRegistration.ticketId);

        res.json({
            msg: "Registration Successfull",
            ticketId: newRegistration.ticketId
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/registrations/my-events
// @desc    Get all events the logged-in user is registered for
// @access  Private
router.get("/my-events", auth, async (req, res) => {
    try {
        const registrations = await Registration.find({ user: req.user.id })
            .populate({
                path: "event",
                select: "name startDate endDate eventType status organizer",
                populate: {
                    path: "organizer",
                    select: "organizerName firstName lastName"
                }
            })
            .sort({ createdAt: -1 });

        res.json(registrations);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
// @route   PUT /api/registrations/:id/cancel
// @desc    Cancel an existing registration
// @access  Private (Participant only)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        // 1. Find the registration
        const registration = await Registration.findById(req.params.id);
        
        if (!registration) {
            return res.status(404).json({ msg: "Registration not found" });
        }

        // 2. Security: Ensure the logged-in user actually owns this ticket
        if (registration.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to cancel this registration" });
        }

        // 3. Check if it is already cancelled
        if (registration.status === 'cancelled') {
            return res.status(400).json({ msg: "Registration is already cancelled" });
        }

        // 4. Fetch the associated event
        const event = await Event.findById(registration.event);
        if (!event) {
            return res.status(404).json({ msg: "Associated event not found" });
        }

        // 5. Timeline Check: Prevent cancellation if the event has already started
        if (new Date(event.startDate) < new Date()) {
            return res.status(400).json({ msg: "Cannot cancel a ticket after the event has started" });
        }

        // --- THE CANCELLATION PROCESS ---
        
        // Step A: Mark the registration as cancelled
        registration.status = 'cancelled';
        await registration.save();

        // Step B: Give the seat/stock back to the event
        if (event.eventType === 'merchandise') {
            // Restore the exact quantity the user had purchased
            await Event.findByIdAndUpdate(event._id, {
                $inc: { stock: registration.quantity, registrationCount: -1 }
            });
        } else {
            // For normal events, just restore the 1 seat
            await Event.findByIdAndUpdate(event._id, {
                $inc: { registrationCount: -1 }
            });
        }

        res.json({ 
            msg: "Registration cancelled successfully. Your seat has been released.", 
            registration 
        });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: "Registration not found" });
        }
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/registrations/event/:eventId
// @desc    Get all registrations for a specific event (Organizer only)
// @access  Private
router.get("/event/:eventId", auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ msg: "Event not found"});

        // Ensure the logged-in user actually owns this event
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to view these registrations."});
        }

        // Fetch all registrations for this event
        const registrations = await Registration.find({ event: req.params.eventId })
            .populate("user", "firstName lastName email contactNumber")
            .sort({ createdAt: -1 });
        res.json(registrations);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
module.exports = router;

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Registration = require("../models/Registration");
const Event = require("../models/Event");
const { v4: uuidv4 } = require("uuid");
const User = require('../models/User');
const sendTicketEmail = require('../config/sendTicket');


// @route   POST /api/registrations/:eventId
// @desc    Register for an event
// @access  Private (Participants only)
router.post("/:eventID", auth, async (req, res) => {
    try {
        const eventId = req.params.eventID;
        const userId = req.user.id;
        const { responses, quantity = 1 } = req.body;

        // Only participants can register for events
        if (req.user.role !== 'participant') {
            return res.status(403).json({ msg: "Only participants can register for events." });
        }

        // Does event exist?
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ msg: "Event not found" });
        }

        // Team events must go through the team system, not direct registration
        if (event.isTeamEvent) {
            return res.status(400).json({ msg: "This is a team event. Create or join a team via an invite code." });
        }

        // Event must be accepting registrations
        if (!['published', 'upcoming', 'ongoing'].includes(event.status)) {
            return res.status(400).json({ msg: "This event is not currently open for registration." });
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
                    // ...and the user did NOT provide an answer (or answer is empty / null / 0)
                    // Using String() conversion so numeric 0 is not treated as missing
                    const val = userResponses[field.label];
                    if (val === undefined || val === null || String(val).trim() === '') {
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

        // Check if user has an active registration
        let existingReg = await Registration.findOne({ event: eventId, user: userId });
        if (existingReg && existingReg.status !== 'cancelled') {
            return res.status(400).json({ msg: "You are already registered for this event" });
        }
        /*
        // Check seat availability
        const currentRegCount = await Registration.countDocuments({ event: eventId });
        if (currentRegCount >= event.registrationLimit) {
            return res.status(400).json({ msg : "Event is full"});
        }*/
        let updatedEvent;
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

        // Create new registration OR recycle cancelled one
        let newRegistration;
        if (existingReg && existingReg.status === 'cancelled') {
            existingReg.ticketId = uuidv4();
            existingReg.status = "registered";
            existingReg.responses = userResponses;
            existingReg.quantity = quantity;
            existingReg.teamName = '';
            await existingReg.save();
            newRegistration = existingReg;
        } else {
            newRegistration = new Registration({
                event: eventId,
                user: userId,
                ticketId: uuidv4(),
                status: "registered",
                responses: userResponses,
                quantity: quantity
            });
            await newRegistration.save();
        }
        /*
        await Event.findByIdAndUpdate(eventId, { 
            $inc: { registrationCount: 1 } 
        });
        // --- CRITICAL: REDUCE STOCK ---
        if (event.eventType === 'merchandise') {
            event.stock = event.stock - quantity;
            await event.save();
        }*/

        // --- GENERATE QR & SEND EMAIL ---
        // Fire-and-forget: don't let email failure block the response
        sendTicketEmail(user, event, newRegistration.ticketId, quantity).catch(err =>
            console.error("[sendTicketEmail] Failed to send ticket email:", err.message)
        );

        res.json({
            msg: "Registration Successfull",
            ticketId: newRegistration.ticketId
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/registrations/ticket/:ticketId
// @desc    Get ticket details + QR code for a specific registration
// @access  Private (owner of the ticket)
const QRCode = require('qrcode');
router.get('/ticket/:ticketId', auth, async (req, res) => {
    try {
        const registration = await Registration.findOne({ ticketId: req.params.ticketId })
            .populate({
                path: 'event',
                select: 'name startDate endDate eventType status organizer fee',
                populate: {
                    path: 'organizer',
                    select: 'organizerName firstName lastName'
                }
            });

        if (!registration) {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        // Only the ticket owner can view their ticket
        if (registration.user.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Not authorized to view this ticket' });
        }

        if (registration.status === 'cancelled') {
            return res.status(400).json({ msg: 'This ticket has been cancelled' });
        }

        // Generate QR code
        const user = await User.findById(req.user.id).select('firstName lastName email');
        const qrPayload = JSON.stringify({
            ticketId: registration.ticketId,
            eventName: registration.event.name,
            eventDate: registration.event.startDate,
            eventType: registration.event.eventType,
            participantName: `${user.firstName} ${user.lastName}`,
            participantEmail: user.email,
            userId: user._id
        });
        const qrDataUrl = await QRCode.toDataURL(qrPayload);

        const organizerName = registration.event.organizer?.organizerName ||
            `${registration.event.organizer?.firstName || ''} ${registration.event.organizer?.lastName || ''}`.trim();

        res.json({
            ticketId: registration.ticketId,
            eventName: registration.event.name,
            eventType: registration.event.eventType,
            startDate: registration.event.startDate,
            endDate: registration.event.endDate,
            status: registration.status,
            quantity: registration.quantity,
            fee: registration.event.fee,
            organizer: organizerName,
            participant: `${user.firstName} ${user.lastName}`,
            email: user.email,
            qrCodeDataUrl: qrDataUrl
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
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
        if (!event) return res.status(404).json({ msg: "Event not found" });

        // Ensure the logged-in user actually owns this event
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to view these registrations." });
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
// @route   PUT /api/registrations/:id/attend
// @desc    Toggle a participant's attendance status (registered ↔ attended)
// @access  Private (Organizer who owns the event)
router.put('/:id/attend', auth, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);
        if (!registration) return res.status(404).json({ msg: "Registration not found" });

        if (registration.status === 'cancelled') {
            return res.status(400).json({ msg: "Cannot mark a cancelled registration as attended." });
        }

        // Verify the caller owns the event this registration belongs to
        const event = await Event.findById(registration.event);
        if (!event) return res.status(404).json({ msg: "Event not found" });
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to manage this event's registrations." });
        }

        // Toggle between registered ↔ attended
        registration.status = registration.status === 'attended' ? 'registered' : 'attended';
        await registration.save();

        res.json({ msg: `Marked as ${registration.status}`, registration });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: "Registration not found" });
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/registrations/scan/:ticketId
// @desc    Scan a QR code ticket, mark as attended
// @access  Private (Organizer who owns the event)
router.put('/scan/:ticketId', auth, async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const registration = await Registration.findOne({ ticketId }).populate('event').populate('user');

        if (!registration) {
            return res.status(404).json({ msg: "Invalid Ticket ID. No registration found." });
        }

        const event = registration.event;

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized. You are not the organizer of this event." });
        }

        if (registration.status === 'cancelled') {
            return res.status(400).json({ msg: "Ticket has been cancelled." });
        }

        if (registration.status === 'attended') {
            return res.status(400).json({ msg: "Duplicate Scan. Participant has already been marked as attended." });
        }

        registration.status = 'attended';
        await registration.save();

        res.json({
            msg: "Scan successful! Participant checked in.",
            participant: `${registration.user.firstName} ${registration.user.lastName}`,
            email: registration.user.email,
            registration: registration
        });

    } catch (err) {
        console.error("[SCAN QR ERROR]", err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/registrations/:id/override
// @desc    Manual override for attendance with audit log
// @access  Private (Organizer who owns the event)
router.put('/:id/override', auth, async (req, res) => {
    try {
        const { reason, action } = req.body; // action: 'attended' or 'registered'
        if (!reason || !action) {
            return res.status(400).json({ msg: "Reason and action are required for manual override." });
        }

        const registration = await Registration.findById(req.params.id);
        if (!registration) return res.status(404).json({ msg: "Registration not found." });

        if (registration.status === 'cancelled') {
            return res.status(400).json({ msg: "Cannot override attendance for a cancelled ticket." });
        }

        const event = await Event.findById(registration.event);
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized. Make sure you are the event organizer." });
        }

        if (registration.status === action) {
            return res.status(400).json({ msg: `Ticket is already marked as ${action}.` });
        }

        const oldStatus = registration.status;
        registration.status = action;

        // Very basic "audit log" append pattern since Registration schema doesn't have an auditLogs array:
        // We'll trust the timestamp behavior. For stricter audit logging we'd append to an array field.
        console.log(`[AUDIT] Override: User ${req.user.id} changed Reg ${registration._id} from ${oldStatus} to ${action}. Reason: ${reason}`);

        await registration.save();
        res.json({ msg: `Manual override successful: marked as ${action}.`, registration });

    } catch (err) {
        console.error("[OVERRIDE ERROR]", err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/registrations/event/:eventId/export
// @desc    Generate a generic CSV of attendance 
// @access  Private (Organizer only)
router.get('/event/:eventId/export', auth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: "Event not found." });

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized." });
        }

        const registrations = await Registration.find({ event: eventId })
            .populate('user', 'firstName lastName email contactNumber')
            .sort({ createdAt: 1 });

        // Construct CSV string
        let csv = "Name,Email,Contact,Status,Ticket ID\n";
        registrations.forEach(r => {
            const name = `"${r.user.firstName} ${r.user.lastName}"`;
            const email = r.user.email;
            const contact = r.user.contactNumber || "N/A";
            const status = r.status.toUpperCase();
            const tId = r.ticketId;
            csv += `${name},${email},${contact},${status},${tId}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`attendance_${event.name.replace(/\s+/g, '_')}.csv`);
        res.send(csv);

    } catch (err) {
        console.error("[CSV EXPORT ERROR]", err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;

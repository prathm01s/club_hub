const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require("../middleware/auth");
const organizer = require("../middleware/organizer");
const Event = require("../models/Event");
const User = require("../models/User");
const Registration = require("../models/Registration");

// ─── AUTO-STATUS SYNC ────────────────────────────────────────────────────────
// Runs a batch update to transition event statuses based on current time.
// upcoming  → ongoing   when now >= startDate
// ongoing   → completed when now >  endDate
// Also migrates legacy 'published' records to the correct derived status.
async function syncEventStatuses() {
    const now = new Date();
    try {
        // Migrate legacy 'published' & null/undefined status docs to correct derived status
        const legacyFilter = { $or: [{ status: 'published' }, { status: null }] };
        const legacy = await Event.find(legacyFilter).select('startDate endDate status');
        for (const e of legacy) {
            if (new Date(e.endDate) < now)        e.status = 'completed';
            else if (new Date(e.startDate) <= now) e.status = 'ongoing';
            else                                   e.status = 'upcoming';
            await e.save({ validateBeforeSave: false });
        }
        // upcoming → ongoing
        await Event.updateMany(
            { status: 'upcoming', startDate: { $lte: now } },
            { $set: { status: 'ongoing' } }
        );
        // ongoing → completed
        await Event.updateMany(
            { status: 'ongoing', endDate: { $lt: now } },
            { $set: { status: 'completed' } }
        );
    } catch (err) {
        console.error('[syncEventStatuses] error:', err.message);
    }
}
// @route   POST /api/events
// @desc    Create an event (saved as draft by default)
// @access  Organizers Only
router.post('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role != 'organizer') {
            return res.status(403).json({ msg : "Access Denied. Organizers Only."});
        }
        const { startDate, endDate, registrationDeadline, eventType, stock, registrationLimit } = req.body;
        // --- ROBUSTNESS UPGRADE: Timeline Validation ---
        const start = new Date(startDate);
        const end = new Date(endDate);
        const deadline = new Date(registrationDeadline);

        if (end <= start) {
            return res.status(400).json({ msg: "End date must be after start date." });
        }
        if (deadline > start) {
            return res.status(400).json({ msg: "Registration deadline must be before or equal to start date." });
        }

        // --- ROBUSTNESS UPGRADE: Type Validation ---
        if (eventType === 'merchandise' && (!stock || stock <= 0)) {
            return res.status(400).json({ msg: "Merchandise events must have valid stock." });
        }
        if (!registrationLimit || registrationLimit <= 0) {
            return res.status(400).json({ msg: "Registration limit must be greater than 0." });
        }

        const newEvent = new Event({
            ...req.body,
            organizer: req.user.id,
            maxItemsPerUser: req.body.eventType === 'normal' ? 1 : req.body.maxItemsPerUser,
            status: req.body.status || 'draft'
        });

        const event = await newEvent.save();
        res.json(event);
    } catch (err) {
        console.error(err.message);
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map(e => e.message).join(", ");
            return res.status(400).json({ msg: messages });
        }
        res.status(500).json({ msg: "Server Error" });
    }
});

// @route   PUT /api/events/:id/status
// @desc    Update event status (e.g., Publish a draft, Close an event)
// @access  Organizer only
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        // 1. validate the status value
        const validStatuses = ['draft', 'upcoming', 'published', 'ongoing', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ msg: "Invalid status value" });
        }

        // 2. Find the event
        let event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ msg: "Event not found" });
        }

        // 3. Security: check ownership
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to edit this event" });
        }

        // 4. When publishing a draft, derive the correct target status from dates.
        //    Organizers always click "Publish" — the system decides upcoming vs ongoing.
        let targetStatus = status;
        if (event.status === 'draft' && status === 'published') {
            const now = new Date();
            if (new Date(event.startDate) > now) {
                targetStatus = 'upcoming';
            } else if (new Date(event.endDate) > now) {
                targetStatus = 'ongoing';
            } else {
                targetStatus = 'completed';
            }
        }

        // 5. Validate allowed transitions
        const allowed = {
            draft:     ['upcoming', 'published', 'ongoing', 'completed'], // resolved above
            upcoming:  ['ongoing', 'completed'],
            published: ['upcoming', 'ongoing', 'completed'],              // legacy
            ongoing:   ['completed'],
            completed: []
        };
        if (!(allowed[event.status] || []).includes(targetStatus)) {
            return res.status(400).json({
                msg: `Cannot transition from '${event.status}' to '${targetStatus}'.`
            });
        }

        // 6. Update and save
        event.status = targetStatus;
        await event.save();

        // 7. Fire Discord webhook when an event first becomes upcoming/ongoing
        if (targetStatus === 'upcoming' || targetStatus === 'ongoing') {
            try {
                const organizerUser = await User.findById(req.user.id);
                if (organizerUser?.discordWebhook) {
                    const axios = require('axios');
                    const message = {
                        content: `**New Event Published by ${organizerUser.organizerName}!**\n\n**${event.name}**\n*${event.description}*\n\n**Starts:** ${new Date(event.startDate).toLocaleString()}\n**Type:** ${event.eventType}\n\nRegister now on Felicity Event Manager!`
                    };
                    axios.post(organizerUser.discordWebhook, message).catch(err =>
                        console.error("Discord Webhook failed:", err.message)
                    );
                }
            } catch (webhookErr) {
                console.error("Webhook error:", webhookErr.message);
            }
        }

        res.json({ msg: `Event status updated to ${targetStatus}`, event });
    } catch (err) {
        console.error(err.message);
        if (err.kind === "ObjectId") {
            return res.status(404).json({ msg: "Event Not Found" });
        }
        res.status(500).send("Server Error");
    }
})

// @route   GET /api/events
// @desc    Get all events with Search, Filters, and Personalization (user preferences)
// @access  Public (but creates personalized order if token is present)
// @route   GET /api/events
// @desc    Get all events with Search, Filters, Personalization, and 24h Trending
// @access  Public (Enhanced if token present)
router.get('/', async (req, res) => {
    try {
        // Auto-update stale event statuses before serving results
        await syncEventStatuses();

        const { search, type, eligibility, startDate, endDate, trending, followed, status, organizerId } = req.query;

        // --- 1. STATUS FILTER ---
        // Default: all non-draft events. Narrow only when caller passes a specific status.
        let query = { status: { $ne: 'draft' } };

        if (status) {
            if (status === 'draft') {
                return res.status(403).json({ msg: "Draft events cannot be queried publicly." });
            }
            // 'all' is an alias for the default (all non-draft) — no change needed
            if (status !== 'all') {
                query.status = status;
            }
        }

        // --- FILTER: Event Type & Eligibility ---
        if (type) query.eventType = type;
        if (eligibility) query.eligibility = eligibility;
        // --- FILTER: Specific Organizer ---
        if (organizerId) {
            query.organizer = organizerId;
        }
        // --- FILTER: Date Range ---
        if (startDate || endDate) {
            query.startDate = {};
            if (startDate) query.startDate.$gte = new Date(startDate);
            if (endDate) query.startDate.$lte = new Date(endDate);
        }

        // --- SEARCH: Fuzzy matching ---
        if (search) {
            const matchingOrganizers = await User.find({
                role: 'organizer',
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { organizerName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            
            const organizerIds = matchingOrganizers.map(org => org._id);
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { organizer: { $in: organizerIds } }
            ];
        }

        // --- 2. TRENDING (TOP 5 in 24h) LOGIC ---
        let trendingEventIds = [];
        if (trending === 'true') {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000); // Exactly 24 hours ago
            
            // Database Magic: Group registrations from the last 24 hours by Event, count them, and get top 5
            const trendingData = await Registration.aggregate([
                { $match: { createdAt: { $gte: yesterday } } }, // Only registrations since yesterday
                { $group: { _id: '$event', recentCount: { $sum: 1 } } }, // Group by Event ID, add 1 for each
                { $sort: { recentCount: -1 } }, // Sort Highest to Lowest
                { $limit: 5 } // Keep only top 5
            ]);

            // Extract just the event IDs from the result
            trendingEventIds = trendingData.map(item => item._id);

            // Force the main query to ONLY look for these top 5 events
            query._id = { $in: trendingEventIds };
        }

        // --- AUTH & FOLLOWED CLUBS FILTER ---
        const token = req.header('x-auth-token');
        let user = null;
        let followingIds = [];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                user = await User.findById(decoded.user.id);
                
                if (user && user.role === 'participant') {
                    followingIds = user.following.map(id => id.toString());
                    if (followed === 'true') {
                        query.organizer = { $in: user.following };
                    }
                }
            } catch (err) {
                console.log("Token invalid or expired.");
            }
        } else if (followed === 'true') {
            return res.status(401).json({ msg: "Please login to view followed clubs" });
        }

        // --- EXECUTE QUERY ---
        let mongoQuery = Event.find(query).populate('organizer', 'firstName lastName organizerName');

        // Only sort by newest if NOT trending
        if (trending !== 'true') {
            mongoQuery = mongoQuery.sort({ createdAt: -1 });
        }

        let events = await mongoQuery;

        // --- 3. SORT TRENDING EVENTS (Because $in messes up the order) ---
        if (trending === 'true') {
            events.sort((a, b) => {
                const indexA = trendingEventIds.findIndex(id => id.toString() === a._id.toString());
                const indexB = trendingEventIds.findIndex(id => id.toString() === b._id.toString());
                return indexA - indexB;
            });
        }

        // --- SCORING ALGORITHM ---
        if (user && user.role === 'participant' && trending !== 'true') {
            events = events.map(event => {
                const eventObj = event.toObject();
                let score = 0;
                
                if (event.organizer && followingIds.includes(event.organizer._id.toString())) {
                    score += 10;
                }
                if (event.tags && user.interests) {
                    const match = event.tags.some(tag => user.interests.includes(tag));
                    if (match) score += 5;
                }

                eventObj.score = score;
                return eventObj;
            });
            events.sort((a, b) => b.score - a.score);
        }
        res.json(events);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/events/my-created-events
// @desc    Get all events created by the logged-in organizer, filtered by status tab
// @access  Private (Organizer only)
router.get("/my-created-events", auth, organizer, async (req, res) => {
    try {
        // Auto-sync statuses before returning organizer's events
        await syncEventStatuses();

        const { status } = req.query;
        
        // Always restrict to the logged-in organizer
        let query = { organizer: req.user.id };
        
        // If they clicked a specific status tab on the frontend
        if (status) {
            query.status = status;
        }

        const events = await Event.find(query).sort({ createdAt: -1});
        res.json(events);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/events/my-completed-event-analytics
// @desc    Get analytics (revenue, attendance, sales) for all completed events by the organizer
// @access  Organizer only
router.get("/my-completed-event-analytics", auth, organizer, async (req, res) => {
    try {
        // 1. Find all completed events belonging to this organizer
        const completedEvents = await Event.find({
            organizer: req.user.id,
            status: "completed"
        }).select("_id name fee eventType registrationLimit stock");

        if (completedEvents.length === 0) {
            return res.json([]);
        }

        const eventIds = completedEvents.map(e => e._id);

        // 2. Aggregate registration stats for all completed events in one DB call
        const aggregated = await Registration.aggregate([
            { $match: { event: { $in: eventIds } } },
            {
                $group: {
                    _id: "$event",
                    totalRegistrations: { $sum: 1 },
                    ticketsSold: {
                        $sum: {
                            $cond: [{ $ne: ["$status", "cancelled"] }, "$quantity", 0]
                        }
                    },
                    totalRevenue: {
                        // Will be multiplied by fee per event below (fee isn't in Registration)
                        $sum: {
                            $cond: [{ $ne: ["$status", "cancelled"] }, "$quantity", 0]
                        }
                    },
                    attendanceCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "attended"] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // 3. Build a lookup map from aggregation results
        const statsMap = {};
        aggregated.forEach(stat => {
            statsMap[stat._id.toString()] = stat;
        });

        // 4. Merge event info with its stats, computing revenue using event.fee
        const result = completedEvents.map(event => {
            const stat = statsMap[event._id.toString()] || {
                totalRegistrations: 0,
                ticketsSold: 0,
                totalRevenue: 0,
                attendanceCount: 0
            };
            return {
                _id: event._id,
                name: event.name,
                eventType: event.eventType,
                registrationLimit: event.registrationLimit,
                stock: event.stock,
                totalRegistrations: stat.totalRegistrations,
                ticketsSold: stat.ticketsSold,
                totalRevenue: stat.ticketsSold * (event.fee || 0),
                attendanceCount: stat.attendanceCount
            };
        });

        res.json(result);
    } catch (err) {
        console.error("[GET /my-completed-event-analytics]", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
});


router.get('/:id', async (req, res) => {
    try {
        // Sync this single event's status before returning
        await syncEventStatuses();

        const event = await Event.findById(req.params.id)
            .populate("organizer", "firstName lastName organizerName organizerCategory");

        if (!event) {
            return res.status(404).json({ msg : "Event not found"});
        }
        res.json(event);
        
    } catch (err) {
        console.error(err.message);
        if (err.kind == "ObjectId") {
            return res.status(404).json({ msg : "Event Not Found"});
        }
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/events/:id
// @desc    Edit an event based on strict status rules
// @access  Private (Organizer only)
router.put('/:id', auth, async (req, res) => {
    try {
        let event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ msg: "Event not found" });
        if (event.organizer.toString() !== req.user.id) return res.status(403).json({ msg: "Not authorized" });

        const updates = req.body;

        // --- RULE 1: DRAFT (Free Edits) ---
        if (event.status === 'draft') {
            event = await Event.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
            return res.json({ msg: "Draft updated successfully", event });
        }

        // --- RULE 2: UPCOMING / PUBLISHED (Restricted Edits) ---
        // Editable: description, registrationDeadline (extend only), registrationLimit (increase only)
        // formFields: editable only while registrationCount === 0
        if (event.status === 'upcoming' || event.status === 'published') {
            // formFields — editable only before any registrations
            if (Object.prototype.hasOwnProperty.call(updates, 'formFields')) {
                if (event.registrationCount > 0) {
                    return res.status(400).json({ msg: "Form is locked because registrations have already been received." });
                }
                event.formFields = updates.formFields;
            }

            // description — freely editable
            if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
                event.description = updates.description;
            }

            // registrationDeadline — can only EXTEND
            if (Object.prototype.hasOwnProperty.call(updates, 'registrationDeadline')) {
                if (new Date(updates.registrationDeadline) < new Date(event.registrationDeadline)) {
                    return res.status(400).json({ msg: "You can only EXTEND the deadline, not shorten it." });
                }
                event.registrationDeadline = updates.registrationDeadline;
            }

            // registrationLimit — can only INCREASE
            if (Object.prototype.hasOwnProperty.call(updates, 'registrationLimit')) {
                if (Number(updates.registrationLimit) < Number(event.registrationLimit)) {
                    return res.status(400).json({ msg: "You can only INCREASE the capacity." });
                }
                if (Number(updates.registrationLimit) < event.registrationCount) {
                    return res.status(400).json({ msg: "Registration limit cannot be less than existing registrations." });
                }
                event.registrationLimit = updates.registrationLimit;
            }

            // All other fields are locked for published events.

            const isNewlyPublished = false; // status changes go through /status endpoint
            await event.save();

            // --- DISCORD WEBHOOK ---
            if (isNewlyPublished) {
                try {
                    const organizerUser = await User.findById(req.user.id);
                    if (organizerUser.discordWebhook) {
                        const axios = require('axios'); // Note: ensure you run `npm install axios` in backend
                        const message = {
                            content: `**New Event Published by ${organizerUser.organizerName}!**\n\n**${event.name}**\n*${event.description}*\n\n**Starts:** ${new Date(event.startDate).toLocaleString()}\n**Type:** ${event.eventType}\n\nRegister now on Felicity Event Manager!`
                        };
                        // Fire and forget (we don't await so we don't slow down the user's API response)
                        axios.post(organizerUser.discordWebhook, message).catch(err => console.error("Discord Webhook failed:", err.message));
                    }
                } catch (webhookErr) {
                    console.error("Webhook processing error:", webhookErr.message);
                }
            }

            return res.json({ msg: "Event updated successfully", event });
        }

        // --- RULE 3: ONGOING — no edits allowed, status changes via /status endpoint ---
        if (event.status === 'ongoing') {
            return res.status(400).json({ msg: "Ongoing events are fully locked. Use the status action to mark as Completed." });
        }

        // --- RULE 4: COMPLETED — no edits whatsoever ---
        if (event.status === 'completed') {
            return res.status(400).json({ msg: "Completed events cannot be edited." });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
module.exports = router;
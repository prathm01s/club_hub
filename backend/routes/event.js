const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const organizer = require("../middleware/organizer");
const Event = require("../models/Event");
const User = require("../models/User");
const Registration = require("../models/Registration");
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
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/events/:id/status
// @desc    Update event status (e.g., Publish a draft, Close an event)
// @access  Organizer only
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        // 1. validate the status value sent to server by req body
        const validStatuses = ['draft', 'published', 'ongoing', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ msg: "Invalid status value" });
        }

        // 2. Find the event
        let event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ msg: "Event not found" });
        }

        // 3. Security: Make sure the logged-in user actually owns this event
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Not authorized to edit this event" });
        }

        // 4. Update and save
        event.status = status;
        await event.save();

        res.json({ msg: `Event status updated to ${status}`, event });
    } catch (err) {
        console.error(err.message);
        if (err.kind === "ObjectId") {
            return res.status(404).json({ msg: "Event Not Found" });
        }
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/events
// @desc    Get all events with Search, Filters, and Personalization (user preferences)
// @access  Public (but creates personalized order if token is present)
// @route   GET /api/events
// @desc    Get all events with Search, Filters, Personalization, and 24h Trending
// @access  Public (Enhanced if token present)
router.get('/', async (req, res) => {
    try {
        const { search, type, eligibility, startDate, endDate, trending, followed, status, organizerId } = req.query;

        // --- 1. STATUS FILTER ---
        // By default, only show published or ongoing events
        let query = { status: { $in: ['published', 'ongoing'] } };

        if (status) {
            // Security: Prevent public from searching 'draft' events here
            if (status === 'draft') {
                return res.status(403).json({ msg: "Draft events cannot be queried publicly." });
            }
            query.status = status;
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
                const jwt = require('jsonwebtoken'); 
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
                
                if (followingIds.includes(event.organizer._id.toString())) {
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
// @desc    Get all events created by the logged-in organizer
// @access  Private (Organizer only)
router.get("/my-created-events", auth, organizer, async (req, res) => {
    try {
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


router.get('/:id', async (req, res) => {
    console.log("1. Route hit! ID is:", req.params.id); // <--- DEBUG LOG
    try {
        console.log("2. Searching database..."); // <--- DEBUG LOG
        const event = await Event.findById(req.params.id).populate("organizer", "firstName lastName");
        console.log("3. Database search finished."); // <--- DEBUG LOG

        if (!event) {
            console.log("4. Event not found!"); // <--- DEBUG LOG
            return res.status(404).json({ msg : "Event not found "});
        }
        console.log("5. Sending response."); // <--- DEBUG LOG
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

        // --- RULE 2: PUBLISHED (Restricted Edits) ---
        if (event.status === 'published') {
            if (updates.description) event.description = updates.description;
            
            if (updates.registrationDeadline) {
                if (new Date(updates.registrationDeadline) < new Date(event.registrationDeadline)) {
                    return res.status(400).json({ msg: "You can only EXTEND the deadline, not shorten it." });
                }
                event.registrationDeadline = updates.registrationDeadline;
            }
            
            if (updates.registrationLimit) {
                if (updates.registrationLimit < event.registrationLimit) {
                    return res.status(400).json({ msg: "You can only INCREASE the capacity." });
                }
                event.registrationLimit = updates.registrationLimit;
            }

            // --- FORM LOCKING LOGIC ---
            if (updates.formFields) {
                if (event.registrationCount > 0) {
                    return res.status(400).json({ msg: "Form is locked because registrations have already been received." });
                }
                event.formFields = updates.formFields;
            }
            const isNewlyPublished = updates.status === 'published' && event.status !== 'published';
            
            if (updates.status === 'published') event.status = 'published';
            if (updates.status === 'closed') event.status = 'closed';
            
            await event.save();

            // --- DISCORD WEBHOOK ---
            if (isNewlyPublished) {
                try {
                    const organizerUser = await User.findById(req.user.id);
                    if (organizerUser.discordWebhook) {
                        const axios = require('axios'); // Note: ensure you run `npm install axios` in backend
                        const message = {
                            content: `🎉 **New Event Published by ${organizerUser.organizerName}!** 🎉\n\n**${event.name}**\n*${event.description}*\n\n📅 **Starts:** ${new Date(event.startDate).toLocaleString()}\n🎟️ **Type:** ${event.eventType}\n\nRegister now on Felicity Event Manager!`
                        };
                        // Fire and forget (we don't await so we don't slow down the user's API response)
                        axios.post(organizerUser.discordWebhook, message).catch(err => console.error("Discord Webhook failed:", err.message));
                    }
                } catch (webhookErr) {
                    console.error("Webhook processing error:", webhookErr.message);
                }
            }

            return res.json({ msg: "Published event updated successfully", event });
        }

        // --- RULE 3: ONGOING / COMPLETED (Locked except status change) ---
        if (event.status === 'ongoing' || event.status === 'completed' || event.status === 'closed') {
            if (updates.status && ['completed', 'closed'].includes(updates.status)) {
                event.status = updates.status;
                await event.save();
                return res.json({ msg: `Event marked as ${updates.status}`, event });
            } else {
                return res.status(400).json({ msg: "Event is locked. You can only change the status to Completed or Closed." });
            }
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
module.exports = router;
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Feedback = require('../models/Feedback');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');

// Sanitize HTML tags from user input
const sanitize = (str) => typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : '';

// @route   POST /api/feedback/:eventId
// @desc    Submit anonymous feedback for an attended event
// @access  Private (Participants who attended only)
router.post('/:eventId', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ msg: 'Invalid event ID' });
        }

        const { rating, comment } = req.body;

        // Validate rating is an integer between 1-5
        const parsedRating = parseInt(rating);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({ msg: 'Rating must be an integer between 1 and 5.' });
        }

        // Verify user is a participant
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'participant') {
            return res.status(403).json({ msg: 'Only participants can submit feedback.' });
        }

        // Verify the event exists
        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found.' });

        // Verify user attended this event
        const registration = await Registration.findOne({
            event: req.params.eventId,
            user: req.user.id,
            status: 'attended'
        });

        if (!registration) {
            return res.status(403).json({ msg: 'You can only submit feedback for events you have attended.' });
        }

        // Sanitize comment (strip HTML, cap length)
        const cleanComment = sanitize(comment || '').slice(0, 2000);

        // Check for existing feedback
        const existing = await Feedback.findOne({ event: req.params.eventId, user: req.user.id });
        if (existing) {
            // Update existing feedback
            existing.rating = parsedRating;
            existing.comment = cleanComment;
            await existing.save();
            return res.json({ msg: 'Feedback updated successfully.', feedback: existing });
        }

        const feedback = new Feedback({
            event: req.params.eventId,
            user: req.user.id,
            rating: parsedRating,
            comment: cleanComment
        });
        await feedback.save();

        res.json({ msg: 'Feedback submitted successfully.', feedback });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'You have already submitted feedback for this event.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/feedback/:eventId
// @desc    Get all feedback for an event (anonymous — no sender info)
// @access  Private (Organizer of the event)
router.get('/:eventId', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ msg: 'Invalid event ID' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        // Only the organizer can view feedback
        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Only the event organizer can view feedback.' });
        }

        const { minRating, maxRating, sort } = req.query;

        let query = { event: req.params.eventId };

        // Filter by rating range — validate they are 1-5
        if (minRating || maxRating) {
            query.rating = {};
            if (minRating) {
                const min = parseInt(minRating);
                if (!isNaN(min) && min >= 1 && min <= 5) query.rating.$gte = min;
            }
            if (maxRating) {
                const max = parseInt(maxRating);
                if (!isNaN(max) && max >= 1 && max <= 5) query.rating.$lte = max;
            }
        }

        let sortObj = { createdAt: -1 }; // Default: newest first
        if (sort === 'rating_asc') sortObj = { rating: 1 };
        if (sort === 'rating_desc') sortObj = { rating: -1 };
        if (sort === 'oldest') sortObj = { createdAt: 1 };

        // ANONYMOUS: do NOT populate user field
        const feedbacks = await Feedback.find(query)
            .select('rating comment createdAt')
            .sort(sortObj)
            .limit(500);

        res.json(feedbacks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/feedback/:eventId/stats
// @desc    Get aggregated feedback statistics
// @access  Private (Organizer of the event)
router.get('/:eventId/stats', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ msg: 'Invalid event ID' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Only the event organizer can view feedback stats.' });
        }

        const stats = await Feedback.aggregate([
            { $match: { event: event._id } },
            {
                $group: {
                    _id: null,
                    totalFeedbacks: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    minRating: { $min: '$rating' },
                    maxRating: { $max: '$rating' }
                }
            }
        ]);

        // Rating distribution (count per star)
        const distribution = await Feedback.aggregate([
            { $match: { event: event._id } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const ratingDistribution = {};
        for (let i = 1; i <= 5; i++) ratingDistribution[i] = 0;
        distribution.forEach(d => { ratingDistribution[d._id] = d.count; });

        res.json({
            totalFeedbacks: stats[0]?.totalFeedbacks || 0,
            averageRating: stats[0] ? Math.round(stats[0].averageRating * 10) / 10 : 0,
            minRating: stats[0]?.minRating || 0,
            maxRating: stats[0]?.maxRating || 0,
            ratingDistribution
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/feedback/:eventId/export
// @desc    Export feedback data as CSV
// @access  Private (Organizer of the event)
router.get('/:eventId/export', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ msg: 'Invalid event ID' });
        }

        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        if (event.organizer.toString() !== req.user.id) {
            return res.status(403).json({ msg: 'Only the event organizer can export feedback.' });
        }

        const feedbacks = await Feedback.find({ event: req.params.eventId })
            .select('rating comment createdAt')
            .sort({ createdAt: -1 });

        // Build CSV with proper escaping
        let csv = 'Rating,Comment,Date\n';
        feedbacks.forEach(f => {
            const comment = (f.comment || '').replace(/"/g, '""').replace(/\n/g, ' ');
            csv += `${f.rating},"${comment}",${new Date(f.createdAt).toISOString()}\n`;
        });

        const safeName = (event.name || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=feedback_${safeName}.csv`);
        res.send(csv);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/feedback/:eventId/my-feedback
// @desc    Get current user's feedback for an event
// @access  Private
router.get('/:eventId/my-feedback', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
            return res.status(400).json({ msg: 'Invalid event ID' });
        }

        const feedback = await Feedback.findOne({
            event: req.params.eventId,
            user: req.user.id
        }).select('rating comment');

        res.json(feedback || null);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;

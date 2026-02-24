const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');

// @route   PUT /api/users/preferences
// @desc    Update user interests and following list
// @access  Private (Participants Only)
router.put('/preferences', auth, async (req, res) => {
    try {
        const { interests, following } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (interests) user.interests = interests;
        if (following !== undefined) {
            // Validate: only store IDs that are actual active organizer accounts
            const validOrgs = await User.find({ _id: { $in: following }, role: 'organizer', isActive: true }).select('_id');
            user.following = validOrgs.map(o => o._id);
        }
        if (req.body.onboardingComplete !== undefined) {
            user.onboardingComplete = req.body.onboardingComplete;
        }
        await user.save();
        res.json({ msg: 'Preferences updated successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/profile
// @desc    Get current user's profile (including preferences)
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/users/profile
// @desc    Update basic profile details (Participant)
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { firstName, lastName, contactNumber, collegeName, interests, following } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Update fields if they were provided in the request
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (contactNumber) user.contactNumber = contactNumber;
        if (collegeName) user.collegeName = collegeName;
        if (interests) user.interests = interests;
        if (following !== undefined) {
            // Validate: only store IDs that are actual active organizer accounts
            const validOrgs = await User.find({ _id: { $in: following }, role: 'organizer', isActive: true }).select('_id');
            user.following = validOrgs.map(o => o._id);
        }

        // Note: Email and isIIIT (Participant Type) are deliberately NOT updated here for security.

        await user.save();
        res.json({ msg: 'Profile updated successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Input validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ msg: 'Current password and new password are required.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ msg: 'New password must be at least 6 characters.' });
        }

        const user = await User.findById(req.user.id);

        // 1. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Incorrect current password' });
        }

        // 2. Hash and save new password
        const salt = await bcrypt.genSalt(10); // bcrypt imported at top of file
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password changed successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/organizers
// @desc    Get a list of all approved/active organizers
// @access  Public
router.get('/organizers', async (req, res) => {
    try {
        const organizers = await User.find({ role: 'organizer', isActive: true })
            .select('-password -contactNumber');
        res.json(organizers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/organizers/:id
// @desc    Get details of a specific organizer
// @access  Public
router.get('/organizers/:id', async (req, res) => {
    try {
        const organizer = await User.findOne({ _id: req.params.id, role: 'organizer' })
            .select('-password -contactNumber');

        if (!organizer) {
            return res.status(404).json({ msg: 'Organizer not found' });
        }
        res.json(organizer);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: "Organizer not found" });
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/users/organizer-profile
// @desc    Update organizer profile & webhook
// @access  Private (Organizer only)
router.put('/organizer-profile', auth, async (req, res) => {
    try {
        const { organizerName, organizerCategory, description, contactEmail, contactNumber, discordWebhook } = req.body;
        const user = await User.findById(req.user.id);

        if (!user || user.role !== 'organizer') {
            return res.status(403).json({ msg: 'Access Denied' });
        }

        // Update fields
        if (organizerName) user.organizerName = organizerName;
        if (organizerCategory) user.organizerCategory = organizerCategory;
        if (description) user.description = description;
        if (contactEmail) user.contactEmail = contactEmail;
        if (contactNumber) user.contactNumber = contactNumber;
        if (discordWebhook !== undefined) user.discordWebhook = discordWebhook; // allow clearing it

        await user.save();
        res.json({ msg: 'Organizer profile updated successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/users/request-password-reset
// @desc    Submit a password reset request to admin
// @access  Private (any logged-in user)
router.post('/request-password-reset', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Prevent duplicate pending requests
        const existing = await PasswordResetRequest.findOne({ user: user._id, status: 'pending' });
        if (existing) {
            return res.status(400).json({ msg: 'You already have a pending password reset request.' });
        }

        const displayName = user.role === 'organizer'
            ? user.organizerName
            : `${user.firstName || ''} ${user.lastName || ''}`.trim();

        const request = new PasswordResetRequest({
            user: user._id,
            userEmail: user.email,
            userName: displayName,
            userRole: user.role
        });
        await request.save();

        res.json({ msg: 'Password reset request submitted. An admin will process it shortly.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
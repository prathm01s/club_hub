const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   PUT /api/users/preferences
// @desc    Update user interests and following list
// @access  Private (Participants Only)
router.put('/preferences', auth, async (req, res) => {
    try {
        const { interests, following } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (interests) user.interests = interests;
        if (following) user.following = following;
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
        if (following) user.following = following;
        
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
        const user = await User.findById(req.user.id);
        
        // 1. Verify current password
        const bcrypt = require('bcryptjs'); // Ensure bcrypt is imported at top of file
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Incorrect current password' });
        }

        // 2. Hash and save new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password changed successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/organizers
// @desc    Get a list of all approved organizers
// @access  Public
router.get('/organizers', async (req, res) => {
    try {
        // Fetch users with the organizer role, excluding passwords
        const organizers = await User.find({ role: 'organizer' })
            .select('-password -email -contactNumber'); // Hide sensitive info
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
            .select('-password -email'); 
            
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

module.exports = router;
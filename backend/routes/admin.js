const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const User = require("../models/User");
const PasswordResetRequest = require("../models/PasswordResetRequest");
const Event = require("../models/Event");

// @route   POST /api/admin/create-organizer
// @desc    Create an organizer account
// @access  Private (Admin only)
router.post("/create-organizer", auth, admin, async (req, res) => {
    try {
        const { organizerName, category, description, email, password, contactEmail } = req.body;

        // Check if user(organizer) already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg : "Organizer already exists."});
        }

        user = new User({
            organizerName,
            email,
            role: "organizer",
            organizerCategory: category,
            description,
            contactEmail
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        res.json({ msg : "Organizer created successfully."});
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route PUT /api/admin/organizers/:id/toggle-status
// @desc Disable/Enable (archive) an organizer account
// @access for admin only
router.put("/organizers/:id/toggle-status", auth, admin, async (req,res) => {
    try {
        const organizer = await User.findById(req.params.id);
        if (!organizer || organizer.role !== 'organizer') {
            return res.status(404).json({ msg: "Organizer not found."});
        }
        organizer.isActive = !organizer.isActive;
        await organizer.save();
        res.json({msg : `Organizer ${organizer.isActive ? 'activated' : 'disabled'} successfully.`, organizer})
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   DELETE /api/admin/organizers/:id
// @desc    Remove an organizer account
// @access  Private (Admin only)
router.delete("/organizers/:id", auth, admin, async (req, res) => {
    try {
        const organizer = await User.findById(req.params.id);
        
        if (!organizer || organizer.role !== 'organizer') {
            return res.status(404).json({ msg: "Organizer not found" });
        }

        await User.findByIdAndDelete(req.params.id);
        
        // Note: In a true production app, we would also delete their events here.
        res.json({ msg: "Organizer removed successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/admin/organizers
// @desc    Get all organizers with full details (including email) for admin
// @access  Private (Admin only)
router.get("/organizers", auth, admin, async (req, res) => {
    try {
        const organizers = await User.find({ role: "organizer" }).select("-password");
        res.json(organizers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/admin/stats
// @desc    Get summary stats for admin overview dashboard
// @access  Private (Admin only)
router.get("/stats", auth, admin, async (req, res) => {
    try {
        const totalOrganizers = await User.countDocuments({ role: "organizer" });
        const activeOrganizers = await User.countDocuments({ role: "organizer", isActive: true });
        const disabledOrganizers = await User.countDocuments({ role: "organizer", isActive: false });
        const totalParticipants = await User.countDocuments({ role: "participant" });
        const pendingResets = await PasswordResetRequest.countDocuments({ status: "pending" });
        let totalEvents = 0;
        try { totalEvents = await Event.countDocuments(); } catch (_) {}

        res.json({ totalOrganizers, activeOrganizers, disabledOrganizers, totalParticipants, pendingResets, totalEvents });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/admin/password-reset-requests
// @desc    Get all password reset requests
// @access  Private (Admin only)
router.get("/password-reset-requests", auth, admin, async (req, res) => {
    try {
        const requests = await PasswordResetRequest.find()
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/admin/password-reset-requests/:id/approve
// @desc    Approve a password reset request – generate a new password and set it
// @access  Private (Admin only)
router.put("/password-reset-requests/:id/approve", auth, admin, async (req, res) => {
    try {
        const request = await PasswordResetRequest.findById(req.params.id);
        if (!request || request.status !== "pending") {
            return res.status(404).json({ msg: "Pending request not found" });
        }

        // Generate a random password
        const newPassword =
            Math.random().toString(36).slice(-8) +
            Math.random().toString(36).slice(-4).toUpperCase() +
            "!";

        // Hash and update user's password
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);
        await User.findByIdAndUpdate(request.user, { password: hashed });

        // Update request status
        request.status = "approved";
        request.generatedPassword = newPassword; // store in plain for admin to copy once
        await request.save();

        res.json({ msg: "Password reset approved", newPassword, request });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/admin/password-reset-requests/:id/reject
// @desc    Reject a password reset request
// @access  Private (Admin only)
router.put("/password-reset-requests/:id/reject", auth, admin, async (req, res) => {
    try {
        const request = await PasswordResetRequest.findById(req.params.id);
        if (!request || request.status !== "pending") {
            return res.status(404).json({ msg: "Pending request not found" });
        }
        request.status = "rejected";
        await request.save();
        res.json({ msg: "Request rejected", request });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const User = require("../models/User");

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
module.exports = router;
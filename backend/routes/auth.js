const express = require("express");
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, contactNumber, collegeName } = req.body;

        // 0. Required field validation
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ msg: 'firstName, lastName, email, and password are all required.' });
        }
        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ msg: 'Password must be at least 6 characters.' });
        }

        // 1. Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Prevent admin email from being registered via frontend
        if (email === process.env.ADMIN_EMAIL) {
            return res.status(403).json({ msg: 'Registration with this email is not allowed' });
        }

        // 2. INFER isIIIT purely based on the email string
        const iiitDomains = ['students.iiit.ac.in', 'research.iiit.ac.in', 'iiit.ac.in', 'faculty.iiit.ac.in'];
        const emailDomain = email.split('@')[1];

        // If the domain is in our list, it's an IIIT student. Otherwise, false.
        const isIIIT = iiitDomains.includes(emailDomain);

        // 3. Create the user
        user = new User({
            firstName,
            lastName,
            email,
            contactNumber,
            // If they are IIIT, force their college name to be IIIT Hyderabad
            collegeName: isIIIT ? "IIIT Hyderabad" : collegeName,
            password,
            isIIIT: isIIIT, // <-- Saved inferred status
            role: "participant"
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.status(201).json({ msg: "User registered successfully" });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ msg: messages });
        }
        res.status(500).send('Server Error');
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: "Invalid Credentials" });
        }
        if (user.isActive === false) {
            return res.status(403).json({ msg: "Your account has been disabled by an adminstrator." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role,
                isIIIT: user.isIIIT || false,
                onboardingComplete: user.onboardingComplete || false
            }
        };
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
module.exports = router;
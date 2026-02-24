const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const ChatMessage = require('../models/ChatMessage');

// Allowed file extensions for chat uploads
const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.json', '.md',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.mp4', '.mp3', '.wav',
    '.ipynb', '.py', '.js', '.ts', '.java', '.c', '.cpp', '.h'
];

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E6) + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type "${ext}" is not allowed.`), false);
        }
    }
});

// @route   GET /api/chat/:teamId/messages
// @desc    Get message history for a team
// @access  Private (team members only)
router.get('/:teamId/messages', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.teamId)) {
            return res.status(400).json({ msg: 'Invalid team ID' });
        }

        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ msg: 'Team not found' });

        const isMember = team.members.some(m => m.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ msg: 'Not a member of this team' });

        const messages = await ChatMessage.find({ team: req.params.teamId })
            .populate('sender', 'firstName lastName')
            .sort({ createdAt: 1 })
            .limit(500);

        res.json(messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/chat/:teamId/upload
// @desc    Upload a file for team chat
// @access  Private (team members only)
router.post('/:teamId/upload', auth, (req, res) => {
    // Wrap multer in a manual call so we can catch its errors
    upload.single('file')(req, res, async (multerErr) => {
        try {
            if (multerErr) {
                if (multerErr.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ msg: 'File too large. Maximum size is 10MB.' });
                }
                return res.status(400).json({ msg: multerErr.message || 'File upload error.' });
            }

            if (!mongoose.Types.ObjectId.isValid(req.params.teamId)) {
                return res.status(400).json({ msg: 'Invalid team ID' });
            }

            const team = await Team.findById(req.params.teamId);
            if (!team) return res.status(404).json({ msg: 'Team not found' });

            const isMember = team.members.some(m => m.toString() === req.user.id);
            if (!isMember) return res.status(403).json({ msg: 'Not a member of this team' });

            if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

            const fileUrl = `/uploads/${req.file.filename}`;
            res.json({ fileUrl, fileName: req.file.originalname });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });
});

module.exports = router;

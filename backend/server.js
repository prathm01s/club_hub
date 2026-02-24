const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require('./config/db');
const seedAdmin = require("./config/seeder");
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const ChatMessage = require('./models/ChatMessage');
const Team = require('./models/Team');

connectDB().then(() => {
    seedAdmin();
});
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log("Attempting to connect...");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/event'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teams', require('./routes/team'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/feedback', require('./routes/feedback'));

app.get('/', (req, res) => {
    res.send("API is running...");
});

// ─── Socket.IO ───────────────────────────────────────────────
// Track online users per team room: { "team_<id>": Set of { id, name } }
const onlineUsers = {};

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded.user; // { id, role }
        next();
    } catch (err) {
        next(new Error("Authentication error"));
    }
});

// Sanitize HTML tags from user input to prevent XSS
const sanitize = (str) => typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : '';

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.user.id}`);

    socket.on("joinTeam", async (teamId) => {
        try {
            if (!teamId || typeof teamId !== 'string') return;
            const team = await Team.findById(teamId).populate('members', 'firstName lastName');
            if (!team) return;
            const isMember = team.members.some(m => m._id.toString() === socket.user.id);
            if (!isMember) return;

            const room = `team_${teamId}`;
            socket.join(room);
            socket.currentRoom = room;
            socket.currentTeamId = teamId;

            // Find user's name from team members
            const me = team.members.find(m => m._id.toString() === socket.user.id);
            const userName = me ? `${me.firstName} ${me.lastName}` : 'Unknown';
            socket.userName = userName;

            // Track online
            if (!onlineUsers[room]) onlineUsers[room] = {};
            onlineUsers[room][socket.user.id] = userName;

            // Broadcast updated online list to room
            io.to(room).emit("onlineUsers", Object.entries(onlineUsers[room]).map(([id, name]) => ({ id, name })));
        } catch (err) {
            console.error("joinTeam error:", err.message);
        }
    });

    socket.on("sendMessage", async ({ teamId, message, fileUrl, fileName }) => {
        try {
            // Verify sender actually joined this room
            const room = `team_${teamId}`;
            if (!socket.rooms.has(room)) return;

            // Sanitize & validate message
            const cleanMessage = sanitize(message || '').slice(0, 5000);
            const cleanFileUrl = fileUrl ? sanitize(fileUrl) : null;
            const cleanFileName = fileName ? sanitize(fileName) : null;

            // Reject empty messages with no file
            if (!cleanMessage.trim() && !cleanFileUrl) return;

            const chatMsg = new ChatMessage({
                team: teamId,
                sender: socket.user.id,
                message: cleanMessage,
                fileUrl: cleanFileUrl,
                fileName: cleanFileName
            });
            await chatMsg.save();

            const populated = await ChatMessage.findById(chatMsg._id)
                .populate('sender', 'firstName lastName');

            io.to(room).emit("newMessage", populated);
        } catch (err) {
            console.error("sendMessage error:", err.message);
        }
    });

    socket.on("typing", (teamId) => {
        if (!teamId || typeof teamId !== 'string') return;
        const room = `team_${teamId}`;
        if (!socket.rooms.has(room)) return;
        socket.to(room).emit("userTyping", { id: socket.user.id, name: socket.userName });
    });

    socket.on("stopTyping", (teamId) => {
        if (!teamId || typeof teamId !== 'string') return;
        const room = `team_${teamId}`;
        if (!socket.rooms.has(room)) return;
        socket.to(room).emit("userStopTyping", { id: socket.user.id });
    });

    socket.on("disconnect", () => {
        if (socket.currentRoom && onlineUsers[socket.currentRoom]) {
            delete onlineUsers[socket.currentRoom][socket.user.id];
            io.to(socket.currentRoom).emit("onlineUsers",
                Object.entries(onlineUsers[socket.currentRoom]).map(([id, name]) => ({ id, name }))
            );
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
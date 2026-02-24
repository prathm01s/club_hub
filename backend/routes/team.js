const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Registration = require("../models/Registration");
const Event = require("../models/Event");
const Team = require("../models/Team");
const User = require("../models/User");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const sendTicketEmail = require("../config/sendTicket");

// ─────────────────────────────────────────────────────────
// Helper: check whether a user already belongs to a team
//         (as leader OR member) for a given event.
// Returns the existing Team doc, or null.
// ─────────────────────────────────────────────────────────
const findExistingTeamForEvent = (userId, eventId) =>
    Team.findOne({
        event: eventId,
        members: userId,
        status: { $in: ["forming", "completed"] }
    });

// ─────────────────────────────────────────────────────────
// @route   POST /api/teams/create
// @desc    Leader creates a new team for a team event
// @access  Private (Participants only)
// ─────────────────────────────────────────────────────────
router.post("/create", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== "participant") {
            return res.status(403).json({ msg: "Only participants can create teams." });
        }

        const { eventId, teamName, targetSize, responses = {} } = req.body;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: "Event not found." });
        if (!event.isTeamEvent) return res.status(400).json({ msg: "This event does not support teams." });
        if (event.status !== "published" && event.status !== "upcoming" && event.status !== "ongoing") {
            return res.status(400).json({ msg: "Registrations are not open for this event." });
        }
        const now = new Date();
        if (event.registrationDeadline && now > new Date(event.registrationDeadline)) {
            return res.status(400).json({ msg: "Registration deadline has passed." });
        }
        if (event.eligibility === "iiit-only" && !user.isIIIT) {
            return res.status(403).json({ msg: "This event is restricted to IIIT students only." });
        }

        // Validate targetSize range (FIX: was using < for max check)
        const size = Number(targetSize);
        if (isNaN(size) || size < event.minTeamSize || size > event.maxTeamSize) {
            return res.status(400).json({
                msg: `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}.`
            });
        }

        // Guard: user already in a team for this event
        const existing = await findExistingTeamForEvent(req.user.id, eventId);
        if (existing) {
            return res.status(400).json({ msg: "You are already in a team for this event.", teamId: existing._id });
        }

        const inviteCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars

        const newTeam = new Team({
            name: teamName,
            event: eventId,
            leader: req.user.id,
            members: [req.user.id],
            memberResponses: [{ user: req.user.id, responses }],
            targetSize: size,
            inviteCode
        });

        await newTeam.save();

        // If target size is 1, the team is instantly complete.
        if (size === 1) {
            const updatedEvent = await Event.findOneAndUpdate(
                {
                    _id: event._id,
                    registrationCount: { $lte: event.registrationLimit - 1 }
                },
                { $inc: { registrationCount: 1 } },
                { new: true }
            );

            if (!updatedEvent) {
                await Team.findByIdAndDelete(newTeam._id);
                return res.status(400).json({ msg: "Sorry, the event just became full." });
            }

            let registration;
            const existingReg = await Registration.findOne({ event: event._id, user: req.user.id });
            if (existingReg && existingReg.status === "cancelled") {
                existingReg.ticketId = uuidv4();
                existingReg.status = "registered";
                existingReg.team = newTeam._id;
                existingReg.teamName = teamName;
                existingReg.responses = responses;
                await existingReg.save();
                registration = existingReg;
            } else {
                registration = await Registration.create({
                    event: event._id,
                    user: req.user.id,
                    team: newTeam._id,
                    ticketId: uuidv4(),
                    status: "registered",
                    paymentStatus: "completed",
                    quantity: 1,
                    teamName: teamName,
                    responses
                });
            }

            newTeam.status = "completed";
            await newTeam.save();

            sendTicketEmail(user, event, registration.ticketId, 1).catch(err =>
                console.error("[Team create sendTicketEmail] Failed:", err.message)
            );
        }

        const populated = await Team.findById(newTeam._id)
            .populate("event", "name startDate minTeamSize maxTeamSize formFields")
            .populate("members", "firstName lastName email")
            .populate("leader", "firstName lastName email");

        res.json(populated);
    } catch (err) {
        console.error("[POST /teams/create]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   GET /api/teams/preview/:inviteCode
// @desc    Preview a team before committing to join
// @access  Private
// ─────────────────────────────────────────────────────────
router.get("/preview/:inviteCode", auth, async (req, res) => {
    try {
        const team = await Team.findOne({ inviteCode: req.params.inviteCode.toUpperCase() })
            .populate("event", "name startDate registrationDeadline minTeamSize maxTeamSize formFields eligibility isTeamEvent status")
            .populate("members", "firstName lastName email")
            .populate("leader", "firstName lastName email");

        if (!team) return res.status(404).json({ msg: "Invalid invite code. No team found." });

        res.json({
            _id: team._id,
            name: team.name,
            status: team.status,
            targetSize: team.targetSize,
            currentSize: team.members.length,
            slotsLeft: team.targetSize - team.members.length,
            leader: team.leader,
            members: team.members,
            event: team.event,
            inviteCode: team.inviteCode
        });
    } catch (err) {
        console.error("[GET /teams/preview/:inviteCode]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   GET /api/teams/event/:eventId/my-team
// @desc    Get the user's current team (if any) for a specific event
// @access  Private
// ─────────────────────────────────────────────────────────
router.get("/event/:eventId/my-team", auth, async (req, res) => {
    try {
        const team = await findExistingTeamForEvent(req.user.id, req.params.eventId);
        if (!team) return res.json(null);

        const populated = await Team.findById(team._id)
            .populate("event", "name startDate formFields")
            .populate("members", "firstName lastName email")
            .populate("leader", "firstName lastName email");

        res.json(populated);
    } catch (err) {
        console.error("[GET /teams/event/:eventId/my-team]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   POST /api/teams/join
// @desc    Member joins a team via invite code.
//          Last member to join triggers auto-ticket generation for all.
// @access  Private (Participants only)
// ─────────────────────────────────────────────────────────
router.post("/join", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== "participant") {
            return res.status(403).json({ msg: "Only participants can join teams." });
        }

        const { inviteCode, responses = {} } = req.body;

        const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() }).populate("event");
        if (!team) return res.status(404).json({ msg: "Invalid invite code." });

        const event = team.event;

        if (team.status === "completed") {
            return res.status(400).json({ msg: "This team is already full and complete." });
        }
        if (team.members.map(m => m.toString()).includes(req.user.id)) {
            return res.status(400).json({ msg: "You are already a member of this team." });
        }

        // Guard: user already in ANOTHER team for this event
        const existing = await findExistingTeamForEvent(req.user.id, event._id);
        if (existing) {
            return res.status(400).json({ msg: "You are already in a different team for this event." });
        }

        if (event.eligibility === "iiit-only" && !user.isIIIT) {
            return res.status(403).json({ msg: "This event is restricted to IIIT students only." });
        }
        const now = new Date();
        if (event.registrationDeadline && now > new Date(event.registrationDeadline)) {
            return res.status(400).json({ msg: "Registration deadline has passed." });
        }
        if (event.status !== "published" && event.status !== "upcoming" && event.status !== "ongoing") {
            return res.status(400).json({ msg: "Registrations are not open for this event." });
        }

        team.members.push(req.user.id);
        team.memberResponses.push({ user: req.user.id, responses });

        // Check if there was a pending invite for this user
        if (user.email) {
            const normalizedEmail = user.email.toLowerCase();
            const inviteIndex = team.invites.findIndex(inv => inv.email.toLowerCase() === normalizedEmail);
            if (inviteIndex !== -1) {
                team.invites[inviteIndex].status = "joined";
            }
        }

        const isNowComplete = team.members.length === team.targetSize;

        if (isNowComplete) {
            // Atomically reserve capacity – fails if event just went full
            const updatedEvent = await Event.findOneAndUpdate(
                {
                    _id: event._id,
                    registrationCount: { $lte: event.registrationLimit - team.targetSize }
                },
                { $inc: { registrationCount: team.targetSize } },
                { new: true }
            );

            if (!updatedEvent) {
                return res.status(400).json({
                    msg: "Sorry, the event just became full. Your team cannot be completed."
                });
            }

            // Build responses lookup map
            const responsesMap = {};
            team.memberResponses.forEach(mr => {
                responsesMap[mr.user.toString()] =
                    mr.responses instanceof Map
                        ? Object.fromEntries(mr.responses)
                        : (mr.responses || {});
            });

            const registrationDocs = [];
            for (const memberId of team.members) {
                const existingReg = await Registration.findOne({ event: event._id, user: memberId });
                const memberResponses = responsesMap[memberId.toString()] || {};

                if (existingReg && existingReg.status === "cancelled") {
                    existingReg.ticketId = uuidv4();
                    existingReg.status = "registered";
                    existingReg.team = team._id;
                    existingReg.teamName = team.name;
                    existingReg.responses = memberResponses;
                    await existingReg.save();
                    registrationDocs.push(existingReg);
                } else {
                    const newReg = await Registration.create({
                        event: event._id,
                        user: memberId,
                        team: team._id,
                        ticketId: uuidv4(),
                        status: "registered",
                        paymentStatus: "completed",
                        quantity: 1,
                        teamName: team.name,
                        responses: memberResponses
                    });
                    registrationDocs.push(newReg);
                }
            }
            team.status = "completed";

            // Send confirmation email to every member
            const memberDocs = await User.find({ _id: { $in: team.members } });
            const memberMap = {};
            memberDocs.forEach(m => { memberMap[m._id.toString()] = m; });
            registrationDocs.forEach(reg => {
                const memberUser = memberMap[reg.user.toString()];
                if (memberUser) {
                    sendTicketEmail(memberUser, event, reg.ticketId, 1).catch(err =>
                        console.error("[Team sendTicketEmail] Failed for member:", memberUser.email, err.message)
                    );
                }
            });
        }

        await team.save();

        const populated = await Team.findById(team._id)
            .populate("event", "name startDate formFields")
            .populate("members", "firstName lastName email")
            .populate("leader", "firstName lastName email");

        res.json({
            team: populated,
            completed: isNowComplete,
            msg: isNowComplete
                ? "Team is fully formed. Tickets have been generated for all members."
                : `Joined successfully. ${team.targetSize - team.members.length} slot(s) remaining.`
        });
    } catch (err) {
        console.error("[POST /teams/join]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   POST /api/teams/:id/invite
// @desc    Leader invites a specific participant via email
// @access  Private (Leader only)
// ─────────────────────────────────────────────────────────
router.post("/:id/invite", auth, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ msg: "Email is required." });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ msg: "Team not found." });
        if (team.leader.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Only the team leader can send invites." });
        }
        if (team.status === "completed") {
            return res.status(400).json({ msg: "Cannot invite members to a completed team." });
        }

        // Check if the capacity limit allows another invite
        const currentMembers = team.members.length;
        const pendingInvites = team.invites.filter(inv => inv.status === 'pending').length;

        if (currentMembers + pendingInvites >= team.targetSize) {
            return res.status(400).json({ msg: "Inviting this user exceeds the team's target size." });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Ensure email isn't already invited
        const alreadyInvited = team.invites.find(inv => inv.email.toLowerCase() === normalizedEmail);
        if (alreadyInvited) {
            return res.status(400).json({ msg: "This user has already been invited." });
        }

        team.invites.push({ email: normalizedEmail, status: "pending" });
        await team.save();

        res.json({ msg: "Invite tracked successfully.", invites: team.invites });
    } catch (err) {
        console.error("[POST /teams/:id/invite]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   DELETE /api/teams/:id/leave
// @desc    Non-leader member leaves a forming team
// @access  Private
// ─────────────────────────────────────────────────────────
router.delete("/:id/leave", auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ msg: "Team not found." });

        if (team.status === "completed") {
            return res.status(400).json({ msg: "You cannot leave a completed team. Cancel your registration instead." });
        }
        const isMember = team.members.map(m => m.toString()).includes(req.user.id);
        if (!isMember) return res.status(400).json({ msg: "You are not a member of this team." });
        if (team.leader.toString() === req.user.id) {
            return res.status(400).json({ msg: "Leaders cannot leave — use Disband Team instead." });
        }

        team.members = team.members.filter(m => m.toString() !== req.user.id);
        team.memberResponses = team.memberResponses.filter(mr => mr.user.toString() !== req.user.id);
        await team.save();

        res.json({ msg: "You have left the team." });
    } catch (err) {
        console.error("[DELETE /teams/:id/leave]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   DELETE /api/teams/:id
// @desc    Leader disbands a forming team
// @access  Private (Leader only)
// ─────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ msg: "Team not found." });
        if (team.leader.toString() !== req.user.id) {
            return res.status(403).json({ msg: "Only the team leader can disband the team." });
        }
        if (team.status === "completed") {
            return res.status(400).json({ msg: "Cannot disband a completed team." });
        }
        await Team.findByIdAndDelete(req.params.id);
        res.json({ msg: "Team disbanded." });
    } catch (err) {
        console.error("[DELETE /teams/:id]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   GET /api/teams/my-teams
// @desc    All teams the logged-in user is part of
// @access  Private
// ─────────────────────────────────────────────────────────
router.get("/my-teams", auth, async (req, res) => {
    try {
        const teams = await Team.find({ members: req.user.id })
            .populate("event", "name startDate endDate")
            .populate("leader", "firstName lastName email")
            .populate("members", "firstName lastName email");
        res.json(teams);
    } catch (err) {
        console.error("[GET /teams/my-teams]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   GET /api/teams/my-invites
// @desc    Get all pending invites for the logged in user
// @access  Private
// ─────────────────────────────────────────────────────────
router.get("/my-invites", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== "participant") {
            return res.status(403).json({ msg: "Only participants can receive team invites." });
        }

        const email = user.email?.trim().toLowerCase();
        if (!email) return res.json([]);

        const invites = await Team.find({
            status: "forming",
            invites: { $elemMatch: { email: email, status: "pending" } }
        })
            .populate("event", "name startDate endDate")
            .populate("leader", "firstName lastName email");

        res.json(invites);
    } catch (err) {
        console.error("[GET /teams/my-invites]", err.message);
        res.status(500).send("Server Error");
    }
});

// ─────────────────────────────────────────────────────────
// @route   GET /api/teams/:id
// @desc    Get a single team by ID
// @access  Private (team members only)
// ─────────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate("event", "name startDate endDate")
            .populate("members", "firstName lastName email")
            .populate("leader", "firstName lastName email");

        if (!team) return res.status(404).json({ msg: "Team not found" });

        const isMember = team.members.some(m => m._id.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ msg: "Not a member of this team" });

        res.json(team);
    } catch (err) {
        console.error("[GET /teams/:id]", err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;

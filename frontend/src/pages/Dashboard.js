import { useEffect, useState, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

// Helper: resolve organizer display name from populated organizer object
const getOrganizerName = (organizer) => {
    if (!organizer) return "N/A";
    if (organizer.organizerName) return organizer.organizerName;
    const full = `${organizer.firstName || ""} ${organizer.lastName || ""}`.trim();
    return full || "N/A";
};

const Dashboard = () => {
    const { authTokens, user } = useContext(AuthContext);
    const [registrations, setRegistrations] = useState([]);
    const [teams, setTeams] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [activeTab, setActiveTab] = useState("upcoming"); // upcoming, normal, merchandise, completed, cancelled, teams
    const [ticketModal, setTicketModal] = useState(null); // holds ticket data when modal is open
    const [ticketLoading, setTicketLoading] = useState(false);

    // Human-readable labels for each tab
    const TAB_LABELS = {
        upcoming: "Upcoming Events",
        normal: "Normal",
        merchandise: "Merchandise",
        completed: "Completed",
        cancelled: "Cancelled / Rejected",
        teams: "My Teams",
    };

    const fetchMyEvents = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/registrations/my-events`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                }
            });
            const data = await response.json();
            if (response.ok) {
                setRegistrations(data);
            }
        } catch (err) {
            console.error("Failed to fetch registrations:", err);
        }
    }, [authTokens]);

    const fetchTicket = async (ticketId) => {
        setTicketLoading(true);
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/registrations/ticket/${ticketId}`, {
                headers: { "x-auth-token": authTokens.token }
            });
            if (res.ok) {
                const data = await res.json();
                setTicketModal(data);
            } else {
                const d = await res.json();
                alert(d.msg || "Could not load ticket.");
            }
        } catch (err) {
            alert("Failed to load ticket.");
        } finally {
            setTicketLoading(false);
        }
    };

    const fetchMyTeams = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/teams/my-teams`, {
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await response.json();
            if (response.ok) setTeams(data);
        } catch (err) {
            console.error("Failed to fetch teams");
        }
    }, [authTokens]);

    const fetchMyInvites = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/teams/my-invites`, {
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await response.json();
            if (response.ok) setPendingInvites(data);
        } catch (err) {
            console.error("Failed to fetch invites");
        }
    }, [authTokens]);

    useEffect(() => {
        fetchMyEvents();
        fetchMyTeams();
        fetchMyInvites();
    }, [fetchMyEvents, fetchMyTeams, fetchMyInvites]);

    const handleCancel = async (registrationId) => {
        if (!window.confirm("Are you sure you want to cancel your registration? This cannot be undone.")) return;

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/registrations/${registrationId}/cancel`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                }
            });
            const data = await response.json();

            if (response.ok) {
                alert(data.msg);
                fetchMyEvents();
            } else {
                alert(data.msg || "Failed to cancel");
            }
        } catch (err) {
            alert("Server Error during cancellation");
        }
    };

    const handleLeaveTeam = async (teamId) => {
        if (!window.confirm("Leave this team?")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/teams/${teamId}/leave`, {
                method: "DELETE", headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) { alert(data.msg); fetchMyTeams(); }
            else alert(data.msg || "Failed to leave team.");
        } catch { alert("Server error."); }
    };

    const handleDisbandTeam = async (teamId) => {
        if (!window.confirm("Disband this team? All members will lose their spot.")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/teams/${teamId}`, {
                method: "DELETE", headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) { alert(data.msg); fetchMyTeams(); }
            else alert(data.msg || "Failed to disband team.");
        } catch { alert("Server error."); }
    };

    const [inviteEmails, setInviteEmails] = useState({}); // Track input per team id
    const [inviteMsgs, setInviteMsgs] = useState({}); // Track success/error messages

    const handleInviteAction = async (teamId) => {
        const email = inviteEmails[teamId]?.trim();
        if (!email) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/teams/${teamId}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                setInviteMsgs(prev => ({ ...prev, [teamId]: { type: 'success', text: "Invite sent!" } }));
                setInviteEmails(prev => ({ ...prev, [teamId]: "" }));
                fetchMyTeams(); // refresh to show new invite
            } else {
                setInviteMsgs(prev => ({ ...prev, [teamId]: { type: 'error', text: data.msg || "Failed to invite." } }));
            }
            setTimeout(() => setInviteMsgs(prev => ({ ...prev, [teamId]: null })), 4000);
        } catch {
            setInviteMsgs(prev => ({ ...prev, [teamId]: { type: 'error', text: "Server error." } }));
            setTimeout(() => setInviteMsgs(prev => ({ ...prev, [teamId]: null })), 4000);
        }
    };
    const filterRegistrations = () => {
        return registrations.filter(reg => {
            const event = reg.event;
            if (!event) return false;

            const isCancelledOrRejected = reg.status === "cancelled" || reg.status === "rejected";

            switch (activeTab) {
                case "upcoming":
                    // "upcoming" status = published with startDate in the future
                    return event.status === "upcoming" && !isCancelledOrRejected;
                case "completed":
                    return event.status === "completed" && !isCancelledOrRejected;
                case "cancelled":
                    return isCancelledOrRejected;
                case "normal":
                    return event.eventType === "normal" && !isCancelledOrRejected;
                case "merchandise":
                    return event.eventType === "merchandise" && !isCancelledOrRejected;
                default:
                    return true;
            }
        });
    };

    const displayedRegistrations = filterRegistrations();

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>
            <h1 style={{ margin: "0 0 4px 0" }}>My Events Dashboard</h1>
            <p style={{ color: "gray", marginBottom: "30px" }}>Welcome back, {user?.firstName}! Manage your registrations and teams below.</p>

            {/* TAB NAVIGATION */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "2px solid #dee2e6", paddingBottom: "0", flexWrap: "wrap" }}>
                {Object.entries(TAB_LABELS).map(([tab, label]) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "10px 16px",
                            background: activeTab === tab ? "#007bff" : "transparent",
                            color: activeTab === tab ? "white" : "#495057",
                            border: "none",
                            borderBottom: activeTab === tab ? "3px solid #0056b3" : "3px solid transparent",
                            cursor: "pointer",
                            fontWeight: activeTab === tab ? "bold" : "normal",
                            borderRadius: "4px 4px 0 0",
                            fontSize: "0.9rem",
                            marginBottom: "-2px"
                        }}
                    >
                        {label}
                        {/* Badge counts */}
                        {tab !== "teams" && tab !== "upcoming" && (() => {
                            const now = new Date();
                            const count = registrations.filter(reg => {
                                if (!reg.event) return false;
                                const done = new Date(reg.event.endDate) < now;
                                const cancelledOrRejected = reg.status === "cancelled" || reg.status === "rejected";
                                switch (tab) {
                                    case "completed": return done && !cancelledOrRejected;
                                    case "cancelled": return cancelledOrRejected;
                                    case "normal": return reg.event.eventType === "normal" && !cancelledOrRejected;
                                    case "merchandise": return reg.event.eventType === "merchandise" && !cancelledOrRejected;
                                    default: return false;
                                }
                            }).length;
                            return count > 0 ? <span style={{ marginLeft: "6px", background: activeTab === tab ? "rgba(255,255,255,0.35)" : "#6c757d", color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "0.75rem" }}>{count}</span> : null;
                        })()}
                        {tab === "teams" && teams.length > 0 && (
                            <span style={{ marginLeft: "6px", background: activeTab === tab ? "rgba(255,255,255,0.35)" : "#6c757d", color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "0.75rem" }}>{teams.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* EVENTS GRID */}
            {activeTab === "teams" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* PENDING INVITES SECTION */}
                    {pendingInvites.length > 0 && (
                        <div style={{ background: "#fff3cd", border: "1px solid #ffeeba", borderRadius: "8px", padding: "20px", marginBottom: "10px" }}>
                            <h3 style={{ margin: "0 0 14px 0", color: "#856404", display: "flex", alignItems: "center", gap: "8px" }}>
                                Pending Team Invitations
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {pendingInvites.map(invite => (
                                    <div key={invite._id} style={{ background: "white", padding: "14px", borderRadius: "6px", border: "1px solid #ffdf7e", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                                        <div>
                                            <h4 style={{ margin: "0 0 4px 0" }}>{invite.name}</h4>
                                            <p style={{ margin: "0", fontSize: "0.9rem", color: "#555" }}>
                                                Event: <strong>{invite.event?.name}</strong> •
                                                Leader: {invite.leader?.firstName} {invite.leader?.lastName}
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <Link to={`/event/${invite.event?._id}?invite=${invite.inviteCode}`}>
                                                <button style={{ padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
                                                    Accept &amp; Join
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
                        {teams.length === 0 ? (
                            <p>You have not joined any teams yet. <Link to="/browse-events">Browse events</Link> to find a hackathon!</p>
                        ) : teams.map(team => {
                            const isLeader = team.leader?._id === user?.id || team.leader?._id?.toString() === user?.id;
                            const inviteLink = `${window.location.origin}/event/${team.event?._id}?invite=${team.inviteCode}`;
                            const copyText = (txt) => { navigator.clipboard.writeText(txt); };

                            return (
                                <div key={team._id} style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "8px", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                                    {/* Header row */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                                        <div>
                                            <h3 style={{ margin: "0 0 4px 0" }}>{team.name}</h3>
                                            <Link to={`/event/${team.event?._id}`} style={{ color: "#007bff", fontSize: "0.9rem" }}>{team.event?.name}</Link>
                                        </div>
                                        <span style={{
                                            padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold",
                                            background: team.status === 'completed' ? '#d4edda' : '#fff3cd',
                                            color: team.status === 'completed' ? '#155724' : '#856404'
                                        }}>
                                            {team.status === 'completed' ? 'Fully Formed' : 'Forming...'}
                                        </span>
                                    </div>

                                    {/* Member chips */}
                                    <p style={{ margin: "10px 0 6px", fontWeight: "bold", fontSize: "0.9rem" }}>
                                        Members ({team.members.length} / {team.targetSize}):
                                    </p>
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                                        {team.members.map((m, idx) => {
                                            const isMe = m._id === user?.id || m._id?.toString() === user?.id;
                                            const isLeaderChip = team.leader?._id === m._id || team.leader?._id?.toString() === m._id?.toString();
                                            return (
                                                <span key={m._id} style={{ background: isMe ? "#cce5ff" : "#f1f1f1", padding: "4px 10px", borderRadius: "15px", fontSize: "0.85rem", border: isMe ? "1px solid #b8daff" : "1px solid #ddd" }}>
                                                    {isLeaderChip ? "Leader · " : ""}{m.firstName} {m.lastName}{isMe ? " (You)" : ""}
                                                </span>
                                            );
                                        })}
                                        {Array.from({ length: team.targetSize - team.members.length }).map((_, i) => (
                                            <span key={`empty-${i}`} style={{ background: "#f8f9fa", border: "1px dashed #aaa", padding: "4px 10px", borderRadius: "15px", fontSize: "0.85rem", color: "#aaa" }}>
                                                Waiting...
                                            </span>
                                        ))}
                                    </div>

                                    {/* Invite code section (only for forming teams) */}
                                    {team.status === 'forming' && (
                                        <div style={{ background: "#f8f9fa", borderRadius: "6px", padding: "12px", marginBottom: "14px", border: "1px solid #e0e0e0" }}>
                                            <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "0.85rem" }}>Invite teammates:</p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                                <span style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: "bold", letterSpacing: "0.15em", background: "white", border: "1px solid #ccc", padding: "4px 10px", borderRadius: "4px" }}>
                                                    {team.inviteCode}
                                                </span>
                                                <button onClick={() => copyText(team.inviteCode)} style={{ padding: "5px 12px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                                                    Copy Code
                                                </button>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <input readOnly value={inviteLink} style={{ flex: 1, padding: "5px 8px", fontSize: "0.78rem", border: "1px solid #ccc", borderRadius: "4px", background: "white" }} />
                                                <button onClick={() => copyText(inviteLink)} style={{ padding: "5px 12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                                                    Copy Link
                                                </button>
                                            </div>

                                            {/* Specific Email Invite */}
                                            {isLeader && (
                                                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                                                    <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "0.85rem" }}>Invite specific member:</p>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <input
                                                            type="email"
                                                            placeholder="participant email"
                                                            value={inviteEmails[team._id] || ""}
                                                            onChange={e => setInviteEmails(prev => ({ ...prev, [team._id]: e.target.value }))}
                                                            style={{ flex: 1, padding: "5px 8px", fontSize: "0.78rem", border: "1px solid #ccc", borderRadius: "4px", background: "white" }}
                                                        />
                                                        <button onClick={() => handleInviteAction(team._id)} style={{ padding: "5px 12px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                                            Send Invite
                                                        </button>
                                                    </div>
                                                    {inviteMsgs[team._id] && (
                                                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: inviteMsgs[team._id].type === 'error' ? 'red' : 'green' }}>
                                                            {inviteMsgs[team._id].text}
                                                        </p>
                                                    )}

                                                    {/* Tracking Pending Invites */}
                                                    {team.invites && team.invites.length > 0 && (
                                                        <div style={{ marginTop: "10px" }}>
                                                            <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "#555" }}>Track Invites:</p>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                                {team.invites.map((inv, idx) => (
                                                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", background: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", border: "1px solid #ddd" }}>
                                                                        <span>{inv.email}</span>
                                                                        <span style={{ color: inv.status === 'joined' ? '#28a745' : '#856404', fontWeight: "bold", textTransform: "capitalize" }}>
                                                                            {inv.status}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Completed team: point to registrations tab */}
                                    {team.status === 'completed' && (
                                        <div style={{ background: "#d4edda", borderRadius: "6px", padding: "10px", marginBottom: "14px", fontSize: "0.9rem", color: "#155724" }}>
                                            Your ticket has been generated. Check the <button onClick={() => setActiveTab('upcoming')} style={{ background: "none", border: "none", color: "#0c5460", fontWeight: "bold", cursor: "pointer", padding: 0, textDecoration: "underline" }}>My Events</button> tab for your Ticket ID.
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                        <Link to={`/event/${team.event?._id}`}>
                                            <button style={{ padding: "7px 14px", background: "#f8f9fa", border: "1px solid #ccc", cursor: "pointer", borderRadius: "4px", fontSize: "0.85rem" }}>View Event</button>
                                        </Link>
                                        <Link to={`/team/${team._id}/chat`}>
                                            <button style={{ padding: "7px 14px", background: "#4f46e5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>Team Chat</button>
                                        </Link>
                                        {team.status === 'forming' && isLeader && (
                                            <button onClick={() => handleDisbandTeam(team._id)} style={{ padding: "7px 14px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                Disband Team
                                            </button>
                                        )}
                                        {team.status === 'forming' && !isLeader && (
                                            <button onClick={() => handleLeaveTeam(team._id)} style={{ padding: "7px 14px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>
                                                Leave Team
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : displayedRegistrations.length === 0 ? (
                <div style={{ padding: "30px", background: "#f9f9f9", textAlign: "center", borderRadius: "8px" }}>
                    <p>No records found under <strong>{TAB_LABELS[activeTab] || activeTab}</strong>.</p>
                    <Link to="/browse-events">
                        <button style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                            Browse Events
                        </button>
                    </Link>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
                    {displayedRegistrations.map(reg => {
                        const event = reg.event;
                        const organizerName = getOrganizerName(event.organizer);
                        const teamName = reg.teamName || "";

                        return (
                            <div key={reg._id} style={{
                                border: "1px solid #ddd", padding: "20px", borderRadius: "8px", background: "white",
                                opacity: reg.status === "cancelled" ? 0.65 : 1,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
                            }}>
                                {/* Event Name */}
                                <h3 style={{ margin: "0 0 8px 0" }}>{event.name}</h3>

                                {/* Badges: Event Type + Participation Status */}
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                                    <span style={badgeStyle}>{event.eventType.toUpperCase()}</span>
                                    <span style={{
                                        ...badgeStyle,
                                        background:
                                            reg.status === "cancelled" ? "#dc3545" :
                                                reg.status === "rejected" ? "#6f42c1" : "#17a2b8",
                                        color: "white"
                                    }}>
                                        {reg.status.toUpperCase()}
                                    </span>
                                </div>

                                {/* Core Details */}
                                <p style={rowStyle}><strong>Organizer:</strong> {organizerName}</p>

                                {/* Schedule: Start → End */}
                                <p style={rowStyle}><strong>Schedule:</strong></p>
                                <p style={{ ...rowStyle, paddingLeft: "12px", color: "#555", fontSize: "0.9rem" }}>
                                    Start: {new Date(event.startDate).toLocaleString()}
                                </p>
                                <p style={{ ...rowStyle, paddingLeft: "12px", color: "#555", fontSize: "0.9rem" }}>
                                    End:&nbsp;&nbsp; {new Date(event.endDate).toLocaleString()}
                                </p>

                                {/* Team Name (if applicable) */}
                                {teamName && (
                                    <p style={rowStyle}><strong>Team Name:</strong> {teamName}</p>
                                )}

                                {/* Merchandise quantity */}
                                {event.eventType === "merchandise" && (
                                    <p style={rowStyle}><strong>Quantity:</strong> {reg.quantity}</p>
                                )}

                                {/* Clickable Ticket ID */}
                                <p style={rowStyle}>
                                    <strong>Ticket ID:</strong>{" "}
                                    <Link
                                        to={`/event/${event._id}`}
                                        title="View event details"
                                        style={{
                                            fontFamily: "monospace",
                                            background: "#eef",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            color: "#0056b3",
                                            textDecoration: "underline",
                                            wordBreak: "break-all",
                                            fontSize: "0.85rem"
                                        }}
                                    >
                                        {reg.ticketId}
                                    </Link>
                                </p>

                                {/* Actions */}
                                <div style={{ marginTop: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    <Link to={`/event/${event._id}`}>
                                        <button style={{ padding: "8px 14px", background: "#f8f9fa", border: "1px solid #ccc", cursor: "pointer", borderRadius: "4px" }}>
                                            View Event
                                        </button>
                                    </Link>

                                    {/* Cancel only allowed for upcoming, not-yet-started, not-rejected registrations */}
                                    {activeTab === "upcoming" && event.status === "upcoming" && reg.status !== "cancelled" && reg.status !== "rejected" && (
                                        <button
                                            onClick={() => handleCancel(reg._id)}
                                            style={{ padding: "8px 14px", background: "#dc3545", color: "white", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                        >
                                            Cancel Registration
                                        </button>
                                    )}

                                    {/* View Ticket — for non-cancelled registrations */}
                                    {reg.status !== "cancelled" && reg.status !== "rejected" && (
                                        <button
                                            onClick={() => fetchTicket(reg.ticketId)}
                                            disabled={ticketLoading}
                                            style={{ padding: "8px 14px", background: "#4f46e5", color: "white", border: "none", cursor: "pointer", borderRadius: "4px", fontWeight: "bold" }}
                                        >
                                            🎫 View Ticket
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {ticketModal && (
                <div onClick={() => setTicketModal(null)} style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: "white", borderRadius: "12px", padding: "30px",
                        maxWidth: "420px", width: "90%", textAlign: "center",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
                    }}>
                        {/* Header */}
                        <div style={{ background: "#4f46e5", color: "white", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
                            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{ticketModal.eventName}</h2>
                            <p style={{ margin: "4px 0 0", opacity: 0.9, fontSize: "0.85rem" }}>
                                {ticketModal.eventType === 'merchandise' ? 'Purchase Confirmation' : 'Event Ticket'}
                            </p>
                        </div>

                        {/* Details */}
                        <table style={{ width: "100%", textAlign: "left", fontSize: "0.9rem", marginBottom: "16px" }}>
                            <tbody>
                                <tr><td style={{ padding: "4px 0", color: "#666" }}>Name</td><td style={{ padding: "4px 0", fontWeight: "bold" }}>{ticketModal.participant}</td></tr>
                                <tr><td style={{ padding: "4px 0", color: "#666" }}>Email</td><td style={{ padding: "4px 0" }}>{ticketModal.email}</td></tr>
                                <tr><td style={{ padding: "4px 0", color: "#666" }}>Date</td><td style={{ padding: "4px 0" }}>{new Date(ticketModal.startDate).toLocaleString()}</td></tr>
                                <tr><td style={{ padding: "4px 0", color: "#666" }}>Organizer</td><td style={{ padding: "4px 0" }}>{ticketModal.organizer}</td></tr>
                                {ticketModal.eventType === 'merchandise' && (
                                    <tr><td style={{ padding: "4px 0", color: "#666" }}>Quantity</td><td style={{ padding: "4px 0" }}>{ticketModal.quantity}</td></tr>
                                )}
                                {ticketModal.fee > 0 && (
                                    <tr><td style={{ padding: "4px 0", color: "#666" }}>Fee</td><td style={{ padding: "4px 0" }}>
                                        {ticketModal.eventType === 'merchandise'
                                            ? `₹${ticketModal.fee} × ${ticketModal.quantity} = ₹${ticketModal.fee * ticketModal.quantity}`
                                            : `₹${ticketModal.fee}`}
                                    </td></tr>
                                )}
                                <tr><td style={{ padding: "4px 0", color: "#666" }}>Status</td><td style={{ padding: "4px 0" }}>
                                    <span style={{ background: ticketModal.status === 'attended' ? '#d4edda' : '#cce5ff', padding: "2px 8px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "bold", textTransform: "uppercase" }}>{ticketModal.status}</span>
                                </td></tr>
                            </tbody>
                        </table>

                        {/* QR + Ticket ID */}
                        <div style={{ background: "#f9fafb", padding: "20px", borderRadius: "8px", border: "1px dashed #d1d5db" }}>
                            <p style={{ margin: "0 0 4px", color: "#888", fontSize: "0.75rem" }}>TICKET ID</p>
                            <p style={{ margin: "0 0 12px", fontFamily: "monospace", fontWeight: "bold", fontSize: "0.85rem", wordBreak: "break-all" }}>{ticketModal.ticketId}</p>
                            <img src={ticketModal.qrCodeDataUrl} alt="QR Code" style={{ width: "180px", height: "180px" }} />
                            <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#888" }}>Present this QR code at the event</p>
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" }}>
                            <a
                                href={ticketModal.qrCodeDataUrl}
                                download={`ticket-${ticketModal.ticketId}.png`}
                                style={{
                                    padding: "10px 20px", background: "#10b981",
                                    color: "white", textDecoration: "none", borderRadius: "6px",
                                    fontWeight: "bold", fontSize: "0.95rem",
                                    display: "inline-flex", alignItems: "center", gap: "6px"
                                }}
                            >
                                📥 Download QR
                            </a>
                            <button onClick={() => setTicketModal(null)} style={{
                                padding: "10px 30px", background: "#4f46e5",
                                color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                                fontWeight: "bold", fontSize: "0.95rem"
                            }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const badgeStyle = {
    background: "#e9ecef",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "0.8rem",
    fontWeight: "bold"
};

const rowStyle = { margin: "6px 0" };

export default Dashboard;
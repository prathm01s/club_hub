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
    const [activeTab, setActiveTab] = useState("upcoming"); // upcoming, normal, merchandise, completed, cancelled

    const fetchMyEvents = useCallback(async () => {
        try {
            const response = await fetch("http://localhost:5000/api/registrations/my-events", {
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

    useEffect(() => {
        fetchMyEvents();
    }, [fetchMyEvents]);

    const handleCancel = async (registrationId) => {
        if (!window.confirm("Are you sure you want to cancel your registration? This cannot be undone.")) return;

        try {
            const response = await fetch(`http://localhost:5000/api/registrations/${registrationId}/cancel`, {
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

    // --- FILTERING LOGIC FOR TABS ---
    const filterRegistrations = () => {
        const now = new Date();

        return registrations.filter(reg => {
            const event = reg.event;
            if (!event) return false;

            const isCompleted = new Date(event.endDate) < now;
            const isCancelled = reg.status === "cancelled";

            switch (activeTab) {
                case "upcoming":
                    return !isCompleted && !isCancelled;
                case "completed":
                    return isCompleted && !isCancelled;
                case "cancelled":
                    return isCancelled;
                case "normal":
                    return event.eventType === "normal" && !isCancelled;
                case "merchandise":
                    return event.eventType === "merchandise" && !isCancelled;
                default:
                    return true;
            }
        });
    };

    const displayedRegistrations = filterRegistrations();

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>
            <h1>Hello, {user?.firstName}!</h1>
            <p style={{ color: "gray", marginBottom: "30px" }}>Welcome to your Participant Dashboard.</p>

            {/* TAB NAVIGATION */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ccc", paddingBottom: "10px", flexWrap: "wrap" }}>
                {["upcoming", "normal", "merchandise", "completed", "cancelled"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "10px 15px",
                            background: activeTab === tab ? "#28a745" : "#f4f4f4",
                            color: activeTab === tab ? "white" : "black",
                            border: "none", cursor: "pointer", textTransform: "capitalize", borderRadius: "4px"
                        }}
                    >
                        {tab} Events
                    </button>
                ))}
            </div>

            {/* EVENTS GRID */}
            {displayedRegistrations.length === 0 ? (
                <div style={{ padding: "30px", background: "#f9f9f9", textAlign: "center", borderRadius: "8px" }}>
                    <p>No records found for "{activeTab}" events.</p>
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
                                        background: reg.status === "cancelled" ? "#dc3545" : "#17a2b8",
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

                                    {/* Cancel only allowed for upcoming, not-yet-started registrations */}
                                    {activeTab === "upcoming" && new Date(event.startDate) > new Date() && reg.status !== "cancelled" && (
                                        <button
                                            onClick={() => handleCancel(reg._id)}
                                            style={{ padding: "8px 14px", background: "#dc3545", color: "white", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                        >
                                            Cancel Registration
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
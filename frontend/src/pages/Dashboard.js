import { useEffect, useState, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

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
                fetchMyEvents(); // Refresh the list
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
            const isCancelled = reg.status === 'cancelled';

            switch (activeTab) {
                case "upcoming":
                    return !isCompleted && !isCancelled;
                case "completed":
                    return isCompleted && !isCancelled;
                case "cancelled":
                    return isCancelled;
                case "normal":
                    return event.eventType === 'normal' && !isCancelled;
                case "merchandise":
                    return event.eventType === 'merchandise' && !isCancelled;
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

            {/* TAB NAVIGATION (Section 9.2) */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ccc", paddingBottom: "10px", flexWrap: "wrap" }}>
                {['upcoming', 'normal', 'merchandise', 'completed', 'cancelled'].map(tab => (
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                    {displayedRegistrations.map(reg => (
                        <div key={reg._id} style={{ 
                            border: "1px solid #ddd", padding: "20px", borderRadius: "8px", background: "white",
                            opacity: reg.status === 'cancelled' ? 0.6 : 1
                        }}>
                            <h3 style={{ margin: "0 0 10px 0" }}>{reg.event.name}</h3>
                            
                            <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
                                <span style={badgeStyle}>{reg.event.eventType.toUpperCase()}</span>
                                <span style={{...badgeStyle, background: reg.status === 'cancelled' ? "#dc3545" : "#17a2b8", color: "white"}}>
                                    {reg.status.toUpperCase()}
                                </span>
                            </div>

                            <p style={{ margin: "5px 0" }}><strong>Ticket ID:</strong> <span style={{ fontFamily: "monospace", background: "#eee", padding: "2px 5px" }}>{reg.ticketId}</span></p>
                            {reg.event.eventType === 'merchandise' && <p style={{ margin: "5px 0" }}><strong>Quantity:</strong> {reg.quantity}</p>}
                            
                            <p style={{ margin: "5px 0" }}><strong>Starts:</strong> {new Date(reg.event.startDate).toLocaleString()}</p>
                            
                            {/* Actions */}
                            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                                <Link to={`/event/${reg.event._id}`}>
                                    <button style={{ padding: "8px 15px", background: "#f8f9fa", border: "1px solid #ccc", cursor: "pointer", borderRadius: "4px" }}>
                                        View Event Details
                                    </button>
                                </Link>

                                {/* Only allow cancellation if it's upcoming and not already cancelled */}
                                {activeTab === 'upcoming' && new Date(reg.event.startDate) > new Date() && (
                                    <button 
                                        onClick={() => handleCancel(reg._id)} 
                                        style={{ padding: "8px 15px", background: "#dc3545", color: "white", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                    >
                                        Cancel Registration
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const badgeStyle = { background: "#e9ecef", padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold" };

export default Dashboard;
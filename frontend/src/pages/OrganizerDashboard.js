import { useEffect, useState, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

const OrganizerDashboard = () => {
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState("published"); // default tab
    const [stats, setStats] = useState({ totalEvents: 0, completed: 0 });

    // Use useCallback so we can safely include it in useEffect's dependency array
    const fetchMyEvents = useCallback(async () => {
        try {
            // Fetch events filtered by the currently active tab status
            const response = await fetch(`http://localhost:5000/api/events/my-created-events?status=${activeTab}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                }
            });
            const data = await response.json();
            
            if (response.ok) {
                setEvents(data);
                setStats(prev => ({ ...prev, totalEvents: data.length }));
            }
        } catch (err) {
            console.error("Failed to fetch events:", err);
        }
    }, [activeTab, authTokens]);

    useEffect(() => {
        fetchMyEvents();
    }, [fetchMyEvents]);

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Organizer Dashboard</h1>
                <button 
                    onClick={() => navigate('/create-event')} 
                    style={{ padding: "10px 20px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}
                >
                    + Create New Event
                </button>
            </div>

            {/* STATUS TABS */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ccc", paddingBottom: "10px" }}>
                {['draft', 'published', 'ongoing', 'closed'].map(status => (
                    <button 
                        key={status}
                        onClick={() => setActiveTab(status)}
                        style={{
                            padding: "10px",
                            background: activeTab === status ? "#007bff" : "#f4f4f4",
                            color: activeTab === status ? "white" : "black",
                            border: "none", cursor: "pointer", textTransform: "capitalize"
                        }}
                    >
                        {status}s
                    </button>
                ))}
            </div>

            {/* EVENTS CAROUSEL / GRID */}
            {events.length === 0 ? (
                <p>No {activeTab} events found.</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                    {events.map(event => (
                        <div key={event._id} style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", background: "white" }}>
                            <h3>{event.name}</h3>
                            <p><strong>Type:</strong> <span style={{ textTransform: "capitalize"}}>{event.eventType}</span></p>
                            <p><strong>Registrations:</strong> {event.registrationCount || 0} / {event.registrationLimit}</p>
                            <p><strong>Starts:</strong> {new Date(event.startDate).toLocaleDateString()}</p>
                            
                            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                                <Link to={`/organizer/event/${event._id}`}>
                                    <button style={{ padding: "5px 10px", cursor: "pointer" }}>Manage</button>
                                </Link>
                                
                                {(event.status === 'draft' || event.status === 'published') && (
                                    <Link to={`/organizer/edit-event/${event._id}`}>
                                        <button style={{ padding: "5px 10px", cursor: "pointer", background: "#ffc107", border: "none", borderRadius: "3px" }}>Edit Event</button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrganizerDashboard;
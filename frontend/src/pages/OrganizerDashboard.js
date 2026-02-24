import { useEffect, useState, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link, useNavigate, useLocation } from "react-router-dom";

const OrganizerDashboard = () => {
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const initialTab = new URLSearchParams(location.search).get("tab") || "published";
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [completedAnalytics, setCompletedAnalytics] = useState([]);

    // Sync tab with URL query param (e.g. Navbar "Ongoing Events" link)
    useEffect(() => {
        const tabFromUrl = new URLSearchParams(location.search).get("tab");
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
    // Use useCallback so we can safely include it in useEffect's dependency array
    const fetchMyEvents = useCallback(async () => {
        try {
            // Fetch events filtered by the currently active tab status
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/my-created-events?status=${activeTab}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                }
            });
            const data = await response.json();
            
            if (response.ok) {
                setEvents(data);
            }
        } catch (err) {
            console.error("Failed to fetch events:", err);
        }
    }, [activeTab, authTokens]);

    const fetchCompletedEventAnalytics = useCallback(async () => {
        try {
            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/events/my-completed-event-analytics`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-auth-token": authTokens.token
                    }
                }
            );
            const data = await response.json();
            if (response.ok) {
                setCompletedAnalytics(data);
            }
        } catch (err) {
            console.error("Failed to fetch analytics.", err);
        }
    }, [authTokens]);
    useEffect(() => {
        fetchMyEvents();
        fetchCompletedEventAnalytics();
    }, [fetchMyEvents, fetchCompletedEventAnalytics]);

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
                {['draft', 'upcoming', 'ongoing', 'completed'].map(status => (
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <h3 style={{ margin: 0 }}>{event.name}</h3>
                                <span style={{
                                    background: event.status === 'upcoming' ? '#e2d9f3' : event.status === 'ongoing' ? '#d4edda' : event.status === 'completed' ? '#f8d7da' : '#e2e3e5',
                                    color: event.status === 'upcoming' ? '#6f42c1' : event.status === 'ongoing' ? '#155724' : event.status === 'completed' ? '#721c24' : '#383d41',
                                    padding: "3px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold", textTransform: "capitalize", whiteSpace: "nowrap"
                                }}>{event.status}</span>
                            </div>
                            <p style={{ margin: "4px 0" }}><strong>Type:</strong> <span style={{ textTransform: "capitalize"}}>{event.eventType}</span></p>
                            <p style={{ margin: "4px 0" }}><strong>Registrations:</strong> {event.registrationCount || 0} / {event.registrationLimit}</p>
                            <p style={{ margin: "4px 0" }}><strong>Starts:</strong> {new Date(event.startDate).toLocaleDateString()}</p>
                            
                            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                                <Link to={`/organizer/event/${event._id}`}>
                                    <button style={{ padding: "5px 10px", cursor: "pointer" }}>Manage</button>
                                </Link>
                                
                                {(event.status === 'draft' || event.status === 'upcoming') && (
                                    <Link to={`/organizer/edit-event/${event._id}`}>
                                        <button style={{ padding: "5px 10px", cursor: "pointer", background: "#ffc107", border: "none", borderRadius: "3px" }}>Edit Event</button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <hr style={{ margin: "40px 0" }} />
            <h2>Completed Events: Analytics</h2>
            {completedAnalytics.length === 0 ? (
                <p>No completed events yet.</p>
            ) : (
                <div 
                    style = {{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                        gap: '20px',
                        marginTop: '20px'
                }}>
                    {completedAnalytics.map(event => {
                        const capacity = event.eventType === 'merchandise' ? event.stock : event.registrationLimit;
                        const fillRate = capacity ? Math.round((event.ticketsSold / capacity) * 100) : 0;
                        const attendanceRate = event.ticketsSold ? Math.round((event.attendanceCount / event.ticketsSold) * 100) : 0;
                        return (
                            <div key={event._id} style={{
                                border: "1px solid #ddd",
                                padding: "20px",
                                borderRadius: "8px",
                                background: "#fafafa"
                            }}>
                                <h3 style={{ margin: "0 0 12px 0" }}>{event.name}</h3>
                                <p style={{ margin: "6px 0" }}>
                                    <strong>Registrations:</strong> {event.totalRegistrations} total &nbsp;|&nbsp; {event.ticketsSold} active
                                </p>
                                <p style={{ margin: "6px 0" }}>
                                    <strong>Fill Rate:</strong> {event.ticketsSold} / {capacity} &nbsp;
                                    <span style={{
                                        background: fillRate >= 80 ? "#d4edda" : fillRate >= 50 ? "#fff3cd" : "#f8d7da",
                                        color: fillRate >= 80 ? "#155724" : fillRate >= 50 ? "#856404" : "#721c24",
                                        padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem"
                                    }}>{fillRate}%</span>
                                </p>
                                <p style={{ margin: "6px 0" }}>
                                    <strong>Revenue:</strong> ₹{event.totalRevenue.toLocaleString()}
                                </p>
                                <p style={{ margin: "6px 0" }}>
                                    <strong>Attendance:</strong> {event.attendanceCount} &nbsp;
                                    <span style={{
                                        background: "#e2e3e5", color: "#383d41",
                                        padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem"
                                    }}>{attendanceRate}% showed up</span>
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrganizerDashboard;
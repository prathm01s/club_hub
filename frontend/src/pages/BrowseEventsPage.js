import { useState, useEffect, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

const BrowseEventsPage = () => {
    const { authTokens, user } = useContext(AuthContext);
    const [events, setEvents] = useState([]);
    
    // Separate search input state so we don't fetch on every single keystroke
    const [searchInput, setSearchInput] = useState("");

    // The active filters that actually trigger the API call
    const [filters, setFilters] = useState({
        search: "",
        type: "",
        eligibility: "",
        trending: false,
        followed: false,
        startDate: "",
        endDate: ""
    });

    // Build the URL and fetch data
    const fetchEvents = useCallback(async () => {
        try {
            // Use the standard URL object to safely build query strings
            let url = new URL("http://localhost:5000/api/events");
            
            if (filters.search) url.searchParams.append("search", filters.search);
            if (filters.type) url.searchParams.append("type", filters.type);
            if (filters.eligibility) url.searchParams.append("eligibility", filters.eligibility);
            if (filters.trending) url.searchParams.append("trending", "true");
            if (filters.followed) url.searchParams.append("followed", "true");
            if (filters.startDate) url.searchParams.append("startDate", filters.startDate);
            if (filters.endDate) url.searchParams.append("endDate", filters.endDate);

            // Set up headers (attach token if the user is logged in for personalized sorting)
            const headers = { "Content-Type": "application/json" };
            if (authTokens) {
                headers["x-auth-token"] = authTokens.token;
            }

            const response = await fetch(url, { method: "GET", headers });
            const data = await response.json();

            if (response.ok) {
                setEvents(data);
            }
        } catch (err) {
            console.error("Failed to fetch events:", err);
        }
    }, [filters, authTokens]);

    // Trigger fetch whenever filters change
    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Handlers
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setFilters(prev => ({ ...prev, search: searchInput }));
    };

    const handleFilterChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFilters(prev => ({ ...prev, [e.target.name]: value }));
    };

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>
            <h1>Browse Events</h1>

            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                
                {/* LEFT SIDEBAR: Filters (Section 9.3) */}
                <div style={{ width: "250px", background: "#f4f4f4", padding: "20px", borderRadius: "8px", flexShrink: 0 }}>
                    <h3>Filters</h3>
                    
                    {/* Search Bar */}
                    <form onSubmit={handleSearchSubmit} style={{ marginBottom: "20px" }}>
                        <input 
                            type="text" 
                            placeholder="Search events/clubs..." 
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            style={{ width: "100%", padding: "8px", marginBottom: "5px", boxSizing: "border-box" }}
                        />
                        <button type="submit" style={{ width: "100%", padding: "8px", cursor: "pointer" }}>Search</button>
                    </form>

                    {/* Checkbox Filters */}
                    <div style={{ marginBottom: "15px" }}>
                        <label style={{ display: "block", marginBottom: "5px" }}>
                            <input type="checkbox" name="trending" checked={filters.trending} onChange={handleFilterChange} /> 
                            🔥 Trending (Top 5/24h)
                        </label>
                        {user && (
                            <label style={{ display: "block", marginBottom: "5px" }}>
                                <input type="checkbox" name="followed" checked={filters.followed} onChange={handleFilterChange} /> 
                                ⭐️ Followed Clubs
                            </label>
                        )}
                    </div>

                    {/* Dropdown Filters */}
                    <div style={{ marginBottom: "15px" }}>
                        <label>Event Type:</label>
                        <select name="type" value={filters.type} onChange={handleFilterChange} style={{ width: "100%", padding: "5px", marginTop: "5px" }}>
                            <option value="">All</option>
                            <option value="normal">Normal</option>
                            <option value="merchandise">Merchandise</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Eligibility:</label>
                        <select name="eligibility" value={filters.eligibility} onChange={handleFilterChange} style={{ width: "100%", padding: "5px", marginTop: "5px" }}>
                            <option value="">All</option>
                            <option value="iiit-only">IIIT Only</option>
                        </select>
                    </div>

                    {/* Date Filters */}
                    <div style={{ marginBottom: "15px" }}>
                        <label>From Date:</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={{ width: "100%", padding: "5px", marginTop: "5px" }} />
                    </div>
                    <div>
                        <label>To Date:</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={{ width: "100%", padding: "5px", marginTop: "5px" }} />
                    </div>
                    
                    <button 
                        onClick={() => {
                            setSearchInput("");
                            setFilters({ search: "", type: "", eligibility: "", trending: false, followed: false, startDate: "", endDate: "" });
                        }}
                        style={{ marginTop: "20px", width: "100%", padding: "8px", background: "#dc3545", color: "white", border: "none", cursor: "pointer" }}
                    >
                        Clear All Filters
                    </button>
                </div>

                {/* RIGHT SIDE: Event Grid */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                        {events.length > 0 ? (
                            events.map(event => (
                                <div key={event._id} style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", background: "white", display: "flex", flexDirection: "column" }}>
                                    <h3 style={{ margin: "0 0 10px 0" }}>{event.name}</h3>
                                    
                                    {/* Personalization Indicator */}
                                    {event.score > 0 && <span style={{ fontSize: "0.8rem", color: "green", marginBottom: "10px" }}>✓ Recommended for you</span>}
                                    
                                    <p style={{ margin: "5px 0" }}><strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{event.eventType}</span></p>
                                    <p style={{ margin: "5px 0" }}><strong>Organizer:</strong> {event.organizer?.organizerName || event.organizer?.firstName}</p>
                                    <p style={{ margin: "5px 0" }}><strong>Date:</strong> {new Date(event.startDate).toLocaleDateString()}</p>
                                    
                                    <div style={{ marginTop: "auto", paddingTop: "15px" }}>
                                        <Link to={`/event/${event._id}`}>
                                            <button style={{ width: "100%", padding: "10px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                                                View Details
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>No events found matching your criteria.</p>
                        )}
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default BrowseEventsPage;
import { useState, useEffect, useContext, useRef } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

const BrowseEventsPage = () => {
    const { authTokens, user } = useContext(AuthContext);
    const authTokensRef = useRef(authTokens);
    useEffect(() => { authTokensRef.current = authTokens; }, [authTokens]);

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Separate search input state so we can debounce it
    const [searchInput, setSearchInput] = useState("");
    const debounceTimer = useRef(null);

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

    // Auto-search with 400ms debounce as user types
    const handleSearchInputChange = (e) => {
        const val = e.target.value;
        setSearchInput(val);
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: val }));
        }, 400);
    };

    // Fetch whenever filters change — authTokens accessed via ref to avoid re-fetch loops
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            setError("");
            try {
                const url = new URL("http://localhost:5000/api/events");
                url.searchParams.set("status", "all");
                if (filters.search)      url.searchParams.set("search", filters.search);
                if (filters.type)        url.searchParams.set("type", filters.type);
                if (filters.eligibility) url.searchParams.set("eligibility", filters.eligibility);
                if (filters.trending)    url.searchParams.set("trending", "true");
                if (filters.followed)    url.searchParams.set("followed", "true");
                if (filters.startDate)   url.searchParams.set("startDate", filters.startDate);
                if (filters.endDate)     url.searchParams.set("endDate", filters.endDate);

                const headers = { "Content-Type": "application/json" };
                const token = authTokensRef.current?.token;
                if (token) headers["x-auth-token"] = token;

                const res = await fetch(url.toString(), { headers });
                const data = await res.json();

                if (cancelled) return;
                if (!res.ok) {
                    setError(data.msg || `Error ${res.status}`);
                    setEvents([]);
                } else {
                    setEvents(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                if (!cancelled) setError("Network error: " + err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [filters]);

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
            <h1 style={{ margin: "0 0 6px 0" }}>Browse Events</h1>
            <p style={{ color: "gray", marginBottom: "20px" }}>Discover events, filter by type, eligibility, date, or your followed clubs.</p>

            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                
                {/* LEFT SIDEBAR: Filters */}
                <div style={{ width: "260px", background: "#f4f4f4", padding: "20px", borderRadius: "8px", flexShrink: 0 }}>
                    <h3 style={{ margin: "0 0 16px" }}>Filters</h3>
                    
                    {/* Search Bar with debounced auto-search */}
                    <form onSubmit={handleSearchSubmit} style={{ marginBottom: "20px" }}>
                        <input 
                            type="text" 
                            placeholder="Search events or organizers..."
                            value={searchInput}
                            onChange={handleSearchInputChange}
                            style={{ width: "100%", padding: "8px", marginBottom: "5px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
                        />
                        <button type="submit" style={{ width: "100%", padding: "8px", cursor: "pointer", borderRadius: "4px", border: "none", background: "#007bff", color: "white" }}>Search</button>

                    {/* Checkbox Filters */}
                    <div style={{ marginBottom: "15px" }}>
                        <label style={{ display: "block", marginBottom: "5px" }}>
                            <input type="checkbox" name="trending" checked={filters.trending} onChange={handleFilterChange} /> 
                            Trending (Top 5/24h)
                        </label>
                        {user && (
                            <label style={{ display: "block", marginBottom: "5px" }}>
                                <input type="checkbox" name="followed" checked={filters.followed} onChange={handleFilterChange} /> 
                                Followed Clubs
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
                    </form>
                </div>

                {/* RIGHT SIDE: Event Grid */}
                <div style={{ flex: 1 }}>
                    {loading && <p style={{ color: "gray" }}>Loading events...</p>}
                    {error && <p style={{ color: "red", fontWeight: "bold" }}>Error: {error}</p>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                        {!loading && !error && events.length === 0 && (
                            <p style={{ gridColumn: "1/-1", color: "gray" }}>No events found matching your criteria.</p>
                        )}
                        {events.map(event => {
                            const isMerch = event.eventType === 'merchandise';
                            const isIIIT = event.eligibility === 'iiit-only';
                            const slotsLeft = isMerch ? event.stock : (event.registrationLimit - event.registrationCount);
                            const isFull = slotsLeft <= 0;
                            const organizerName = event.organizer?.organizerName ||
                                `${event.organizer?.firstName || ''} ${event.organizer?.lastName || ''}`.trim();

                            return (
                                <div key={event._id} style={{ border: "1px solid #ddd", padding: "16px", borderRadius: "8px", background: "white", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                                    
                                    {/* Event name + personalization */}
                                    <h3 style={{ margin: "0 0 6px 0", fontSize: "1rem" }}>{event.name}</h3>
                                    {event.score > 0 && <span style={{ fontSize: "0.75rem", color: "#28a745", marginBottom: "8px" }}>Recommended for you</span>}

                                    {/* Type + Eligibility badges */}
                                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                                        <span style={cardBadge}>{isMerch ? 'Merch' : 'Normal'}</span>
                                        <span style={{ ...cardBadge, background: isIIIT ? '#fff3cd' : '#d4edda', color: isIIIT ? '#856404' : '#155724' }}>
                                            {isIIIT ? 'IIIT Only' : 'Open'}
                                        </span>
                                        {event.status === 'upcoming' && <span style={{ ...cardBadge, background: '#e2d9f3', color: '#6f42c1' }}>Upcoming</span>}
                                        {event.status === 'ongoing' && <span style={{ ...cardBadge, background: '#cce5ff', color: '#004085' }}>Ongoing</span>}
                                        {event.status === 'completed' && <span style={{ ...cardBadge, background: '#e2e3e5', color: '#383d41' }}>Completed</span>}
                                    </div>

                                    {/* Details */}
                                    <p style={cardRow}><strong>By:</strong> {organizerName}</p>
                                    <p style={cardRow}><strong>Date:</strong> {new Date(event.startDate).toLocaleDateString()}</p>
                                    <p style={cardRow}>
                                        <strong>Fee:</strong> {event.fee > 0 ? `₹${event.fee}` : <span style={{ color: '#28a745' }}>Free</span>}
                                    </p>
                                    <p style={{ ...cardRow, color: isFull ? '#dc3545' : slotsLeft <= 10 ? '#856404' : '#555', fontWeight: isFull || slotsLeft <= 10 ? 'bold' : 'normal' }}>
                                        {isMerch
                                            ? (isFull ? 'Out of Stock' : `${slotsLeft} in stock`)
                                            : (isFull ? 'Fully Booked' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} left`)}
                                    </p>

                                    <div style={{ marginTop: "auto", paddingTop: "14px" }}>
                                        <Link to={`/event/${event._id}`} style={{ display: "block" }}>
                                            <button style={{ width: "100%", padding: "10px", background: isFull ? "#6c757d" : "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                                {isFull ? 'View Details' : (isMerch ? 'Buy Now' : 'Register')}
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
            </div>
        </div>
    );
};

const cardBadge = { background: "#e9ecef", padding: "3px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "bold" };
const cardRow = { margin: "4px 0", fontSize: "0.9rem" };

export default BrowseEventsPage;
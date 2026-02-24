import React, { useState, useEffect, useContext } from "react";
import AuthContext from "../context/AuthContext";

/**
 * Organizer Feedback Dashboard — shows stats, rating distribution, filterable feedback, and CSV export.
 * Props: eventId (string)
 */
const FeedbackDashboard = ({ eventId }) => {
    const { authTokens } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRating, setFilterRating] = useState("");
    const [sortBy, setSortBy] = useState("newest");

    // Fetch stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/feedback/${eventId}/stats`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Failed to load stats");
            }
        };
        fetchStats();
    }, [eventId, authTokens]);

    // Fetch feedbacks with filters
    useEffect(() => {
        const fetchFeedbacks = async () => {
            setLoading(true);
            try {
                const url = new URL(`http://localhost:5000/api/feedback/${eventId}`);
                if (filterRating) {
                    url.searchParams.set("minRating", filterRating);
                    url.searchParams.set("maxRating", filterRating);
                }
                const sortMap = { newest: "newest", oldest: "oldest", rating_high: "rating_desc", rating_low: "rating_asc" };
                url.searchParams.set("sort", sortMap[sortBy] || "newest");

                const res = await fetch(url.toString(), {
                    headers: { "x-auth-token": authTokens.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    setFeedbacks(data);
                }
            } catch (err) {
                console.error("Failed to load feedbacks");
            } finally {
                setLoading(false);
            }
        };
        fetchFeedbacks();
    }, [eventId, authTokens, filterRating, sortBy]);

    const handleExport = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/feedback/${eventId}/export`, {
                headers: { "x-auth-token": authTokens.token }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `feedback_export.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error("Export failed", err);
        }
    };

    // Render stars
    const Stars = ({ count }) => (
        <span style={{ color: "#f59e0b", letterSpacing: "1px" }}>
            {"★".repeat(count)}{"☆".repeat(5 - count)}
        </span>
    );

    if (!stats && loading) {
        return <p style={{ color: "#888" }}>Loading feedback...</p>;
    }

    return (
        <div style={{ background: "#f9fafb", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, color: "#111" }}>Feedback & Ratings</h3>
                {stats && stats.totalFeedbacks > 0 && (
                    <button onClick={handleExport} style={{
                        padding: "6px 14px", background: "#059669", color: "white",
                        border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem"
                    }}>
                        Export CSV
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {stats && stats.totalFeedbacks > 0 ? (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                        <div style={statCard}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#f59e0b" }}>{stats.averageRating}</div>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>Avg Rating</div>
                        </div>
                        <div style={statCard}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#4f46e5" }}>{stats.totalFeedbacks}</div>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>Total Reviews</div>
                        </div>
                        <div style={statCard}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#22c55e" }}>{stats.maxRating}★</div>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>Highest</div>
                        </div>
                        <div style={statCard}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#ef4444" }}>{stats.minRating}★</div>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>Lowest</div>
                        </div>
                    </div>

                    {/* Rating Distribution */}
                    <div style={{ marginBottom: "20px" }}>
                        <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#555" }}>Rating Distribution</h4>
                        {[5, 4, 3, 2, 1].map(star => {
                            const count = stats.ratingDistribution[star] || 0;
                            const pct = stats.totalFeedbacks > 0 ? (count / stats.totalFeedbacks) * 100 : 0;
                            return (
                                <div key={star} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{ width: "30px", fontSize: "0.85rem", color: "#555" }}>{star}★</span>
                                    <div style={{ flex: 1, height: "12px", background: "#e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
                                        <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: "6px", transition: "width 0.3s" }} />
                                    </div>
                                    <span style={{ width: "30px", fontSize: "0.8rem", color: "#888", textAlign: "right" }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filters */}
                    <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                        <select value={filterRating} onChange={e => setFilterRating(e.target.value)} style={selectStyle}>
                            <option value="">All Ratings</option>
                            {[5, 4, 3, 2, 1].map(r => (
                                <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>
                            ))}
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="rating_high">Highest Rated</option>
                            <option value="rating_low">Lowest Rated</option>
                        </select>
                    </div>

                    {/* Feedback List */}
                    {loading ? (
                        <p style={{ color: "#888" }}>Loading...</p>
                    ) : feedbacks.length === 0 ? (
                        <p style={{ color: "#888" }}>No feedback matches your filter.</p>
                    ) : (
                        feedbacks.map(fb => (
                            <div key={fb._id} style={{
                                background: "white", padding: "12px 16px", borderRadius: "6px",
                                border: "1px solid #e5e7eb", marginBottom: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Stars count={fb.rating} />
                                    <span style={{ fontSize: "0.75rem", color: "#999" }}>
                                        {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                {fb.comment && (
                                    <p style={{ margin: "8px 0 0", fontSize: "0.9rem", color: "#333", lineHeight: "1.4" }}>
                                        {fb.comment}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </>
            ) : (
                <p style={{ color: "#888" }}>No feedback received yet.</p>
            )}
        </div>
    );
};

const statCard = {
    background: "white", padding: "14px", borderRadius: "6px",
    border: "1px solid #e5e7eb", textAlign: "center"
};

const selectStyle = {
    padding: "6px 10px", border: "1px solid #d1d5db",
    borderRadius: "4px", fontSize: "0.85rem"
};

export default FeedbackDashboard;

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const AdminOverviewPage = () => {
    const { authTokens } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/stats", {
                    headers: { "x-auth-token": authTokens.token }
                });
                const data = await res.json();
                if (res.ok) setStats(data);
            } catch (err) {
                console.error("Failed to fetch admin stats");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [authTokens]);

    if (loading) return <div style={{ padding: "30px" }}>Loading dashboard...</div>;

    return (
        <div style={{ padding: "30px", maxWidth: "1000px", margin: "auto" }}>
            <h1 style={{ marginBottom: "8px" }}>Admin Dashboard</h1>
            <p style={{ color: "#666", marginBottom: "30px" }}>
                Overview of the EventManager system.
            </p>

            {/* Stat Cards */}
            {stats && (
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "40px" }}>
                    <StatCard label="Total Organizers" value={stats.totalOrganizers} color="#007bff" />
                    <StatCard label="Active Organizers" value={stats.activeOrganizers} color="#28a745" />
                    <StatCard label="Disabled Organizers" value={stats.disabledOrganizers} color="#6c757d" />
                    <StatCard label="Total Participants" value={stats.totalParticipants} color="#17a2b8" />
                    <StatCard label="Total Events" value={stats.totalEvents} color="#fd7e14" />
                    <StatCard
                        label="Pending Password Resets"
                        value={stats.pendingResets}
                        color={stats.pendingResets > 0 ? "#dc3545" : "#28a745"}
                    />
                </div>
            )}

            {/* Quick-action links */}
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <QuickLink to="/admin-dashboard" label="Manage Clubs / Organizers" desc="Create, activate, disable or permanently remove organizer accounts." />
                <QuickLink
                    to="/admin-password-resets"
                    label="Password Reset Requests"
                    desc="Review and action password reset requests submitted by organizers or participants."
                    badge={stats && stats.pendingResets > 0 ? stats.pendingResets : null}
                />
            </div>
        </div>
    );
};

const StatCard = ({ label, value, color }) => (
    <div style={{
        flex: "1 1 140px",
        background: "white",
        border: `2px solid ${color}`,
        borderRadius: "10px",
        padding: "20px",
        textAlign: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.07)"
    }}>
        <div style={{ fontSize: "2.2rem", fontWeight: "bold", color }}>{value}</div>
        <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "6px" }}>{label}</div>
    </div>
);

const QuickLink = ({ to, label, desc, badge }) => (
    <Link to={to} style={{ textDecoration: "none", flex: "1 1 280px" }}>
        <div style={{
            background: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            padding: "20px",
            cursor: "pointer",
            transition: "box-shadow 0.2s",
            position: "relative"
        }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
        >
            {badge && (
                <span style={{
                    position: "absolute", top: "12px", right: "12px",
                    background: "#dc3545", color: "white", borderRadius: "50%",
                    width: "24px", height: "24px", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "0.8rem", fontWeight: "bold"
                }}>
                    {badge}
                </span>
            )}
            <h3 style={{ margin: "0 0 8px 0", color: "#333" }}>{label}</h3>
            <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>{desc}</p>
        </div>
    </Link>
);

export default AdminOverviewPage;

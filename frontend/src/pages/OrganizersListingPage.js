import { useEffect, useState, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

const OrganizersListPage = () => {
    const { authTokens, user } = useContext(AuthContext);
    const [organizers, setOrganizers] = useState([]);
    const [followingIds, setFollowingIds] = useState([]); // normalized string IDs
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(null); // org ID currently being toggled

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const orgRes = await fetch(`${process.env.REACT_APP_API_URL}/api/users/organizers`);
            const orgData = await orgRes.json();
            setOrganizers(orgData);

            // Only fetch profile (following list) when authenticated as participant
            if (authTokens && user?.role === "participant") {
                const profileRes = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                const profileData = await profileRes.json();
                // Normalize ObjectIds → strings for reliable comparison
                setFollowingIds((profileData.following || []).map(id => id.toString()));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [authTokens, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleFollow = async (orgId) => {
        if (!authTokens) return;
        setFollowLoading(orgId);

        const already = followingIds.includes(orgId);
        const newFollowing = already
            ? followingIds.filter(id => id !== orgId)
            : [...followingIds, orgId];

        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({ following: newFollowing })
            });
            if (res.ok) setFollowingIds(newFollowing);
        } catch (err) {
            console.error("Error updating follow status");
        } finally {
            setFollowLoading(null);
        }
    };

    // Derive unique categories for the filter dropdown
    const categories = [...new Set(organizers.map(o => o.organizerCategory).filter(Boolean))].sort();

    const displayed = organizers.filter(org => {
        const q = search.toLowerCase();
        const matchesSearch =
            !search ||
            (org.organizerName || "").toLowerCase().includes(q) ||
            (org.description || "").toLowerCase().includes(q) ||
            (org.organizerCategory || "").toLowerCase().includes(q);
        const matchesCat = !categoryFilter || org.organizerCategory === categoryFilter;
        return matchesSearch && matchesCat;
    });

    return (
        <div style={{ padding: "20px", maxWidth: "1100px", margin: "auto" }}>
            <h1 style={{ margin: "0 0 4px 0" }}>Clubs &amp; Organizers</h1>
            <p style={{ color: "gray", marginBottom: "24px" }}>
                Discover clubs and organizers. Follow them to stay updated on their events.
            </p>

            {/* Search + Category filter bar */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                <input
                    type="text"
                    placeholder="Search by name, category or description..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        flex: 1, minWidth: "220px", padding: "9px 12px",
                        border: "1px solid #ccc", borderRadius: "5px", fontSize: "0.95rem"
                    }}
                />
                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    style={{
                        padding: "9px 12px", border: "1px solid #ccc",
                        borderRadius: "5px", fontSize: "0.95rem", minWidth: "180px"
                    }}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(search || categoryFilter) && (
                    <button
                        onClick={() => { setSearch(""); setCategoryFilter(""); }}
                        style={{
                            padding: "9px 14px", background: "#dc3545", color: "white",
                            border: "none", borderRadius: "5px", cursor: "pointer"
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {loading ? (
                <p style={{ color: "gray" }}>Loading organizers...</p>
            ) : displayed.length === 0 ? (
                <p style={{ color: "gray" }}>No organizers found.</p>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
                    gap: "20px"
                }}>
                    {displayed.map(org => {
                        const orgId = org._id.toString();
                        const isFollowing = followingIds.includes(orgId);
                        const isToggling  = followLoading === org._id || followLoading === orgId;
                        return (
                            <div key={org._id} style={{
                                border: "1px solid #ddd", padding: "20px", borderRadius: "8px",
                                background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                                display: "flex", flexDirection: "column"
                            }}>
                                {/* Header row */}
                                <div style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", marginBottom: "8px"
                                }}>
                                    <div>
                                        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem" }}>
                                            {org.organizerName || "Unnamed Organizer"}
                                        </h3>
                                        {org.organizerCategory && (
                                            <span style={{
                                                display: "inline-block", padding: "2px 10px",
                                                borderRadius: "10px", background: "#e9ecef",
                                                fontSize: "0.78rem", fontWeight: "bold", color: "#495057"
                                            }}>
                                                {org.organizerCategory}
                                            </span>
                                        )}
                                    </div>
                                    {isFollowing && (
                                        <span style={{
                                            fontSize: "0.75rem", color: "#28a745",
                                            fontWeight: "bold", marginLeft: "8px", whiteSpace: "nowrap"
                                        }}>
                                            ✓ Following
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                <p style={{
                                    color: "#555", fontSize: "0.9rem",
                                    lineHeight: "1.5", flex: 1, margin: "8px 0 12px 0"
                                }}>
                                    {org.description
                                        ? org.description
                                        : <em style={{ color: "#aaa" }}>No description provided.</em>}
                                </p>

                                {/* Contact email */}
                                {org.contactEmail && (
                                    <p style={{ fontSize: "0.82rem", color: "#666", margin: "0 0 14px 0" }}>
                                        ✉ <a href={`mailto:${org.contactEmail}`} style={{ color: "#007bff" }}>
                                            {org.contactEmail}
                                        </a>
                                    </p>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                                    <Link to={`/organizer/${org._id}`} style={{ flex: 1 }}>
                                        <button style={{
                                            width: "100%", padding: "8px", cursor: "pointer",
                                            background: "#f8f9fa", border: "1px solid #ccc",
                                            borderRadius: "4px", fontWeight: "500"
                                        }}>
                                            View Profile
                                        </button>
                                    </Link>

                                    {user?.role === "participant" && (
                                        <button
                                            onClick={() => toggleFollow(orgId)}
                                            disabled={isToggling}
                                            style={{
                                                padding: "8px 16px", cursor: "pointer",
                                                border: "none", borderRadius: "4px",
                                                background: isFollowing ? "#6c757d" : "#007bff",
                                                color: "white", fontWeight: "bold",
                                                fontSize: "0.85rem",
                                                opacity: isToggling ? 0.6 : 1
                                            }}
                                        >
                                            {isToggling ? "..." : (isFollowing ? "Unfollow" : "Follow")}
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

export default OrganizersListPage;
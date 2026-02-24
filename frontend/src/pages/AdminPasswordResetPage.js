import { useState, useEffect, useContext } from "react";
import AuthContext from "../context/AuthContext";

const AdminPasswordResetPage = () => {
    const { authTokens } = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    // Maps requestId → revealed plain-text password (shown once after approval)
    const [revealedPasswords, setRevealedPasswords] = useState({});

    const fetchRequests = async () => {
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/password-reset-requests", {
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) setRequests(data);
        } catch (err) {
            console.error("Failed to fetch reset requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authTokens]);

    const handleApprove = async (id) => {
        if (!window.confirm("Approve this request? A new password will be generated.")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/password-reset-requests/${id}/approve`, {
                method: "PUT",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) {
                // Reveal the generated password for this request only
                setRevealedPasswords(prev => ({ ...prev, [id]: data.newPassword }));
                fetchRequests();
            } else {
                alert(data.msg || "Failed to approve request");
            }
        } catch (err) {
            alert("Server Error");
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Reject this password reset request?")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/admin/password-reset-requests/${id}/reject`, {
                method: "PUT",
                headers: { "x-auth-token": authTokens.token }
            });
            if (res.ok) {
                fetchRequests();
            } else {
                alert("Failed to reject request");
            }
        } catch (err) {
            alert("Server Error");
        }
    };

    const statusColor = (status) => {
        if (status === "pending") return "#ffc107";
        if (status === "approved") return "#28a745";
        if (status === "rejected") return "#dc3545";
        return "#6c757d";
    };

    const pending = requests.filter(r => r.status === "pending");
    const resolved = requests.filter(r => r.status !== "pending");

    if (loading) return <div style={{ padding: "30px" }}>Loading requests...</div>;

    return (
        <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
            <h1 style={{ marginBottom: "6px" }}>Password Reset Requests</h1>
            <p style={{ color: "#666", marginBottom: "30px" }}>
                Review requests submitted by organizers and participants who cannot access their accounts.
                When you approve a request, a new password is auto-generated and shown here — share it securely with the user.
            </p>

            {/* PENDING SECTION */}
            <h2 style={{ color: "#856404", background: "#fff3cd", padding: "10px 16px", borderRadius: "6px", display: "inline-block" }}>
                ⏳ Pending ({pending.length})
            </h2>

            {pending.length === 0 ? (
                <p style={{ color: "#666" }}>No pending requests.</p>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px", marginBottom: "30px" }}>
                    <thead>
                        <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                            <th style={th}>User</th>
                            <th style={th}>Email</th>
                            <th style={th}>Role</th>
                            <th style={th}>Requested At</th>
                            <th style={th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.map(req => (
                            <tr key={req._id} style={{ borderBottom: "1px solid #eee" }}>
                                <td style={td}><strong>{req.userName || "—"}</strong></td>
                                <td style={td}>{req.userEmail}</td>
                                <td style={td}><span style={{ textTransform: "capitalize" }}>{req.userRole}</span></td>
                                <td style={td}>{new Date(req.createdAt).toLocaleDateString()}</td>
                                <td style={td}>
                                    <button
                                        onClick={() => handleApprove(req._id)}
                                        style={{ ...btn, background: "#28a745", marginRight: "8px" }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(req._id)}
                                        style={{ ...btn, background: "#dc3545" }}
                                    >
                                        Reject
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* GENERATED PASSWORDS (shown immediately after approval during this session) */}
            {Object.keys(revealedPasswords).length > 0 && (
                <div style={{ background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: "6px", padding: "16px", marginBottom: "30px" }}>
                    <h3 style={{ margin: "0 0 10px 0", color: "#155724" }}>✅ Generated Passwords (copy now — won't be shown again)</h3>
                    {requests.filter(r => revealedPasswords[r._id]).map(r => (
                        <div key={r._id} style={{ marginBottom: "8px", fontFamily: "monospace", fontSize: "0.95rem" }}>
                            <strong>{r.userName}</strong> ({r.userEmail}) →{" "}
                            <span style={{ background: "white", padding: "2px 6px", borderRadius: "3px" }}>
                                {revealedPasswords[r._id]}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* RESOLVED SECTION */}
            <h2 style={{ color: "#383d41", background: "#e8e9ea", padding: "10px 16px", borderRadius: "6px", display: "inline-block" }}>
                📋 History ({resolved.length})
            </h2>

            {resolved.length === 0 ? (
                <p style={{ color: "#666" }}>No resolved requests yet.</p>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
                    <thead>
                        <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                            <th style={th}>User</th>
                            <th style={th}>Email</th>
                            <th style={th}>Role</th>
                            <th style={th}>Status</th>
                            <th style={th}>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resolved.map(req => (
                            <tr key={req._id} style={{ borderBottom: "1px solid #eee" }}>
                                <td style={td}>{req.userName || "—"}</td>
                                <td style={td}>{req.userEmail}</td>
                                <td style={td}><span style={{ textTransform: "capitalize" }}>{req.userRole}</span></td>
                                <td style={td}>
                                    <span style={{
                                        background: statusColor(req.status),
                                        color: "white",
                                        padding: "2px 10px",
                                        borderRadius: "12px",
                                        fontSize: "0.85rem",
                                        textTransform: "capitalize"
                                    }}>
                                        {req.status}
                                    </span>
                                </td>
                                <td style={td}>{new Date(req.updatedAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const th = { padding: "12px", textAlign: "left", color: "#333" };
const td = { padding: "12px", verticalAlign: "middle" };
const btn = { padding: "6px 12px", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" };

export default AdminPasswordResetPage;

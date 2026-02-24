import { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { Html5QrcodeScanner } from 'html5-qrcode';
import FeedbackDashboard from "../components/FeedbackDashboard";

const STATUS_COLORS = {
    registered: { bg: "#d4edda", color: "#155724" },
    attended: { bg: "#cce5ff", color: "#004085" },
    cancelled: { bg: "#f8d7da", color: "#721c24" },
};

const OrganizerEventDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authTokens } = useContext(AuthContext);
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // ─────────────────────────────────────────────────────────
    // QR Scanner & Attendance Logic
    // ─────────────────────────────────────────────────────────
    const [scanResult, setScanResult] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef(null);

    useEffect(() => {
        if (showScanner) {
            scannerRef.current = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false);
            scannerRef.current.render(onScanSuccess, onScanFailure);
        } else {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
                scannerRef.current = null;
            }
        }
        return () => {
            if (scannerRef.current) scannerRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showScanner]);

    const onScanSuccess = async (decodedText) => {
        let ticketId = decodedText;
        try {
            const parsed = JSON.parse(decodedText);
            if (parsed.ticketId) ticketId = parsed.ticketId;
        } catch (e) { /* ignore, assume it's a raw string */ }

        if (scannerRef.current) scannerRef.current.pause(true);

        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/registrations/scan/${ticketId}`, {
                method: "PUT",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();

            if (res.ok) {
                setScanResult({ type: 'success', text: `${data.msg} (${data.participant})` });
                setRegistrations(prev => prev.map(reg => reg.ticketId === ticketId ? { ...reg, status: 'attended' } : reg));
                setTimeout(() => {
                    setScanResult(null);
                    if (scannerRef.current) scannerRef.current.resume();
                }, 3000);
            } else {
                setScanResult({ type: 'error', text: data.msg || "Invalid Ticket" });
                setTimeout(() => {
                    setScanResult(null);
                    if (scannerRef.current) scannerRef.current.resume();
                }, 3000);
            }
        } catch (err) {
            setScanResult({ type: 'error', text: "Server error during scan." });
            setTimeout(() => {
                setScanResult(null);
                if (scannerRef.current) scannerRef.current.resume();
            }, 3000);
        }
    };

    const onScanFailure = (error) => { };

    useEffect(() => {
        const fetchEventData = async () => {
            try {
                const [eventRes, regRes] = await Promise.all([
                    fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}`),
                    fetch(`${process.env.REACT_APP_API_URL}/api/registrations/event/${id}`, {
                        headers: { "x-auth-token": authTokens.token }
                    })
                ]);
                const eventData = await eventRes.json();
                const regData = await regRes.json();

                if (eventRes.ok) setEvent(eventData);
                if (regRes.ok) setRegistrations(regData);
            } catch (err) {
                console.error("Failed to fetch event data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEventData();
    }, [id, authTokens]);

    // --- Analytics ---
    const activeRegs = registrations.filter(r => r.status !== "cancelled");
    const ticketsSold = activeRegs.reduce((sum, r) => sum + (r.quantity || 1), 0);
    const totalRevenue = ticketsSold * (event?.fee || 0);
    const attended = registrations.filter(r => r.status === "attended").length;
    const capacity = event?.eventType === "merchandise" ? event?.stock : event?.registrationLimit;
    const fillRate = capacity ? Math.round((ticketsSold / capacity) * 100) : 0;
    const attendRate = ticketsSold ? Math.round((attended / ticketsSold) * 100) : 0;

    // Team completion (for hackathon events): count unique completed team IDs in registrations
    const completedTeamsCount = event?.isTeamEvent
        ? new Set(registrations.filter(r => r.team && r.status !== 'cancelled').map(r =>
            typeof r.team === 'object' ? r.team._id || r.team : r.team
        )).size
        : 0;

    // --- Attendance Toggle ---
    const handleToggleAttendance = async (regId) => {
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/registrations/${regId}/attend`, {
                method: "PUT",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) {
                setRegistrations(prev =>
                    prev.map(r => r._id === regId ? { ...r, status: data.registration.status } : r)
                );
            } else {
                alert(data.msg || "Failed to update attendance.");
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    // --- Search & Filter ---
    const filteredRegistrations = registrations.filter(reg => {
        const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
        const matchesSearch =
            fullName.includes(searchTerm.toLowerCase()) ||
            reg.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.ticketId.includes(searchTerm) ||
            (reg.teamName && reg.teamName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === "all" || reg.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // --- CSV Export ---
    const exportCSV = () => {
        const header = "Ticket ID,First Name,Last Name,Email,Contact,Status,Payment,Team,Quantity,Reg Date";
        const rows = filteredRegistrations.map(reg =>
            [
                reg.ticketId,
                reg.user.firstName,
                reg.user.lastName,
                reg.user.email,
                reg.user.contactNumber || "N/A",
                reg.status,
                reg.paymentStatus || "N/A",
                reg.teamName || "N/A",
                reg.quantity,
                new Date(reg.createdAt).toLocaleDateString()
            ].join(",")
        );
        const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${event.name}_Participants.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Status Actions ---
    const handleCloseRegistrations = async () => {
        if (!window.confirm("Close registrations? The event will move to 'Ongoing' and no new registrations will be accepted.")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ status: "ongoing" })
            });
            const data = await res.json();
            if (res.ok) {
                setEvent(prev => ({ ...prev, status: "ongoing" }));
                alert("Registrations closed. Event is now Ongoing.");
            } else {
                alert(data.msg || "Failed to close registrations.");
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    const handleCompleteEvent = async () => {
        if (!window.confirm("Mark this event as completed?")) return;
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ status: "completed" })
            });
            const data = await res.json();
            if (res.ok) {
                setEvent(prev => ({ ...prev, status: "completed" }));
                alert("Event marked as completed.");
            } else {
                alert(data.msg || "Failed to update status.");
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading event data...</div>;
    if (!event) return <div style={{ padding: "40px", textAlign: "center" }}>Event not found or unauthorized.</div>;

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>

            {/* Back button */}
            <button onClick={() => navigate("/organizer-dashboard")} style={{ marginBottom: "16px", background: "none", border: "none", cursor: "pointer", color: "#007bff", fontSize: "0.95rem" }}>
                ← Back to Dashboard
            </button>

            {/* SECTION 1: Overview */}
            <div style={{ background: "#f4f4f4", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            <h1 style={{ margin: 0 }}>{event.name}</h1>
                            <span style={{
                                background: event.status === 'upcoming' ? '#e2d9f3' : event.status === 'ongoing' ? '#d4edda' : event.status === 'completed' ? '#f8d7da' : '#e2e3e5',
                                color: event.status === 'upcoming' ? '#6f42c1' : event.status === 'ongoing' ? '#155724' : event.status === 'completed' ? '#721c24' : '#383d41',
                                padding: "4px 12px", borderRadius: "12px", fontWeight: "bold", fontSize: "0.9rem", textTransform: "capitalize"
                            }}>{event.status}</span>
                        </div>
                        <p style={{ margin: "10px 0 4px" }}>
                            <strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{event.eventType}</span>
                            &nbsp;|&nbsp;
                            <strong>Eligibility:</strong> <span style={{ textTransform: "capitalize" }}>{event.eligibility}</span>
                            &nbsp;|&nbsp;
                            <strong>Pricing:</strong> {event.fee > 0 ? `₹${event.fee}` : "Free"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>Start:</strong> {new Date(event.startDate).toLocaleString()}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>End:</strong> {new Date(event.endDate).toLocaleString()}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>Reg. Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}
                        </p>
                        {event.description && (
                            <p style={{ margin: "10px 0 0", color: "#555" }}>{event.description}</p>
                        )}
                    </div>

                    {/* Status action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "180px" }}>
                        <button
                            onClick={() => navigate(`/organizer/edit-event/${id}`)}
                            style={{ padding: "9px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                        >
                            ✏️ Edit Event
                        </button>

                        {(event.status === 'upcoming' || event.status === 'published') && (
                            <button
                                onClick={handleCloseRegistrations}
                                style={{ padding: "9px 16px", background: "#fd7e14", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                            >
                                🔒 Close Registrations
                            </button>
                        )}

                        {(event.status === 'upcoming' || event.status === 'published' || event.status === 'ongoing') && (
                            <button
                                onClick={handleCompleteEvent}
                                style={{ padding: "9px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                            >
                                ✅ Mark as Completed
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION 2: Analytics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                {[
                    { label: "Total Registrations", value: registrations.length },
                    { label: event.eventType === "merchandise" ? "Units Sold" : "Active Registrations", value: ticketsSold },
                    { label: "Capacity", value: `${ticketsSold} / ${capacity}` },
                    { label: "Fill Rate", value: `${fillRate}%` },
                    { label: "Attendance", value: `${attended} (${attendRate}%)` },
                    { label: "Est. Revenue", value: `₹${totalRevenue.toLocaleString()}` },
                    ...(event.isTeamEvent ? [{ label: "Completed Teams", value: completedTeamsCount }] : []),
                ].map(stat => (
                    <div key={stat.label} style={{ background: "white", border: "1px solid #ddd", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#007bff" }}>{stat.value}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px" }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* SECTION 3: Participants */}
            <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h2 style={{ margin: 0 }}>Participants ({filteredRegistrations.length})</h2>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => setShowScanner(!showScanner)} style={{ padding: "8px 16px", background: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                            {showScanner ? "Close Scanner" : "Scan QR Ticket"}
                        </button>
                        <button onClick={exportCSV} style={{ background: "#28a745", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                            📥 Export CSV
                        </button>
                    </div>
                </div>

                {/* Scanner UI */}
                {showScanner && (
                    <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "8px", marginBottom: "20px", border: "2px dashed #17a2b8" }}>
                        <h4 style={{ margin: "0 0 10px", textAlign: "center" }}>Point camera at Participant's QR Code or Upload File</h4>
                        {scanResult && (
                            <div style={{ textAlign: "center", padding: "10px", margin: "10px 0", borderRadius: "4px", background: scanResult.type === 'success' ? '#d4edda' : '#f8d7da', color: scanResult.type === 'success' ? '#155724' : '#721c24', fontWeight: "bold" }}>
                                {scanResult.text}
                            </div>
                        )}
                        <div id="qr-reader" style={{ width: "100%", maxWidth: "500px", margin: "0 auto" }}></div>
                    </div>
                )}

                {/* Filters */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        placeholder="Search by Name, Email, Ticket ID, or Team..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ flex: 1, minWidth: "200px", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="registered">Registered</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #ddd" }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Reg Date</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Payment</th>
                                <th style={thStyle}>Team</th>
                                <th style={thStyle}>Qty</th>
                                <th style={thStyle}>Ticket ID</th>
                                <th style={thStyle}>Attendance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRegistrations.length > 0 ? (
                                filteredRegistrations.map(reg => (
                                    <tr key={reg._id} style={{ borderBottom: "1px solid #eee", opacity: reg.status === "cancelled" ? 0.6 : 1 }}>
                                        <td style={tdStyle}>{reg.user.firstName} {reg.user.lastName}</td>
                                        <td style={tdStyle}>{reg.user.email}</td>
                                        <td style={tdStyle}>{new Date(reg.createdAt).toLocaleDateString()}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                background: (STATUS_COLORS[reg.status] || STATUS_COLORS.registered).bg,
                                                color: (STATUS_COLORS[reg.status] || STATUS_COLORS.registered).color,
                                                padding: "3px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold"
                                            }}>
                                                {reg.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                background: reg.paymentStatus === "completed" ? "#d4edda" : "#fff3cd",
                                                color: reg.paymentStatus === "completed" ? "#155724" : "#856404",
                                                padding: "3px 8px", borderRadius: "12px", fontSize: "0.8rem"
                                            }}>
                                                {reg.paymentStatus || "N/A"}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{reg.teamName || <span style={{ color: "#aaa" }}>—</span>}</td>
                                        <td style={tdStyle}>{reg.quantity}</td>
                                        <td style={tdStyle}>
                                            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }} title={reg.ticketId}>
                                                {reg.ticketId.substring(0, 8)}…
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {reg.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleToggleAttendance(reg._id)}
                                                    title={reg.status === 'attended' ? 'Click to unmark attendance' : 'Click to mark as attended'}
                                                    style={{
                                                        padding: "4px 10px", border: "none", borderRadius: "4px", cursor: "pointer",
                                                        fontSize: "0.78rem", fontWeight: "bold",
                                                        background: reg.status === 'attended' ? '#28a745' : '#e9ecef',
                                                        color: reg.status === 'attended' ? 'white' : '#495057'
                                                    }}
                                                >
                                                    {reg.status === 'attended' ? '✓ Attended' : 'Mark'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "24px", color: "gray" }}>No participants match your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 4: Feedback Dashboard */}
            <FeedbackDashboard eventId={id} />
        </div>
    );
};

const thStyle = { padding: "12px", color: "#555", fontWeight: "bold", whiteSpace: "nowrap" };
const tdStyle = { padding: "10px 12px" };

export default OrganizerEventDetailPage;

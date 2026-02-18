import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import AuthContext from "../context/AuthContext";
const OrganizerEventDetailPage = () => {
    const { id } = useParams();
    const { authTokens } = useContext(AuthContext);
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFiler, setStatusFilter] = useState("all");

    useEffect(() => {
        const fetchEventData = async () => {
            try {
                const event = await fetch(`http://localhost:5000/api/events/${id}`);
                const eventData = await event.json();

                const reg = await fetch(`http://localhost:5000/api/registrations/event/${id}`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                const regData = await reg.json();

                if (event.ok && reg.ok) {
                    setEvent(eventData);
                    setRegistrations(regData);
                }
            } catch (err) {
                console.error("Failed to fetch event data");
            } finally {
                setLoading(false);
            }
        };
        fetchEventData();
    }, [id, authTokens]);

    // --- Analytics Calculations ---
    let totalRevenue = 0;
    let totalAttendees = 0;
    if (event) {
        registrations.forEach(reg => {
            if (reg.status != "cancelled") {
                totalAttendees += reg.quantity || 1;
                // If it's normal event, fee * 1. If merch, fee/price * quantity (assuming fee represents price)
                totalRevenue += (event.fee || 0) * (reg.quantity || 1);
            }
        })
    }

    // search and filter
    const filteredRegistrations = registrations.filter(reg => {
        const matchesSearch = 
            reg.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.ticketId.includes(searchTerm);
        const matchesStatus = statusFilter === "all" || reg.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // csv export
    const exportCSV = () => {
        const headers = ["Ticket ID, First Name, Last Name, Email, Contact, Status, Quantity, Registration Date\n"];
        const rows = filteredRegistrations.map(reg => {
            return `${reg.ticketId}, ${reg.user.firstName}, ${reg.user.lastName}, ${reg.user.email}, ${reg.user.contactNumber} || 'N/A'}, ${reg.status}, ${reg.quantity}, ${new Date(reg.createdAt).toLocaleDateString()}`;
        });
        const csvContent = "data:text/csv;charset=utf-8," + headersconcat(rows).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${event_name}_Participants.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    if (loading) return <div>Loading event data...</div>;
    if (!event) return <div>Event not found or unauthorized.</div>;
    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "auto" }}>
            {/* SECTION 1: Overview */}
            <div style={{ background: "#f4f4f4", padding: "20px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
                <div>
                    <h1 style={{ marginTop: 0 }}>{event.name}</h1>
                    <p><strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{event.eventType}</span> | <strong>Status:</strong> <span style={{ textTransform: "capitalize" }}>{event.status}</span></p>
                    <p><strong>Timeline:</strong> {new Date(event.startDate).toLocaleString()} - {new Date(event.endDate).toLocaleString()}</p>
                    <p><strong>Eligibility:</strong> <span style={{ textTransform: "capitalize" }}>{event.eligibility}</span> | <strong>Pricing:</strong> ₹{event.fee || 0}</p>
                </div>
                {/* Analytics Snapshot */}
                <div style={{ background: "white", padding: "15px", borderRadius: "8px", border: "1px solid #ccc", minWidth: "200px", textAlign: "center" }}>
                    <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Analytics</h3>
                    <p style={{ margin: "5px 0" }}><strong>Registrations/Sales:</strong> {totalAttendees} / {event.registrationLimit || event.stock}</p>
                    <p style={{ margin: "5px 0" }}><strong>Est. Revenue:</strong> ₹{totalRevenue}</p>
                </div>
            </div>

            {/* SECTION 2: Participants Management */}
            <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0 }}>Participants ({filteredRegistrations.length})</h2>
                    <button onClick={exportCSV} style={{ background: "#28a745", color: "white", padding: "8px 15px", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                        📥 Export CSV
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
                    <input 
                        type="text" 
                        placeholder="Search by Name, Email, or Ticket ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="registered">Registered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                {/* Data Table */}
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #ddd" }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Reg Date</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Quantity</th>
                                <th style={thStyle}>Ticket ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRegistrations.length > 0 ? (
                                filteredRegistrations.map(reg => (
                                    <tr key={reg._id} style={{ borderBottom: "1px solid #eee", opacity: reg.status === 'cancelled' ? 0.6 : 1 }}>
                                        <td style={tdStyle}>{reg.user.firstName} {reg.user.lastName}</td>
                                        <td style={tdStyle}>{reg.user.email}</td>
                                        <td style={tdStyle}>{new Date(reg.createdAt).toLocaleDateString()}</td>
                                        <td style={tdStyle}>
                                            <span style={{ 
                                                background: reg.status === 'cancelled' ? "#f8d7da" : "#d4edda", 
                                                color: reg.status === 'cancelled' ? "#721c24" : "#155724",
                                                padding: "3px 8px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "bold"
                                            }}>
                                                {reg.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{reg.quantity}</td>
                                        <td style={tdStyle}><span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{reg.ticketId.substring(0,8)}...</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "20px", color: "gray" }}>No participants match your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const thStyle = { padding: "12px", color: "#555", fontWeight: "bold" };
const tdStyle = { padding: "12px" };

export default OrganizerEventDetailPage;
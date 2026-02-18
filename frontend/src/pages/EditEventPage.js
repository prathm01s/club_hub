import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const EditEventPage = () => {
    const { id } = useParams();
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();

    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/events/${id}`);
                const data = await response.json();
                
                if (response.ok) {
                    // Format dates for the datetime-local input
                    const formatDate = (dateString) => new Date(dateString).toISOString().slice(0, 16);
                    setEventData({
                        ...data,
                        startDate: formatDate(data.startDate),
                        endDate: formatDate(data.endDate),
                        registrationDeadline: formatDate(data.registrationDeadline)
                    });
                } else {
                    setMsg({ type: "error", text: data.msg || "Event not found." });
                }
            } catch (err) {
                setMsg({ type: "error", text: "Failed to fetch event." });
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [id]);

    const handleChange = (e) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });

        try {
            const response = await fetch(`http://localhost:5000/api/events/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify(eventData)
            });

            const data = await response.json();
            
            if (response.ok) {
                setMsg({ type: "success", text: data.msg });
                setTimeout(() => navigate('/organizer-dashboard'), 2000);
            } else {
                setMsg({ type: "error", text: data.msg || "Failed to update event." });
            }
        } catch (err) {
            setMsg({ type: "error", text: "Server error." });
        }
    };

    const handlePublish = async () => {
        if (!window.confirm("Are you sure you want to publish this event? The form and dates will be locked.")) return;
        
        try {
            const response = await fetch(`http://localhost:5000/api/events/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ status: "published" })
            });
            if (response.ok) {
                alert("Event Published!");
                navigate('/organizer-dashboard');
            }
        } catch (err) {
            alert("Failed to publish event.");
        }
    };

    if (loading) return <div>Loading event data...</div>;
    if (!eventData) return <div style={{ color: "red", padding: "20px" }}>{msg.text}</div>;

    // Rules
    const isDraft = eventData.status === 'draft';
    const isPublished = eventData.status === 'published';
    const isLocked = eventData.status === 'ongoing' || eventData.status === 'closed';

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <h1>Edit Event: {eventData.name}</h1>
            
            <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "5px", marginBottom: "20px", display: "inline-block", fontWeight: "bold" }}>
                Current Status: <span style={{ textTransform: "uppercase", color: isDraft ? "#6c757d" : isPublished ? "#007bff" : "#dc3545" }}>{eventData.status}</span>
            </div>

            {msg.text && (
                <div style={{ padding: "10px", color: "white", background: msg.type === "error" ? "#dc3545" : "#28a745", marginBottom: "15px", borderRadius: "4px" }}>
                    {msg.text}
                </div>
            )}

            {isLocked ? (
                <div style={{ background: "#fff3cd", padding: "20px", borderRadius: "8px", border: "1px solid #ffeeba" }}>
                    <h3 style={{ color: "#856404", marginTop: 0 }}>Event Locked</h3>
                    <p>Ongoing and Closed events cannot be edited. You may only change the status to Closed.</p>
                    {eventData.status !== 'closed' && (
                        <button onClick={() => setEventData({...eventData, status: 'closed'})} style={{ padding: "10px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                            Mark as Closed Now
                        </button>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
                    
                    <div>
                        <label style={{ fontWeight: "bold" }}>Event Name</label>
                        <input type="text" name="name" value={eventData.name} onChange={handleChange} disabled={!isDraft} style={inputStyle} />
                        {!isDraft && <small style={{ color: "gray" }}>Locked. Cannot change after publishing.</small>}
                    </div>

                    <div>
                        <label style={{ fontWeight: "bold" }}>Description</label>
                        <textarea name="description" value={eventData.description} onChange={handleChange} style={{ ...inputStyle, height: "100px" }} />
                        <small style={{ color: "green" }}>Editable in {eventData.status} status.</small>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                        <div>
                            <label style={{ fontWeight: "bold" }}>Registration Deadline</label>
                            <input type="datetime-local" name="registrationDeadline" value={eventData.registrationDeadline} onChange={handleChange} style={inputStyle} />
                            {isPublished && <small style={{ color: "orange" }}>You can only EXTEND this date.</small>}
                        </div>
                        <div>
                            <label style={{ fontWeight: "bold" }}>Max Capacity</label>
                            <input type="number" name="registrationLimit" value={eventData.registrationLimit} onChange={handleChange} style={inputStyle} />
                            {isPublished && <small style={{ color: "orange" }}>You can only INCREASE this limit.</small>}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
                        <button type="submit" style={{ flex: 1, padding: "12px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                            Save Changes
                        </button>
                        
                        {isDraft && (
                            <button type="button" onClick={handlePublish} style={{ flex: 1, padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                Publish Event
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
};

const inputStyle = { width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginTop: "5px" };

export default EditEventPage;
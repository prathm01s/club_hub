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
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}`);
                const data = await response.json();

                if (response.ok) {
                    const formatDate = (dateString) => new Date(dateString).toISOString().slice(0, 16);
                    setEventData({
                        ...data,
                        startDate: formatDate(data.startDate),
                        endDate: formatDate(data.endDate),
                        registrationDeadline: formatDate(data.registrationDeadline),
                        // Store tags as comma string for the input, convert back to array on submit
                        tags: Array.isArray(data.tags) ? data.tags.join(", ") : (data.tags || ""),
                        formFields: data.formFields || []
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

    // --- Core field handler ---
    const handleChange = (e) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    // --- Form builder handlers (draft only) ---
    const addFormField = () => {
        setEventData({
            ...eventData,
            formFields: [...eventData.formFields, { label: "", fieldType: "text", required: false, options: [] }]
        });
    };

    const updateFormField = (index, key, value) => {
        const updated = [...eventData.formFields];
        updated[index] = { ...updated[index], [key]: value };
        setEventData({ ...eventData, formFields: updated });
    };

    const removeFormField = (index) => {
        setEventData({
            ...eventData,
            formFields: eventData.formFields.filter((_, i) => i !== index)
        });
    };

    const moveFormField = (index, direction) => {
        const updated = [...eventData.formFields];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= updated.length) return;
        [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
        setEventData({ ...eventData, formFields: updated });
    };

    // --- Submit ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });

        const tagsArray = eventData.tags
            ? eventData.tags.split(",").map(t => t.trim()).filter(Boolean)
            : [];

        const payload = { ...eventData, tags: tagsArray };
        // For published/upcoming events, restrict which fields are sent.
        if (isPublished) {
            // formFields editable only when no registrations yet
            const allowedPublished = ['description', 'registrationDeadline', 'registrationLimit'];
            if (!formLocked) allowedPublished.push('formFields');
            Object.keys(payload).forEach(k => { if (!allowedPublished.includes(k)) delete payload[k]; });
        }

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify(payload)
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
        if (!window.confirm("Are you sure you want to publish this event?")) return;

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}/status`, {
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

    const handleCloseRegistrations = async () => {
        if (!window.confirm("Close registrations? The event will move to 'Ongoing' status and no new registrations will be accepted.")) return;
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ status: "ongoing" })
            });
            const data = await response.json();
            if (response.ok) {
                alert("Registrations closed. Event is now Ongoing.");
                navigate('/organizer-dashboard');
            } else {
                alert(data.msg || "Failed to close registrations.");
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    const handleCompleteEvent = async () => {
        if (!window.confirm("Are you sure you want to mark this event as completed?")) return;

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ status: "completed" })
            });
            const data = await response.json();
            if (response.ok) {
                alert("Event marked as completed.");
                navigate('/organizer-dashboard');
            } else {
                alert(data.msg || "Failed to complete event.");
            }
        } catch (err) {
            alert("Server error.");
        }
    };

    if (loading) return <div>Loading event data...</div>;
    if (!eventData) return <div style={{ color: "red", padding: "20px" }}>{msg.text}</div>;

    const isDraft     = eventData.status === "draft";
    const isPublished = eventData.status === "published" || eventData.status === "upcoming";
    const isOngoing   = eventData.status === "ongoing";
    const isCompleted = eventData.status === "completed";
    // Fields locked in published/upcoming: everything EXCEPT description, registrationDeadline, registrationLimit
    const isFullyLocked      = isOngoing || isCompleted;           // nothing editable
    const isPublishedLocked  = isPublished || isFullyLocked;       // most fields locked
    const formLocked         = (isPublished && eventData.registrationCount > 0) || isOngoing || isCompleted;
    // keep isLocked alias for form-builder section reuse
    const isLocked = isFullyLocked;

    const statusColor = {
        draft:     "#6c757d",
        upcoming:  "#6f42c1",
        published: "#007bff",
        ongoing:   "#28a745",
        completed: "#dc3545"
    }[eventData.status] || "#6c757d";

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <button onClick={() => navigate("/organizer-dashboard")} style={{ marginBottom: "16px", background: "none", border: "none", cursor: "pointer", color: "#007bff", fontSize: "0.95rem" }}>
                ← Back to Dashboard
            </button>

            <h1>Edit Event: {eventData.name}</h1>

            <div style={{ padding: "8px 14px", background: "#f8f9fa", borderRadius: "5px", marginBottom: "20px", display: "inline-block", fontWeight: "bold" }}>
                Status: <span style={{ textTransform: "uppercase", color: statusColor }}>{eventData.status}</span>
            </div>

            {msg.text && (
                <div style={{ padding: "10px", color: "white", background: msg.type === "error" ? "#dc3545" : "#28a745", marginBottom: "15px", borderRadius: "4px" }}>
                    {msg.text}
                </div>
            )}

            {isCompleted ? (
                <div style={{ background: "#f8d7da", padding: "20px", borderRadius: "8px", border: "1px solid #f5c6cb" }}>
                    <h3 style={{ color: "#721c24", marginTop: 0 }}>Event Completed</h3>
                    <p>Completed events are fully locked and cannot be edited or changed.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* Ongoing lock notice */}
                    {isOngoing && (
                        <div style={{ background: "#d4edda", padding: "14px 18px", borderRadius: "6px", border: "1px solid #c3e6cb", display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "1.2rem" }}>🔒</span>
                            <div>
                                <strong style={{ color: "#155724" }}>Event is Ongoing — form locked.</strong>
                                <span style={{ color: "#155724", marginLeft: "8px" }}>No edits allowed. You can mark it as Completed below.</span>
                            </div>
                        </div>
                    )}

                    {/* ── SECTION 1: Core Details ── */}
                    <div style={sectionStyle}>
                        <h2 style={{ margin: "0 0 16px 0" }}>1. Event Details</h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                            <div>
                                <label style={labelStyle}>Event Name</label>
                                <input type="text" name="name" value={eventData.name} onChange={handleChange}
                                    disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                            </div>

                            <div>
                                <label style={labelStyle}>Event Type</label>
                                <select name="eventType" value={eventData.eventType} onChange={handleChange}
                                    disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)}>
                                    <option value="normal">Normal Event</option>
                                    <option value="merchandise">Merchandise</option>
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Eligibility</label>
                                <select name="eligibility" value={eventData.eligibility} onChange={handleChange}
                                    disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)}>
                                    <option value="all">Open to All</option>
                                    <option value="iiit-only">IIIT Students Only</option>
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Max Capacity</label>
                                <input type="number" name="registrationLimit" value={eventData.registrationLimit}
                                    onChange={handleChange} disabled={isFullyLocked} style={fieldStyle(isFullyLocked)} />
                                {isPublished && <small style={{ color: "orange" }}>You can only INCREASE this limit.</small>}
                            </div>

                            <div>
                                <label style={labelStyle}>
                                    {eventData.eventType === "merchandise" ? "Price per Item (₹)" : "Entry Fee (₹)"}
                                </label>
                                <input type="number" name="fee" min="0" value={eventData.fee || 0}
                                    onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                            </div>

                            <div>
                                <label style={labelStyle}>Tags <span style={{ color: "gray", fontWeight: "normal" }}>(comma-separated)</span></label>
                                <input type="text" name="tags" value={eventData.tags || ""}
                                    placeholder="e.g. tech, hackathon, coding"
                                    onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                            </div>
                        </div>

                        <div style={{ marginTop: "15px" }}>
                            <label style={labelStyle}>Description</label>
                            <textarea name="description" value={eventData.description} onChange={handleChange}
                                disabled={isFullyLocked}
                                style={{ ...fieldStyle(isFullyLocked), height: "100px" }} />
                            {isPublished && <small style={{ color: "green" }}>Editable in published state.</small>}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginTop: "15px" }}>
                            <div>
                                <label style={labelStyle}>Start Date</label>
                                <input type="datetime-local" name="startDate" value={eventData.startDate}
                                    onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                            </div>
                            <div>
                                <label style={labelStyle}>End Date</label>
                                <input type="datetime-local" name="endDate" value={eventData.endDate}
                                    onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Reg. Deadline</label>
                                <input type="datetime-local" name="registrationDeadline" value={eventData.registrationDeadline}
                                    onChange={handleChange} disabled={isFullyLocked} style={fieldStyle(isFullyLocked)} />
                                {isPublished && <small style={{ color: "orange" }}>You can only EXTEND this date.</small>}
                            </div>
                        </div>

                        {eventData.eventType === "merchandise" && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "15px" }}>
                                <div>
                                    <label style={labelStyle}>Total Stock</label>
                                    <input type="number" name="stock" value={eventData.stock || ""}
                                        onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Max per User</label>
                                    <input type="number" name="maxItemsPerUser" value={eventData.maxItemsPerUser || 1}
                                        onChange={handleChange} disabled={isPublishedLocked} style={fieldStyle(isPublishedLocked)} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── SECTION 2: Form Builder ── */}
                    <div style={sectionStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <h2 style={{ margin: 0 }}>2. Registration Form Builder</h2>
                            {formLocked && (
                                <span style={{ background: "#dc3545", color: "white", padding: "5px 10px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.85rem" }}>
                                    Locked (Registrations Received)
                                </span>
                            )}
                            {!formLocked && isDraft && (
                                <span style={{ background: "#d4edda", color: "#155724", padding: "5px 10px", borderRadius: "4px", fontSize: "0.85rem" }}>
                                    Form editable until published
                                </span>
                            )}
                            {!formLocked && isPublished && (
                                <span style={{ background: "#fff3cd", color: "#856404", padding: "5px 10px", borderRadius: "4px", fontSize: "0.85rem" }}>
                                    Editable until first registration
                                </span>
                            )}
                        </div>

                        <p style={{ color: "gray", marginTop: 0 }}>Custom questions participants must answer when registering.</p>

                        {(eventData.formFields || []).map((field, index) => (
                            <div key={index} style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "10px", background: "white", opacity: (formLocked || isLocked) ? 0.6 : 1 }}>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <button type="button" disabled={index === 0 || formLocked || isLocked}
                                            onClick={() => moveFormField(index, -1)}
                                            style={{ padding: "2px 6px", cursor: "pointer" }}>↑</button>
                                        <button type="button" disabled={index === eventData.formFields.length - 1 || formLocked || isLocked}
                                            onClick={() => moveFormField(index, 1)}
                                            style={{ padding: "2px 6px", cursor: "pointer" }}>↓</button>
                                    </div>

                                    <input type="text" placeholder="Question Label"
                                        value={field.label}
                                        onChange={(e) => updateFormField(index, "label", e.target.value)}
                                        disabled={formLocked || isLocked}
                                        style={{ flex: 1, padding: "8px" }} />

                                    <select value={field.fieldType}
                                        onChange={(e) => updateFormField(index, "fieldType", e.target.value)}
                                        disabled={formLocked || isLocked}
                                        style={{ padding: "8px" }}>
                                        <option value="text">Text Input</option>
                                        <option value="number">Number Input</option>
                                        <option value="dropdown">Dropdown</option>
                                        <option value="checkbox">Multiple Choice (Checkbox)</option>
                                        <option value="file">File Upload</option>
                                    </select>

                                    <label style={{ display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}>
                                        <input type="checkbox" checked={field.required}
                                            onChange={(e) => updateFormField(index, "required", e.target.checked)}
                                            disabled={formLocked || isLocked} /> Required
                                    </label>

                                    <button type="button" onClick={() => removeFormField(index)}
                                        disabled={formLocked || isLocked}
                                        style={{ background: (formLocked || isLocked) ? "gray" : "red", color: "white", border: "none", padding: "8px 12px", cursor: "pointer" }}>
                                        X
                                    </button>
                                </div>

                                {(field.fieldType === "dropdown" || field.fieldType === "checkbox") && (
                                    <input type="text"
                                        placeholder="Options separated by commas (e.g. Veg, Non-Veg)"
                                        value={field.options ? field.options.join(",") : ""}
                                        onChange={(e) => updateFormField(index, "options", e.target.value.split(","))}
                                        disabled={formLocked || isLocked}
                                        style={{ width: "100%", padding: "8px", boxSizing: "border-box", marginTop: "8px" }} />
                                )}

                                {field.fieldType === "file" && (
                                    <small style={{ color: "blue" }}>Participants will see a file upload button for this question.</small>
                                )}
                            </div>
                        ))}

                        <button type="button" onClick={addFormField}
                            disabled={formLocked || isLocked}
                            style={{ padding: "8px 15px", background: (formLocked || isLocked) ? "#ccc" : "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: (formLocked || isLocked) ? "not-allowed" : "pointer" }}>
                            + Add Question
                        </button>
                    </div>

                    {/* ── SECTION 3: Actions ── */}
                    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                        {/* Draft: Save + Publish */}
                        {isDraft && (
                            <>
                                <button type="submit" style={{ flex: 1, minWidth: "140px", padding: "12px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    Save Draft
                                </button>
                                <button type="button" onClick={handlePublish} style={{ flex: 1, minWidth: "140px", padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    Publish Event
                                </button>
                            </>
                        )}

                        {/* Published: Save (desc/deadline/capacity) + Close Registrations */}
                        {isPublished && (
                            <>
                                <button type="submit" style={{ flex: 1, minWidth: "140px", padding: "12px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    Save Changes
                                </button>
                                <button type="button" onClick={handleCloseRegistrations} style={{ flex: 1, minWidth: "160px", padding: "12px", background: "#fd7e14", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    Close Registrations
                                </button>
                            </>
                        )}

                        {/* Ongoing: Mark Completed only */}
                        {isOngoing && (
                            <button type="button" onClick={handleCompleteEvent} style={{ flex: 1, minWidth: "160px", padding: "12px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                Mark as Completed
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
};

const sectionStyle = { background: "#f9f9f9", padding: "20px", borderRadius: "8px", border: "1px solid #eee" };
const labelStyle   = { display: "block", fontWeight: "bold", marginBottom: "4px" };
const fieldStyle   = (locked) => ({
    width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "4px",
    boxSizing: "border-box", marginTop: "2px",
    background: locked ? "#f0f0f0" : "white",
    color: locked ? "#888" : "inherit"
});

export default EditEventPage;

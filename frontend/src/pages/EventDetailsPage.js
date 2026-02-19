import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const EventDetailsPage = () => {
    const { id } = useParams();
    const { user, authTokens } = useContext(AuthContext);
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    // Registration State
    const [showForm, setShowForm] = useState(false);
    const [formResponses, setFormResponses] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [regError, setRegError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // 1. Fetch Event Details
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/events/${id}`);
                const data = await response.json();
                
                if (response.ok) {
                    setEvent(data);
                    
                    // Pre-initialize empty strings for required custom form fields
                    if (data.formFields) {
                        const initialResponses = {};
                        data.formFields.forEach(field => {
                            initialResponses[field.label] = "";
                        });
                        setFormResponses(initialResponses);
                    }
                } else {
                    setError(data.msg || "Event not found");
                }
            } catch (err) {
                setError("Server Error while fetching event");
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [id]);

    // 2. Handle Custom Form Inputs
    const handleFormChange = (label, value) => {
        setFormResponses(prev => ({ ...prev, [label]: value }));
    };

    // 3. Submit Registration
    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError("");
        setSuccessMsg("");

        try {
            const response = await fetch(`http://localhost:5000/api/registrations/${id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens?.token
                },
                body: JSON.stringify({
                    responses: formResponses,
                    quantity: Number(quantity)
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessMsg(`Registration Successful! Ticket ID: ${data.ticketId}. Confirmation email sent.`);
                setShowForm(false);
                // Optionally redirect to dashboard after 3 seconds
                setTimeout(() => navigate('/dashboard'), 3000);
            } else {
                setRegError(data.msg || "Registration failed");
            }
        } catch (err) {
            setRegError("Server error during registration");
        }
    };

    if (loading) return <div>Loading event details...</div>;
    if (error) return <div style={{ color: "red", padding: "20px" }}>{error}</div>;
    if (!event) return null;

    // 4. Validation Checks for UI Blocking (Section 9.4)
    const now = new Date();
    const deadlinePassed = new Date(event.registrationDeadline) < now;
    
    let isFull = false;
    if (event.eventType === 'merchandise') {
        isFull = event.stock <= 0;
    } else {
        isFull = event.registrationCount >= event.registrationLimit;
    }

    const isIIITOnly = event.eligibility === 'iiit-only';
    const notEligible = isIIITOnly && user && !user.isIIIT;

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <div style={{ background: "#f9f9f9", padding: "30px", borderRadius: "8px" }}>
                <h1>{event.name}</h1>
                <p style={{ color: "gray", fontSize: "1.1rem" }}>Organized by: {event.organizer?.organizerName || event.organizer?.firstName}</p>
                
                <div style={{ display: "flex", gap: "10px", margin: "15px 0" }}>
                    <span style={badgeStyle}>{event.eventType.toUpperCase()}</span>
                    <span style={badgeStyle}>{event.eligibility.toUpperCase()}</span>
                    <span style={badgeStyle}>₹{event.fee || 0}</span>
                </div>

                <p style={{ fontSize: "1.1rem", lineHeight: "1.6" }}>{event.description}</p>

                <div style={{ background: "white", padding: "20px", borderRadius: "8px", marginTop: "20px", border: "1px solid #ddd" }}>
                    <h3>Event Schedule</h3>
                    <p><strong>Starts:</strong> {new Date(event.startDate).toLocaleString()}</p>
                    <p><strong>Ends:</strong> {new Date(event.endDate).toLocaleString()}</p>
                    <p style={{ color: deadlinePassed ? "red" : "black" }}>
                        <strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}
                    </p>
                </div>

                {/* --- REGISTRATION SECTION --- */}
                <div style={{ marginTop: "30px", padding: "20px", background: "#e9ecef", borderRadius: "8px" }}>
                    {successMsg ? (
                        <div style={{ color: "green", fontSize: "1.2rem", fontWeight: "bold" }}>{successMsg}</div>
                    ) : !user ? (
                        <p>Please <a href="/login">login</a> to register for this event.</p>
                    ) : user.role !== 'participant' ? (
                        <p>Only participants can register for events.</p>
                    ) : deadlinePassed ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>Registrations are closed (Deadline passed).</p>
                    ) : isFull ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>{event.eventType === 'merchandise' ? "Out of Stock" : "Event is fully booked."}</p>
                    ) : notEligible ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>This event is restricted to IIIT students only.</p>
                    ) : (
                        <>
                            {!showForm ? (
                                <button 
                                    onClick={() => setShowForm(true)}
                                    style={{ padding: "15px 30px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", fontSize: "1.2rem", cursor: "pointer" }}
                                >
                                    {event.eventType === 'merchandise' ? 'Buy Now' : 'Register Now'}
                                </button>
                            ) : (
                                <form onSubmit={handleRegister} style={{ background: "white", padding: "20px", borderRadius: "8px" }}>
                                    <h3>Complete Registration</h3>
                                    {regError && <p style={{ color: "red" }}>{regError}</p>}

                                    {/* Merchandise Quantity Selector */}
                                    {event.eventType === 'merchandise' && (
                                        <div style={{ marginBottom: "15px" }}>
                                            <label>Quantity (Max {event.maxItemsPerUser}): </label>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max={event.maxItemsPerUser} 
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    {/* Dynamic Form Builder Renderer */}
                                    {event.formFields && event.formFields.map((field, index) => (
                                        <div key={index} style={{ marginBottom: "15px" }}>
                                            <label style={{ display: "block", marginBottom: "5px" }}>
                                                {field.label} {field.required && <span style={{color:"red"}}>*</span>}
                                            </label>
                                            
                                            {field.fieldType === 'text' && (
                                                <input 
                                                    type="text" 
                                                    value={formResponses[field.label] || ""}
                                                    onChange={(e) => handleFormChange(field.label, e.target.value)}
                                                    required={field.required}
                                                    style={{ width: "100%", padding: "8px" }}
                                                />
                                            )}
                                            
                                            {field.fieldType === 'dropdown' && (
                                                <select 
                                                    value={formResponses[field.label] || ""}
                                                    onChange={(e) => handleFormChange(field.label, e.target.value)}
                                                    required={field.required}
                                                    style={{ width: "100%", padding: "8px" }}
                                                >
                                                    <option value="">Select an option...</option>
                                                    {field.options && field.options.map((opt, i) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {field.fieldType === 'number' && (
                                                <input
                                                    type="number"
                                                    value={formResponses[field.label] || ""}
                                                    onChange={(e) => handleFormChange(field.label, e.target.value)}
                                                    required={field.required}
                                                    style={{ width: "100%", padding: "8px" }}
                                                />
                                            )}

                                            {field.fieldType === 'checkbox' && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                                                    {field.options && field.options.map((opt, i) => {
                                                        const selected = (formResponses[field.label] || "").split(",").map(s => s.trim()).filter(Boolean);
                                                        const isChecked = selected.includes(opt);
                                                        return (
                                                            <label key={i} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        const updated = isChecked
                                                                            ? selected.filter(s => s !== opt)
                                                                            : [...selected, opt];
                                                                        handleFormChange(field.label, updated.join(", "));
                                                                    }}
                                                                />
                                                                {opt}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {field.fieldType === 'file' && (
                                                <input
                                                    type="file"
                                                    required={field.required}
                                                    onChange={(e) => handleFormChange(field.label, e.target.files[0]?.name || "")}
                                                    style={{ width: "100%", padding: "4px" }}
                                                />
                                            )}
                                        </div>
                                    ))}

                                    <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                                        <button type="submit" style={{ padding: "10px 20px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}>Confirm</button>
                                        <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 20px", background: "#6c757d", color: "white", border: "none", cursor: "pointer" }}>Cancel</button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const badgeStyle = { background: "#e9ecef", padding: "5px 10px", borderRadius: "15px", fontSize: "0.9rem", fontWeight: "bold" };

export default EventDetailsPage;
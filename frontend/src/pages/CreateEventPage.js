import { useState, useContext } from "react";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const CreateEventPage = () => {
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState("");

    // 1. Core Event Details State
    const [eventDetails, setEventDetails] = useState({
        name: "", description: "", eventType: "normal", eligibility: "all",
        startDate: "", endDate: "", registrationDeadline: "",
        registrationLimit: "", fee: 0, tags: "", stock: "", maxItemsPerUser: 1,
        isTeamEvent: false, minTeamSize: 1, maxTeamSize: 4
    });

    // 2. Dynamic Form Builder State (Array of question objects)
    const [formFields, setFormFields] = useState([]);

    // --- Core Details Handlers ---
    const handleDetailChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setEventDetails({ ...eventDetails, [e.target.name]: value });
    };

    // --- Dynamic Form Builder Handlers ---
    const addFormField = () => {
        setFormFields([...formFields, { label: "", fieldType: "text", required: false, options: [] }]);
    };

    const updateFormField = (index, key, value) => {
        const updatedFields = [...formFields];
        updatedFields[index][key] = value;
        setFormFields(updatedFields);
    };

    const removeFormField = (index) => {
        setFormFields(formFields.filter((_, i) => i !== index));
    };

    // --- Submission Logic ---
    const submitEvent = async (status) => {
        setError("");

        // Frontend validation
        if (!eventDetails.name.trim()) return setError("Event name is required.");
        if (!eventDetails.description.trim()) return setError("Description is required.");
        if (!eventDetails.startDate) return setError("Start date is required.");
        if (!eventDetails.endDate) return setError("End date is required.");
        if (!eventDetails.registrationDeadline) return setError("Registration deadline is required.");
        if (!eventDetails.registrationLimit || eventDetails.registrationLimit <= 0) return setError("Registration limit must be greater than 0.");
        if (new Date(eventDetails.endDate) <= new Date(eventDetails.startDate)) {
            return setError("End date must be after start date.");
        }
        if (new Date(eventDetails.registrationDeadline) > new Date(eventDetails.startDate)) {
            return setError("Registration deadline must be before or equal to the start date.");
        }

        const tagsArray = eventDetails.tags
            ? eventDetails.tags.split(",").map(t => t.trim()).filter(Boolean)
            : [];
        const payload = { ...eventDetails, tags: tagsArray, formFields, status };

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                alert(`Event successfully saved as ${status}!`);
                navigate('/organizer-dashboard');
            } else {
                setError(data.msg || "An error occurred while saving the event.");
            }
        } catch (err) {
            setError("Network error: could not reach the server.");
        }
    };

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <h1>Create New Event</h1>
            {error && <div style={{ color: "red", padding: "10px", border: "1px solid red", marginBottom: "15px" }}>{error}</div>}

            {/* SECTION 1: Core Details */}
            <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
                <h2>1. Event Details</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <input type="text" name="name" placeholder="Event Name" onChange={handleDetailChange} required />
                    <select name="eventType" onChange={handleDetailChange}>
                        <option value="normal">Normal Event</option>
                        <option value="merchandise">Merchandise</option>
                    </select>
                    <select name="eligibility" onChange={handleDetailChange}>
                        <option value="all">Open to All</option>
                        <option value="iiit-only">IIIT Students Only</option>
                    </select>
                    <input type="number" name="registrationLimit" placeholder="Max Capacity" onChange={handleDetailChange} required />
                </div>

                <div style={{ display: "flex", gap: "15px", marginTop: "15px", alignItems: "center" }}>
                    <label style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px" }}>
                        <input 
                            type="checkbox" 
                            name="isTeamEvent" 
                            checked={eventDetails.isTeamEvent} 
                            onChange={handleDetailChange} 
                        />
                        Is this a Team Event / Hackathon?
                    </label>

                    {eventDetails.isTeamEvent && (
                        <>
                            <input type="number" name="minTeamSize" placeholder="Min Team Size" value={eventDetails.minTeamSize} onChange={handleDetailChange} required style={{ width: "120px" }} />
                            <input type="number" name="maxTeamSize" placeholder="Max Team Size" value={eventDetails.maxTeamSize} onChange={handleDetailChange} required style={{ width: "120px" }} />
                        </>
                    )}
                </div>
                
                <textarea name="description" placeholder="Event Description..." onChange={handleDetailChange} style={{ width: "100%", marginTop: "15px", height: "80px", padding: "8px", boxSizing: "border-box" }} required />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "15px" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                            {eventDetails.eventType === "merchandise" ? "Price per Item (₹)" : "Entry Fee (₹)"}
                        </label>
                        <input
                            type="number" name="fee" min="0"
                            placeholder="0 for free"
                            value={eventDetails.fee}
                            onChange={handleDetailChange}
                            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Tags <span style={{ color: "gray", fontWeight: "normal" }}>(comma-separated)</span></label>
                        <input
                            type="text" name="tags"
                            placeholder="e.g. tech, hackathon, coding"
                            value={eventDetails.tags}
                            onChange={handleDetailChange}
                            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                        />
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginTop: "15px" }}>
                    <div>
                        <label>Start Date</label>
                        <input type="datetime-local" name="startDate" onChange={handleDetailChange} required style={{width: "100%"}}/>
                    </div>
                    <div>
                        <label>End Date</label>
                        <input type="datetime-local" name="endDate" onChange={handleDetailChange} required style={{width: "100%"}}/>
                    </div>
                    <div>
                        <label>Reg. Deadline</label>
                        <input type="datetime-local" name="registrationDeadline" onChange={handleDetailChange} required style={{width: "100%"}}/>
                    </div>
                </div>

                {eventDetails.eventType === 'merchandise' && (
                    <div style={{ display: "flex", gap: "15px", marginTop: "15px" }}>
                        <input type="number" name="stock" placeholder="Total Stock" onChange={handleDetailChange} />
                        <input type="number" name="maxItemsPerUser" placeholder="Max per User" onChange={handleDetailChange} />
                    </div>
                )}
            </div>

            {/* SECTION 2: Dynamic Form Builder */}
            <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2>2. Registration Form Builder</h2>
                    
                    {/* Visual Lock Indicator */}
                    {eventDetails?.registrationCount > 0 && (
                        <span style={{ background: "#dc3545", color: "white", padding: "5px 10px", borderRadius: "4px", fontWeight: "bold" }}>
                            🔒 Form Locked (Registrations Received)
                        </span>
                    )}
                </div>
                
                <p style={{ color: "gray" }}>Add custom questions you want participants to answer.</p>
                
                {formFields.map((field, index) => (
                    <div key={index} style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "10px", background: "white", opacity: eventDetails?.registrationCount > 0 ? 0.6 : 1 }}>
                        <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
                            
                            {/* REORDERING BUTTONS */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <button 
                                    type="button" 
                                    disabled={index === 0 || eventDetails?.registrationCount > 0} 
                                    onClick={() => {
                                        const newFields = [...formFields];
                                        [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
                                        setFormFields(newFields);
                                    }}
                                    style={{ cursor: index === 0 ? "not-allowed" : "pointer", padding: "2px 5px" }}
                                >↑</button>
                                <button 
                                    type="button" 
                                    disabled={index === formFields.length - 1 || eventDetails?.registrationCount > 0} 
                                    onClick={() => {
                                        const newFields = [...formFields];
                                        [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
                                        setFormFields(newFields);
                                    }}
                                    style={{ cursor: index === formFields.length - 1 ? "not-allowed" : "pointer", padding: "2px 5px" }}
                                >↓</button>
                            </div>

                            <input 
                                type="text" 
                                placeholder="Question Label (e.g. Diet Preference)" 
                                value={field.label}
                                onChange={(e) => updateFormField(index, 'label', e.target.value)}
                                disabled={eventDetails?.registrationCount > 0}
                                style={{ flex: 1, padding: "8px" }}
                            />
                            
                            {/* FIELD TYPES ENHANCED */}
                            <select 
                                value={field.fieldType} 
                                onChange={(e) => updateFormField(index, 'fieldType', e.target.value)}
                                disabled={eventDetails?.registrationCount > 0}
                                style={{ padding: "8px" }}
                            >
                                <option value="text">Text Input</option>
                                <option value="number">Number Input</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="checkbox">Multiple Choice (Checkbox)</option>
                                <option value="file">File Upload</option>
                            </select>

                            <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <input 
                                    type="checkbox" 
                                    checked={field.required}
                                    onChange={(e) => updateFormField(index, 'required', e.target.checked)}
                                    disabled={eventDetails?.registrationCount > 0}
                                /> Required
                            </label>
                            
                            <button 
                                type="button" 
                                onClick={() => removeFormField(index)} 
                                disabled={eventDetails?.registrationCount > 0}
                                style={{ background: eventDetails?.registrationCount > 0 ? "gray" : "red", color: "white", border: "none", padding: "8px 12px", cursor: "pointer" }}
                            >X</button>
                        </div>
                        
                        {/* OPTIONS FOR DROPDOWN OR CHECKBOX */}
                        {(field.fieldType === 'dropdown' || field.fieldType === 'checkbox') && (
                            <input 
                                type="text" 
                                placeholder="Enter options separated by commas (e.g. Veg, Non-Veg, Vegan)" 
                                value={field.options ? field.options.join(',') : ""}
                                onChange={(e) => updateFormField(index, 'options', e.target.value.split(','))}
                                disabled={eventDetails?.registrationCount > 0}
                                style={{ width: "100%", padding: "8px", boxSizing: "border-box", marginTop: "5px" }}
                            />
                        )}
                        
                        {/* INFO FOR FILE UPLOAD */}
                        {field.fieldType === 'file' && (
                            <small style={{ color: "blue" }}>Participants will see a file upload button for this question.</small>
                        )}
                    </div>
                ))}

                <button 
                    type="button" 
                    onClick={addFormField} 
                    disabled={eventDetails?.registrationCount > 0}
                    style={{ padding: "8px 15px", cursor: eventDetails?.registrationCount > 0 ? "not-allowed" : "pointer", background: "#28a745", color: "white", border: "none", borderRadius: "4px" }}>
                    + Add Question
                </button>
            </div>

            {/* SECTION 3: Submit Actions */}
            <div style={{ display: "flex", gap: "15px", justifyContent: "flex-end" }}>
                <button
                    type="button"
                    onClick={() => submitEvent("draft")}
                    style={{ padding: "12px 25px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" }}
                >
                    Save as Draft
                </button>
                <button
                    type="button"
                    onClick={() => submitEvent("published")}
                    style={{ padding: "12px 25px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "1rem", fontWeight: "bold" }}
                >
                    Publish Event
                </button>
            </div>
        </div>
    );
};

export default CreateEventPage;
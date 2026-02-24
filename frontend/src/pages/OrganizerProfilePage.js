import { useState, useEffect, useContext } from "react";
import AuthContext from "../context/AuthContext";

const OrganizerProfilePage = () => {
    const { authTokens } = useContext(AuthContext);
    const [profileData, setProfileData] = useState({
        organizerName: "", organizerCategory: "", description: "",
        contactEmail: "", contactNumber: "", discordWebhook: "", email: ""
    });
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [loading, setLoading] = useState(true);
    const [resetMsg, setResetMsg] = useState({ type: "", text: "" });
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/users/profile", {
                    headers: { "x-auth-token": authTokens.token }
                });
                const data = await response.json();
                if (response.ok) {
                    setProfileData({
                        organizerName: data.organizerName || "",
                        organizerCategory: data.organizerCategory || "",
                        description: data.description || "",
                        contactEmail: data.contactEmail || "",
                        contactNumber: data.contactNumber || "",
                        discordWebhook: data.discordWebhook || "",
                        email: data.email // Locked login email
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [authTokens]);

    const handleChange = (e) => setProfileData({ ...profileData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });

        try {
            const response = await fetch("http://localhost:5000/api/users/organizer-profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();
            if (response.ok) {
                setMsg({ type: "success", text: "Profile updated successfully!" });
                setTimeout(() => setMsg({ type: "", text: "" }), 3000);
            } else {
                setMsg({ type: "error", text: data.msg || "Update failed." });
            }
        } catch (err) {
            setMsg({ type: "error", text: "Server error." });
        }
    };

    const handleRequestPasswordReset = async () => {
        if (!window.confirm("Request a password reset? The admin will review your request and generate a new password for you.")) return;
        setResetLoading(true);
        setResetMsg({ type: "", text: "" });
        try {
            const res = await fetch("http://localhost:5000/api/users/request-password-reset", {
                method: "POST",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();
            if (res.ok) {
                setResetMsg({ type: "success", text: data.msg || "Request submitted successfully. The admin will process it shortly." });
            } else {
                setResetMsg({ type: "error", text: data.msg || "Failed to submit request." });
            }
        } catch (err) {
            setResetMsg({ type: "error", text: "Server error." });
        } finally {
            setResetLoading(false);
        }
    };

    if (loading) return <div>Loading Profile...</div>;

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <h1>Organizer Profile</h1>

            {/* Locked Identity */}
            <div style={{ background: "#e9ecef", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
                <p style={{ margin: 0 }}><strong>Login Email:</strong> {profileData.email} (Cannot be changed)</p>
            </div>

            {msg.text && (
                <div style={{ padding: "10px", color: "white", background: msg.type === "error" ? "#dc3545" : "#28a745", marginBottom: "15px", borderRadius: "4px" }}>
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
                <div>
                    <label style={{ fontWeight: "bold" }}>Organizer / Club Name</label>
                    <input type="text" name="organizerName" value={profileData.organizerName} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                    <label style={{ fontWeight: "bold" }}>Category</label>
                    <input type="text" name="organizerCategory" value={profileData.organizerCategory} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                    <label style={{ fontWeight: "bold" }}>Public Contact Email</label>
                    <input type="email" name="contactEmail" value={profileData.contactEmail} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                    <label style={{ fontWeight: "bold" }}>Contact Number</label>
                    <input type="number" name="contactNumber" value={profileData.contactNumber} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                    <label style={{ fontWeight: "bold" }}>Description</label>
                    <textarea name="description" value={profileData.description} onChange={handleChange} required style={{ ...inputStyle, height: "80px" }} />
                </div>

                <hr style={{ margin: "20px 0", border: "1px solid #ddd" }} />

                <div>
                    <label style={{ fontWeight: "bold", color: "#5865F2" }}>Discord Webhook URL</label>
                    <input type="url" name="discordWebhook" value={profileData.discordWebhook} onChange={handleChange} placeholder="https://discord.com/api/webhooks/..." style={inputStyle} />
                    <small style={{ color: "gray" }}>If provided, new events will be automatically posted to your Discord server when published!</small>
                </div>

                <button type="submit" style={{ padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }}>
                    Save Profile Changes
                </button>
            </form>

            {/* Security Settings */}
            <div style={{ background: "#fff3cd", padding: "20px", borderRadius: "8px", border: "1px solid #ffeeba", marginTop: "20px" }}>
                <h2 style={{ marginTop: 0 }}>Security Settings</h2>
                <p style={{ color: "#856404", marginBottom: "15px" }}>
                    As an organizer, password resets are handled by the admin. Click below to submit a request.
                    The admin will review it and provide you with a new password.
                </p>
                {resetMsg.text && (
                    <div style={{ padding: "10px", color: "white", background: resetMsg.type === "error" ? "#dc3545" : "#28a745", marginBottom: "15px", borderRadius: "4px" }}>
                        {resetMsg.text}
                    </div>
                )}
                <button
                    onClick={handleRequestPasswordReset}
                    disabled={resetLoading}
                    style={{ padding: "10px 20px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: resetLoading ? "not-allowed" : "pointer", fontWeight: "bold", opacity: resetLoading ? 0.7 : 1 }}
                >
                    {resetLoading ? "Submitting..." : "Request Password Reset from Admin"}
                </button>
            </div>
        </div>
    );
};

const inputStyle = { width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginTop: "5px" };

export default OrganizerProfilePage;
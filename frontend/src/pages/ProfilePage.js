import { useState, useEffect, useContext, useCallback } from "react";
import AuthContext from "../context/AuthContext";

const ProfilePage = () => {
    const { authTokens } = useContext(AuthContext);

    // Profile State
    const [profileData, setProfileData] = useState({
        firstName: "",
        lastName: "",
        contactNumber: "",
        collegeName: "",
        interests: "", // We will handle this as a comma-separated string for easy editing
        email: "",     // Non-editable
        isIIIT: false  // Non-editable
    });

    // Followed Clubs State
    const [allOrganizers, setAllOrganizers] = useState([]);
    const [followingIds, setFollowingIds] = useState([]); // array of organizer _id strings
    const [followMsg, setFollowMsg] = useState({ type: "", text: "" });

    // Password State
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    // Feedback States
    const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
    const [pwdMsg, setPwdMsg] = useState({ type: "", text: "" });

    // 1. Fetch current profile data and organizers list on load
    const fetchProfile = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile", {
                method: "GET",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await response.json();
            if (response.ok) {
                setProfileData({
                    firstName: data.firstName || "",
                    lastName: data.lastName || "",
                    contactNumber: data.contactNumber || "",
                    collegeName: data.collegeName || "",
                    interests: data.interests ? data.interests.join(", ") : "",
                    email: data.email,
                    isIIIT: data.isIIIT
                });
                // Populate currently followed organizer IDs
                setFollowingIds((data.following || []).map(id => id.toString()));
            }
        } catch (err) {
            console.error("Failed to fetch profile");
        }
    }, [authTokens]);

    const fetchOrganizers = useCallback(async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/organizers");
            const data = await response.json();
            if (response.ok) setAllOrganizers(data);
        } catch (err) {
            console.error("Failed to fetch organizers");
        }
    }, []);

    useEffect(() => {
        fetchProfile();
        fetchOrganizers();
    }, [fetchProfile, fetchOrganizers]);

    // 2. Handle Followed Clubs Toggle
    const toggleFollow = (organizerId) => {
        setFollowingIds(prev =>
            prev.includes(organizerId)
                ? prev.filter(id => id !== organizerId)
                : [...prev, organizerId]
        );
    };

    const saveFollowedClubs = async () => {
        setFollowMsg({ type: "", text: "" });
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({ following: followingIds })
            });
            const data = await response.json();
            if (response.ok) {
                setFollowMsg({ type: "success", text: "Followed clubs updated!" });
            } else {
                setFollowMsg({ type: "error", text: data.msg || "Update failed." });
            }
        } catch (err) {
            setFollowMsg({ type: "error", text: "Server error." });
        }
    };

    // 3. Handle Profile Update
    const handleProfileChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const submitProfileUpdate = async (e) => {
        e.preventDefault();
        setProfileMsg({ type: "", text: "" });

        // Convert comma-separated interests back to an array
        const interestsArray = profileData.interests
            .split(",")
            .map(item => item.trim())
            .filter(item => item !== "");

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({
                    firstName: profileData.firstName,
                    lastName: profileData.lastName,
                    contactNumber: profileData.contactNumber,
                    collegeName: profileData.collegeName,
                    interests: interestsArray
                })
            });

            const data = await response.json();
            if (response.ok) {
                setProfileMsg({ type: "success", text: "Profile updated successfully!" });
            } else {
                setProfileMsg({ type: "error", text: data.msg || "Update failed." });
            }
        } catch (err) {
            setProfileMsg({ type: "error", text: "Server error." });
        }
    };

    // 4. Handle Password Change
    const handlePwdChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const submitPasswordUpdate = async (e) => {
        e.preventDefault();
        setPwdMsg({ type: "", text: "" });

        if (passwordData.newPassword.length < 6) {
            return setPwdMsg({ type: "error", text: "New password must be at least 6 characters." });
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return setPwdMsg({ type: "error", text: "New passwords do not match!" });
        }

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/change-password", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            const data = await response.json();
            if (response.ok) {
                setPwdMsg({ type: "success", text: "Password changed successfully!" });
                setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); // Clear form
            } else {
                setPwdMsg({ type: "error", text: data.msg || "Password update failed." });
            }
        } catch (err) {
            setPwdMsg({ type: "error", text: "Server error." });
        }
    };

    return (
        <div style={{ maxWidth: "800px", margin: "auto", padding: "20px" }}>
            <h1>My Profile</h1>

            {/* SECTION 1: Non-Editable Identity (Section 9.6) */}
            <div style={{ background: "#e9ecef", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
                <h3 style={{ marginTop: 0 }}>Account Identity</h3>
                <p><strong>Email Address:</strong> {profileData.email} 🔒</p>
                <p><strong>Account Type:</strong> {profileData.isIIIT ? "IIIT Student" : "External Participant"} 🔒</p>
                <small style={{ color: "gray" }}>These fields are permanently tied to your account and cannot be changed.</small>
            </div>

            {/* SECTION 2: Editable Profile Details */}
            <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
                <h2>Personal Details & Preferences</h2>
                {profileMsg.text && (
                    <div style={{ color: profileMsg.type === 'error' ? 'red' : 'green', marginBottom: "10px", fontWeight: "bold" }}>
                        {profileMsg.text}
                    </div>
                )}

                <form onSubmit={submitProfileUpdate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div>
                        <label>First Name</label>
                        <input type="text" name="firstName" value={profileData.firstName} onChange={handleProfileChange} style={inputStyle} required />
                    </div>
                    <div>
                        <label>Last Name</label>
                        <input type="text" name="lastName" value={profileData.lastName} onChange={handleProfileChange} style={inputStyle} required />
                    </div>
                    <div>
                        <label>Contact Number</label>
                        <input type="number" name="contactNumber" value={profileData.contactNumber} onChange={handleProfileChange} style={inputStyle} />
                    </div>
                    <div>
                        <label>College / Organization Name</label>
                        {/* If they are IIIT, keep it disabled since it's inferred. If not, let them edit it. */}
                        <input
                            type="text"
                            name="collegeName"
                            value={profileData.collegeName}
                            onChange={handleProfileChange}
                            style={profileData.isIIIT ? { ...inputStyle, background: "#e9ecef" } : inputStyle}
                            readOnly={profileData.isIIIT}
                        />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                        <label>Areas of Interest (Comma separated, e.g., Coding, Music, Art)</label>
                        <input type="text" name="interests" value={profileData.interests} onChange={handleProfileChange} style={inputStyle} placeholder="Robotics, Web Dev, Finance..." />
                    </div>

                    <button type="submit" style={{ gridColumn: "span 2", padding: "10px", background: "#007bff", color: "white", border: "none", cursor: "pointer", borderRadius: "4px" }}>
                        Save Profile Changes
                    </button>
                </form>
            </div>

            {/* SECTION 3: Followed Clubs */}
            <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #ddd" }}>
                <h2>Followed Clubs</h2>
                <p style={{ color: "gray", marginTop: 0 }}>Follow organizers to get personalized event recommendations and easier filtering.</p>
                {followMsg.text && (
                    <div style={{ color: followMsg.type === "error" ? "red" : "green", marginBottom: "10px", fontWeight: "bold" }}>
                        {followMsg.text}
                    </div>
                )}
                {allOrganizers.length === 0 ? (
                    <p style={{ color: "gray" }}>No organizers available to follow.</p>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", marginBottom: "15px" }}>
                        {allOrganizers.map(org => {
                            const isFollowing = followingIds.includes(org._id.toString());
                            return (
                                <div key={org._id} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 14px", borderRadius: "6px", border: "1px solid #ccc",
                                    background: isFollowing ? "#d4edda" : "white"
                                }}>
                                    <span style={{ fontWeight: isFollowing ? "bold" : "normal" }}>
                                        {org.organizerName || `${org.firstName} ${org.lastName}`}
                                        {org.organizerCategory && <span style={{ display: "block", fontSize: "0.75rem", color: "gray" }}>{org.organizerCategory}</span>}
                                    </span>
                                    <button
                                        onClick={() => toggleFollow(org._id.toString())}
                                        style={{
                                            padding: "4px 10px", border: "none", borderRadius: "4px", cursor: "pointer",
                                            background: isFollowing ? "#dc3545" : "#28a745",
                                            color: "white", fontSize: "0.8rem", marginLeft: "10px", flexShrink: 0
                                        }}
                                    >
                                        {isFollowing ? "Unfollow" : "Follow"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <button
                    onClick={saveFollowedClubs}
                    style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                    Save Followed Clubs
                </button>
            </div>

            {/* SECTION 4: Security / Password Change */}
            <div style={{ background: "#fff3cd", padding: "20px", borderRadius: "8px", border: "1px solid #ffeeba" }}>
                <h2>Security Settings</h2>
                {pwdMsg.text && (
                    <div style={{ color: pwdMsg.type === 'error' ? 'red' : 'green', marginBottom: "10px", fontWeight: "bold" }}>
                        {pwdMsg.text}
                    </div>
                )}

                <form onSubmit={submitPasswordUpdate} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                    <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePwdChange} placeholder="Current Password" required style={inputStyle} />
                    <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePwdChange} placeholder="New Password" required style={inputStyle} />
                    <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePwdChange} placeholder="Confirm New Password" required style={inputStyle} />

                    <button type="submit" style={{ padding: "10px", background: "#dc3545", color: "white", border: "none", cursor: "pointer", borderRadius: "4px", marginTop: "10px" }}>
                        Update Password
                    </button>
                </form>
            </div>

        </div>
    );
};

const inputStyle = { width: "100%", padding: "8px", boxSizing: "border-box", marginTop: "5px", borderRadius: "4px", border: "1px solid #ccc" };

export default ProfilePage;
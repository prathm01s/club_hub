import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const INTEREST_OPTIONS = [
    "Coding", "Hackathons", "AI/ML", "Web Development", "Mobile Development",
    "Cybersecurity", "Data Science", "Robotics", "IoT", "Cloud Computing",
    "Blockchain", "Gaming", "Esports", "Music", "Dance", "Drama",
    "Art", "Photography", "Literature", "Debating", "Quiz",
    "Finance", "Entrepreneurship", "Marketing", "Design",
    "Sports", "Fitness", "Volunteering", "Social Impact"
];

const OnboardingPage = () => {
    const { authTokens } = useContext(AuthContext);
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1 = interests, 2 = clubs
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [organizers, setOrganizers] = useState([]);
    const [followedIds, setFollowedIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Fetch organizers for step 2
    useEffect(() => {
        const fetchOrganizers = async () => {
            try {
                const res = await fetch("http://localhost:5000/api/users/organizers", {
                    headers: { "x-auth-token": authTokens.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    setOrganizers(data);
                }
            } catch (err) {
                console.error("Failed to load organizers");
            }
        };
        fetchOrganizers();
    }, [authTokens]);

    const toggleInterest = (interest) => {
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const toggleFollow = (orgId) => {
        setFollowedIds(prev =>
            prev.includes(orgId)
                ? prev.filter(id => id !== orgId)
                : [...prev, orgId]
        );
    };

    const handleFinish = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch("http://localhost:5000/api/users/preferences", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({
                    interests: selectedInterests,
                    following: followedIds,
                    onboardingComplete: true
                })
            });
            if (res.ok) {
                navigate("/dashboard");
            } else {
                const data = await res.json();
                setError(data.msg || "Failed to save preferences. Please try again.");
            }
        } catch (err) {
            setError("Server error. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch("http://localhost:5000/api/users/preferences", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({ onboardingComplete: true })
            });
            if (res.ok) {
                navigate("/dashboard");
            } else {
                setError("Failed to skip onboarding. Please try again.");
            }
        } catch (err) {
            setError("Server error. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ maxWidth: "700px", margin: "40px auto", padding: "30px", fontFamily: "Arial, sans-serif" }}>
            {/* Progress bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "30px" }}>
                <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "#4f46e5" }} />
                <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: step >= 2 ? "#4f46e5" : "#e5e7eb" }} />
            </div>

            {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#dc2626", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem", border: "1px solid #fecaca" }}>
                    {error}
                </div>
            )}

            {step === 1 && (
                <div>
                    <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>Welcome! What are you interested in?</h1>
                    <p style={{ color: "#666", marginBottom: "24px" }}>
                        Select your interests so we can recommend the most relevant events for you.
                        You can always change these later in your Profile.
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "30px" }}>
                        {INTEREST_OPTIONS.map(interest => {
                            const isSelected = selectedInterests.includes(interest);
                            return (
                                <button
                                    key={interest}
                                    onClick={() => toggleInterest(interest)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "20px",
                                        border: isSelected ? "2px solid #4f46e5" : "1px solid #d1d5db",
                                        background: isSelected ? "#eef2ff" : "#fff",
                                        color: isSelected ? "#4f46e5" : "#374151",
                                        cursor: "pointer",
                                        fontWeight: isSelected ? "bold" : "normal",
                                        fontSize: "0.9rem",
                                        transition: "all 0.15s"
                                    }}
                                >
                                    {isSelected ? "✓ " : ""}{interest}
                                </button>
                            );
                        })}
                    </div>

                    {selectedInterests.length > 0 && (
                        <p style={{ fontSize: "0.85rem", color: "#4f46e5", marginBottom: "20px" }}>
                            {selectedInterests.length} selected
                        </p>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <button onClick={() => setStep(2)} style={skipBtnStyle}>
                            Skip for now &rarr;
                        </button>
                        <button onClick={() => setStep(2)} style={primaryBtnStyle}>
                            Next &rarr;
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div>
                    <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>Follow Clubs & Organizers</h1>
                    <p style={{ color: "#666", marginBottom: "24px" }}>
                        Follow organizers to get their events highlighted in your feed.
                        You can update this anytime from your Profile.
                    </p>

                    {organizers.length === 0 ? (
                        <p style={{ color: "#888" }}>No organizers available yet.</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "30px" }}>
                            {organizers.map(org => {
                                const isFollowing = followedIds.includes(org._id);
                                return (
                                    <div
                                        key={org._id}
                                        onClick={() => toggleFollow(org._id)}
                                        style={{
                                            padding: "14px",
                                            borderRadius: "8px",
                                            border: isFollowing ? "2px solid #4f46e5" : "1px solid #d1d5db",
                                            background: isFollowing ? "#eef2ff" : "#fff",
                                            cursor: "pointer",
                                            transition: "all 0.15s"
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: isFollowing ? "#4f46e5" : "#111" }}>
                                            {isFollowing ? "✓ " : ""}{org.organizerName || `${org.firstName} ${org.lastName}`}
                                        </div>
                                        {org.organizerCategory && (
                                            <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "4px" }}>
                                                {org.organizerCategory}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {followedIds.length > 0 && (
                        <p style={{ fontSize: "0.85rem", color: "#4f46e5", marginBottom: "20px" }}>
                            Following {followedIds.length} organizer{followedIds.length > 1 ? "s" : ""}
                        </p>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <button onClick={() => setStep(1)} style={skipBtnStyle}>
                            &larr; Back
                        </button>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button onClick={handleSkip} disabled={saving} style={skipBtnStyle}>
                                Skip All
                            </button>
                            <button onClick={handleFinish} disabled={saving} style={primaryBtnStyle}>
                                {saving ? "Saving..." : "Get Started!"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const primaryBtnStyle = {
    padding: "10px 24px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.95rem"
};

const skipBtnStyle = {
    padding: "10px 20px",
    background: "none",
    color: "#666",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.9rem"
};

export default OnboardingPage;

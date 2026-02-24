import React, { useState, useEffect, useContext } from "react";
import AuthContext from "../context/AuthContext";

/**
 * Participant Feedback Form — shown on EventDetailsPage for events the user attended.
 * Props: eventId (string)
 */
const FeedbackForm = ({ eventId }) => {
    const { authTokens } = useContext(AuthContext);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [loading, setLoading] = useState(true);
    const [existing, setExisting] = useState(false);

    // Load existing feedback
    useEffect(() => {
        const fetchMyFeedback = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/feedback/${eventId}/my-feedback`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        setRating(data.rating);
                        setComment(data.comment || "");
                        setExisting(true);
                    }
                }
            } catch (err) {
                console.error("Failed to load feedback");
            } finally {
                setLoading(false);
            }
        };
        fetchMyFeedback();
    }, [eventId, authTokens]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            setMsg({ type: "error", text: "Please select a star rating." });
            return;
        }
        setMsg({ type: "", text: "" });
        try {
            const res = await fetch(`http://localhost:5000/api/feedback/${eventId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({ rating, comment })
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: "success", text: data.msg });
                setExisting(true);
            } else {
                setMsg({ type: "error", text: data.msg || "Failed to submit feedback." });
            }
        } catch {
            setMsg({ type: "error", text: "Server error." });
        }
    };

    if (loading) return null;

    return (
        <div style={{ background: "#f0f4ff", padding: "20px", borderRadius: "8px", border: "1px solid #c7d2fe", marginTop: "20px" }}>
            <h3 style={{ margin: "0 0 6px", color: "#4338ca" }}>
                {existing ? "Update Your Feedback" : "Leave Feedback"}
            </h3>
            <p style={{ color: "#666", fontSize: "0.85rem", margin: "0 0 14px" }}>
                Your feedback is anonymous — the organizer will not see your name.
            </p>

            {msg.text && (
                <div style={{ padding: "8px 12px", borderRadius: "4px", marginBottom: "12px", color: "white", background: msg.type === "error" ? "#dc3545" : "#28a745", fontSize: "0.9rem" }}>
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Star Rating */}
                <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontWeight: "bold", display: "block", marginBottom: "6px" }}>Rating</label>
                    <div style={{ display: "flex", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <span
                                key={star}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                style={{
                                    cursor: "pointer",
                                    fontSize: "1.8rem",
                                    color: star <= (hoverRating || rating) ? "#f59e0b" : "#d1d5db",
                                    transition: "color 0.15s"
                                }}
                            >
                                ★
                            </span>
                        ))}
                        {rating > 0 && (
                            <span style={{ fontSize: "0.85rem", color: "#666", alignSelf: "center", marginLeft: "8px" }}>
                                {rating}/5
                            </span>
                        )}
                    </div>
                </div>

                {/* Comment */}
                <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontWeight: "bold", display: "block", marginBottom: "6px" }}>Comment (optional)</label>
                    <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value.slice(0, 2000))}
                        placeholder="Share your experience..."
                        maxLength={2000}
                        style={{
                            width: "100%", padding: "10px", border: "1px solid #d1d5db",
                            borderRadius: "6px", resize: "vertical", minHeight: "70px",
                            boxSizing: "border-box", fontSize: "0.9rem"
                        }}
                    />
                    <div style={{ fontSize: "0.75rem", color: comment.length > 1800 ? "#ef4444" : "#999", textAlign: "right", marginTop: "2px" }}>
                        {comment.length}/2000
                    </div>
                </div>

                <button type="submit" style={{
                    padding: "10px 20px", background: "#4f46e5", color: "white",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
                }}>
                    {existing ? "Update Feedback" : "Submit Feedback"}
                </button>
            </form>
        </div>
    );
};

export default FeedbackForm;

import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { io } from "socket.io-client";

const TeamChatPage = () => {
    const { teamId } = useParams();
    const { user, authTokens } = useContext(AuthContext);
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [teamInfo, setTeamInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const isTabFocused = useRef(true);
    const originalTitle = useRef(document.title);

    const userId = user?.id || user?._id;

    // Track tab focus for notifications
    useEffect(() => {
        const savedTitle = originalTitle.current;
        const handleFocus = () => {
            isTabFocused.current = true;
            setUnreadCount(0);
            document.title = savedTitle;
        };
        const handleBlur = () => {
            isTabFocused.current = false;
        };
        window.addEventListener("focus", handleFocus);
        window.addEventListener("blur", handleBlur);

        // Request notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        return () => {
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("blur", handleBlur);
            document.title = savedTitle;
        };
    }, []);

    // Update tab title with unread count
    useEffect(() => {
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) New Messages - Team Chat`;
        } else {
            document.title = originalTitle.current;
        }
    }, [unreadCount]);

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Send browser notification
    const sendBrowserNotification = useCallback((senderName, text) => {
        if ("Notification" in window && Notification.permission === "granted" && !isTabFocused.current) {
            const body = text || "Sent a file";
            const n = new Notification(`${senderName} - Team Chat`, {
                body: body.length > 80 ? body.slice(0, 80) + "..." : body,
                tag: "team-chat-" + teamId
            });
            setTimeout(() => n.close(), 4000);
        }
    }, [teamId]);

    // Fetch team info
    useEffect(() => {
        const fetchTeam = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/teams/${teamId}`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                const data = await res.json();
                if (res.ok) {
                    setTeamInfo(data);
                } else {
                    setError(data.msg || "Failed to load team");
                }
            } catch {
                setError("Server error");
            }
        };
        fetchTeam();
    }, [teamId, authTokens]);

    // Fetch message history
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/chat/${teamId}/messages`, {
                    headers: { "x-auth-token": authTokens.token }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data);
                }
            } catch (err) {
                console.error("Failed to load messages", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [teamId, authTokens]);

    // Socket.IO connection
    useEffect(() => {
        const socket = io("http://localhost:5000", {
            auth: { token: authTokens.token }
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("joinTeam", teamId);
        });

        socket.on("newMessage", (msg) => {
            setMessages(prev => [...prev, msg]);

            // Notification for messages from others
            const senderId = msg.sender?._id || msg.sender;
            if (senderId !== userId) {
                const senderName = msg.sender?.firstName
                    ? `${msg.sender.firstName} ${msg.sender.lastName}`
                    : "Teammate";
                sendBrowserNotification(senderName, msg.message || (msg.fileName ? `Shared: ${msg.fileName}` : "Sent a file"));

                if (!isTabFocused.current) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        });

        socket.on("onlineUsers", (users) => {
            setOnlineUsers(users);
        });

        socket.on("userTyping", ({ id, name }) => {
            setTypingUsers(prev => {
                if (prev.find(u => u.id === id)) return prev;
                return [...prev, { id, name }];
            });
        });

        socket.on("userStopTyping", ({ id }) => {
            setTypingUsers(prev => prev.filter(u => u.id !== id));
        });

        return () => {
            socket.disconnect();
        };
    }, [teamId, authTokens, userId, sendBrowserNotification]);

    // Auto-scroll on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Typing indicator
    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (socketRef.current) {
            socketRef.current.emit("typing", teamId);
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socketRef.current.emit("stopTyping", teamId);
            }, 1500);
        }
    };

    // Send message
    const sendMessage = (e) => {
        e.preventDefault();
        if (!input.trim() || !socketRef.current) return;
        socketRef.current.emit("sendMessage", { teamId, message: input.trim() });
        socketRef.current.emit("stopTyping", teamId);
        setInput("");
    };

    // File upload
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch(`http://localhost:5000/api/chat/${teamId}/upload`, {
                method: "POST",
                headers: { "x-auth-token": authTokens.token },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                socketRef.current.emit("sendMessage", {
                    teamId,
                    message: "",
                    fileUrl: data.fileUrl,
                    fileName: data.fileName
                });
            } else {
                alert(data.msg || "Upload failed");
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("File upload failed. Please try again.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Render a message with clickable links
    const renderMessageText = (text) => {
        if (!text) return null;
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlPattern);
        return parts.map((part, i) => {
            if (part.match(/^https?:\/\//)) {
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", wordBreak: "break-all" }}>{part}</a>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Group messages by date
    const groupedMessages = [];
    let lastDate = "";
    messages.forEach(msg => {
        const date = formatDate(msg.createdAt);
        if (date !== lastDate) {
            groupedMessages.push({ type: "dateSeparator", date });
            lastDate = date;
        }
        groupedMessages.push({ type: "message", data: msg });
    });

    if (error) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <h2>Error</h2>
                <p style={{ color: "red" }}>{error}</p>
                <button onClick={() => navigate(-1)} style={backBtnStyle}>Go Back</button>
            </div>
        );
    }

    const typingNames = typingUsers.filter(u => u.id !== userId).map(u => u.name);

    return (
        <div style={{ display: "flex", height: "calc(100vh - 60px)", fontFamily: "Arial, sans-serif" }}>
            {/* Sidebar */}
            <div style={{ width: "220px", background: "#f8f9fa", borderRight: "1px solid #e0e0e0", padding: "16px", overflowY: "auto", flexShrink: 0 }}>
                <button onClick={() => navigate(-1)} style={{ ...backBtnStyle, marginBottom: "16px" }}>
                    &larr; Back
                </button>
                <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>{teamInfo?.name || "Team Chat"}</h3>
                {teamInfo?.event?.name && (
                    <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "#666" }}>{teamInfo.event.name}</p>
                )}
                <h4 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Members ({teamInfo?.members?.length || 0})
                </h4>
                {teamInfo?.members?.map(m => {
                    const memberId = m._id || m;
                    const name = m.firstName ? `${m.firstName} ${m.lastName}` : memberId;
                    const isOnline = onlineUsers.some(u => u.id === memberId.toString());
                    const isTyping = typingUsers.some(u => u.id === memberId.toString());
                    return (
                        <div key={memberId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                            <span style={{
                                width: "8px", height: "8px", borderRadius: "50%",
                                background: isOnline ? "#22c55e" : "#d1d5db",
                                display: "inline-block", flexShrink: 0
                            }} />
                            <span style={{ fontSize: "0.85rem", color: isOnline ? "#111" : "#888" }}>
                                {name}
                                {memberId.toString() === (teamInfo?.leader?._id || teamInfo?.leader)?.toString() ? " (Leader)" : ""}
                            </span>
                            {isTyping && memberId.toString() !== userId && (
                                <span style={{ fontSize: "0.7rem", color: "#6366f1", fontStyle: "italic" }}>typing...</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#fff" }}>
                    {loading ? (
                        <p style={{ textAlign: "center", color: "#888" }}>Loading messages...</p>
                    ) : messages.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#888", marginTop: "40px" }}>
                            No messages yet. Start the conversation!
                        </p>
                    ) : (
                        groupedMessages.map((item, i) => {
                            if (item.type === "dateSeparator") {
                                return (
                                    <div key={`date-${i}`} style={{ textAlign: "center", margin: "20px 0 12px", color: "#999", fontSize: "0.75rem" }}>
                                        <span style={{ background: "#f3f4f6", padding: "4px 12px", borderRadius: "10px" }}>{item.date}</span>
                                    </div>
                                );
                            }
                            const msg = item.data;
                            const senderId = msg.sender?._id || msg.sender;
                            const isMe = senderId === userId;
                            const senderName = msg.sender?.firstName
                                ? `${msg.sender.firstName} ${msg.sender.lastName}`
                                : "Unknown";

                            return (
                                <div key={msg._id} style={{
                                    display: "flex",
                                    justifyContent: isMe ? "flex-end" : "flex-start",
                                    marginBottom: "8px"
                                }}>
                                    <div style={{
                                        maxWidth: "65%",
                                        padding: "10px 14px",
                                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background: isMe ? "#4f46e5" : "#f3f4f6",
                                        color: isMe ? "#fff" : "#111"
                                    }}>
                                        {!isMe && (
                                            <div style={{ fontSize: "0.75rem", fontWeight: "bold", marginBottom: "4px", color: "#6366f1" }}>
                                                {senderName}
                                            </div>
                                        )}
                                        {msg.message && (
                                            <div style={{ fontSize: "0.9rem", lineHeight: "1.4", wordBreak: "break-word" }}>
                                                {renderMessageText(msg.message)}
                                            </div>
                                        )}
                                        {msg.fileUrl && (
                                            <div style={{ marginTop: msg.message ? "6px" : 0 }}>
                                                <a
                                                    href={`http://localhost:5000${msg.fileUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", gap: "6px",
                                                        padding: "6px 10px", borderRadius: "6px",
                                                        background: isMe ? "rgba(255,255,255,0.15)" : "#e5e7eb",
                                                        color: isMe ? "#ddd" : "#333",
                                                        textDecoration: "none", fontSize: "0.8rem"
                                                    }}
                                                >
                                                    {msg.fileName || "Download File"}
                                                </a>
                                            </div>
                                        )}
                                        <div style={{ fontSize: "0.65rem", opacity: 0.6, marginTop: "4px", textAlign: "right" }}>
                                            {formatTime(msg.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing indicator */}
                {typingNames.length > 0 && (
                    <div style={{ padding: "4px 20px", fontSize: "0.8rem", color: "#888", fontStyle: "italic", background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
                        {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
                    </div>
                )}

                {/* Input bar */}
                <form onSubmit={sendMessage} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "12px 16px", borderTop: "1px solid #e0e0e0", background: "#fafafa"
                }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            padding: "8px 12px", background: "#e5e7eb", border: "none",
                            borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", flexShrink: 0
                        }}
                        title="Attach file"
                    >
                        {uploading ? "..." : "Attach"}
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        maxLength={5000}
                        style={{
                            flex: 1, padding: "10px 14px", border: "1px solid #d1d5db",
                            borderRadius: "8px", fontSize: "0.9rem", outline: "none"
                        }}
                        autoFocus
                    />
                    {input.length > 4500 && (
                        <span style={{ fontSize: "0.7rem", color: input.length > 4900 ? "#ef4444" : "#999", flexShrink: 0 }}>
                            {input.length}/5000
                        </span>
                    )}
                    <button type="submit" disabled={!input.trim()} style={{
                        padding: "10px 20px", background: input.trim() ? "#4f46e5" : "#c7d2fe",
                        color: "#fff", border: "none", borderRadius: "8px",
                        cursor: input.trim() ? "pointer" : "default", fontWeight: "bold",
                        fontSize: "0.9rem", flexShrink: 0
                    }}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

const backBtnStyle = {
    background: "none", border: "none", cursor: "pointer",
    color: "#4f46e5", fontSize: "0.9rem", padding: 0, fontWeight: "bold"
};

export default TeamChatPage;

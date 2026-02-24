import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { Html5QrcodeScanner } from 'html5-qrcode';
import FeedbackForm from "../components/FeedbackForm";
const EventDetailsPage = () => {
    const { id } = useParams();
    const { user, authTokens } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [registrations, setRegistrations] = useState([]);

    const orgId = event?.organizer?._id || event?.organizer;
    const userId = user?.id || user?._id;
    const isOrganizer = !!(user && event && orgId && userId && String(orgId) === String(userId));

    useEffect(() => {
        const fetchRegistrations = async () => {
            if (event && isOrganizer) {
                try {
                    const res = await fetch(`http://localhost:5000/api/registrations/event/${id}`, {
                        headers: { "x-auth-token": authTokens?.token }
                    });
                    const d = await res.json();
                    if (res.ok) setRegistrations(d);
                } catch (err) { console.error("Error fetching registrations", err); }
            }
        };
        fetchRegistrations();
    }, [event, isOrganizer, authTokens, id]);

    // ─────────────────────────────────────────────────────────
    // Organizer QR Scanner & Attendance Logic
    // ─────────────────────────────────────────────────────────
    const [scanResult, setScanResult] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef(null);

    useEffect(() => {
        if (showScanner) {
            scannerRef.current = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false);
            scannerRef.current.render(onScanSuccess, onScanFailure);
        } else {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
                scannerRef.current = null;
            }
        }
        return () => {
            if (scannerRef.current) scannerRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showScanner]);

    const onScanSuccess = async (decodedText) => {
        let ticketId = decodedText;
        try {
            const parsed = JSON.parse(decodedText);
            if (parsed.ticketId) ticketId = parsed.ticketId;
        } catch (e) { /* ignore, assume it's a raw string */ }

        if (scannerRef.current) scannerRef.current.pause(true);

        try {
            const res = await fetch(`http://localhost:5000/api/registrations/scan/${ticketId}`, {
                method: "PUT",
                headers: { "x-auth-token": authTokens.token }
            });
            const data = await res.json();

            if (res.ok) {
                setScanResult({ type: 'success', text: `${data.msg} (${data.participant})` });
                setRegistrations(prev => prev.map(reg => reg.ticketId === ticketId ? { ...reg, status: 'attended' } : reg));
                setTimeout(() => {
                    setScanResult(null);
                    if (scannerRef.current) scannerRef.current.resume();
                }, 3000);
            } else {
                setScanResult({ type: 'error', text: data.msg || "Invalid Ticket" });
                setTimeout(() => {
                    setScanResult(null);
                    if (scannerRef.current) scannerRef.current.resume();
                }, 3000);
            }
        } catch (err) {
            setScanResult({ type: 'error', text: "Server error during scan." });
            setTimeout(() => {
                setScanResult(null);
                if (scannerRef.current) scannerRef.current.resume();
            }, 3000);
        }
    };

    const onScanFailure = (error) => { };

    const handleManualOverride = async (regId, name, currentStatus) => {
        const action = currentStatus === 'attended' ? 'registered' : 'attended';
        const reason = window.prompt(`Manual Override: Reason for marking ${name} as ${action.toUpperCase()}?`);
        if (!reason) return;

        try {
            const res = await fetch(`http://localhost:5000/api/registrations/${regId}/override`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ reason, action })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.msg);
                setRegistrations(prev => prev.map(reg => reg._id === regId ? { ...reg, status: action } : reg));
            } else {
                alert(data.msg || "Override failed.");
            }
        } catch (err) {
            alert("Server Error during override.");
        }
    };

    const handleExportCSV = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/registrations/event/${id}/export`, {
                headers: { "x-auth-token": authTokens.token }
            });
            if (!res.ok) throw new Error("Failed to export.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `attendance_${event.name.replace(/\s+/g, '_')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert("Error exporting CSV");
        }
    };
    // Registration State
    const [showForm, setShowForm] = useState(false);
    const [formResponses, setFormResponses] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [regError, setRegError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Team Registration State
    const [myTeam, setMyTeam] = useState(undefined); // undefined=loading, null=none, obj=existing team
    const [teamMode, setTeamMode] = useState('none'); // 'none'|'create'|'join-preview'|'join-confirm'
    const [teamName, setTeamName] = useState("");
    const [targetSize, setTargetSize] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [invitePreview, setInvitePreview] = useState(null); // team preview before confirming join
    const [teamFormResponses, setTeamFormResponses] = useState({});  // this member's form answers

    // 1. Fetch Event Details + check existing team membership
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/events/${id}`);
                const data = await response.json();

                if (response.ok) {
                    setEvent(data);

                    // Pre-initialize empty strings for custom form fields
                    if (data.formFields) {
                        const initialResponses = {};
                        data.formFields.forEach(field => {
                            initialResponses[field.label] = "";
                        });
                        setFormResponses(initialResponses);
                        setTeamFormResponses(initialResponses);
                    }

                    // If team event: check if this participant already has a team
                    if (data.isTeamEvent && authTokens) {
                        try {
                            const teamRes = await fetch(`http://localhost:5000/api/teams/event/${id}/my-team`, {
                                headers: { "x-auth-token": authTokens.token }
                            });
                            const teamData = await teamRes.json();
                            setMyTeam(teamRes.ok ? teamData : null);
                        } catch {
                            setMyTeam(null);
                        }
                    } else {
                        setMyTeam(null);
                    }
                } else {
                    setError(data.msg || "Event not found");
                    setMyTeam(null);
                }
            } catch (err) {
                setError("Server Error while fetching event");
                setMyTeam(null);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [id, authTokens]);

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

    const handleCreateTeam = async () => {
        setRegError("");
        try {
            const response = await fetch("http://localhost:5000/api/teams/create", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({
                    eventId: id,
                    teamName,
                    targetSize: Number(targetSize),
                    responses: teamFormResponses
                })
            });
            const data = await response.json();
            if (response.ok) {
                setMyTeam(data);
                setTeamMode('none');
                setSuccessMsg(`Team "${data.name}" created! Share code: ${data.inviteCode}`);
            } else {
                setRegError(data.msg || "Failed to create team.");
            }
        } catch (err) {
            setRegError("Server error.");
        }
    };

    const previewTeamByCode = useCallback(async (rawCode) => {
        const normalizedCode = (rawCode || "").trim().toUpperCase();
        if (!normalizedCode) {
            setRegError("Please enter an invite code.");
            return;
        }
        const res = await fetch(`http://localhost:5000/api/teams/preview/${normalizedCode}`, {
            headers: { "x-auth-token": authTokens.token }
        });
        const data = await res.json();
        if (res.ok) {
            if (data.status === 'completed') {
                setRegError("This team is already full.");
                return;
            }
            setInviteCode(normalizedCode);
            setInvitePreview(data);
            setTeamMode('join-confirm');
        } else {
            setRegError(data.msg || "Invalid code.");
        }
    }, [authTokens]);

    const handlePreviewTeam = async () => {
        setRegError("");
        try {
            await previewTeamByCode(inviteCode);
        } catch {
            setRegError("Server error.");
        }
    };

    useEffect(() => {
        const queryInvite = new URLSearchParams(location.search).get("invite");
        if (!queryInvite || !event?.isTeamEvent || !authTokens || myTeam !== null) return;
        if (invitePreview) return;

        const runPreview = async () => {
            try {
                setRegError("");
                setTeamMode('join-preview');
                await previewTeamByCode(queryInvite);
            } catch {
                setRegError("Invalid invite link.");
            }
        };

        runPreview();
    }, [location.search, event?.isTeamEvent, authTokens, myTeam, invitePreview, previewTeamByCode]);

    const handleJoinTeam = async () => {
        setRegError("");
        try {
            const response = await fetch("http://localhost:5000/api/teams/join", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase(), responses: teamFormResponses })
            });
            const data = await response.json();
            if (response.ok) {
                setMyTeam(data.team);
                setTeamMode('none');
                setSuccessMsg(data.msg);
            } else {
                setRegError(data.msg || "Failed to join team.");
            }
        } catch (err) {
            setRegError("Server error.");
        }
    };

    if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading event details...</div>;
    if (error) return <div style={{ color: "red", padding: "20px" }}>{error}</div>;
    if (!event) return null;

    // 4. Validation Checks for UI Blocking (Section 9.4)
    const now = new Date();
    const deadlinePassed = new Date(event.registrationDeadline) < now;
    const isOngoingStatus = event.status === 'ongoing';
    const isCompletedStatus = event.status === 'completed';

    let isFull = false;
    let slotsLeft = null;
    if (event.eventType === 'merchandise') {
        isFull = event.stock <= 0;
        slotsLeft = event.stock;
    } else {
        slotsLeft = event.registrationLimit - event.registrationCount;
        isFull = slotsLeft <= 0;
    }

    const isIIITOnly = event.eligibility === 'iiit-only';
    const notEligible = isIIITOnly && user && !user.isIIIT;

    // Registration is blocked if ongoing/completed too
    const regClosed = isOngoingStatus || isCompletedStatus;

    const organizerDisplayName = event.organizer?.organizerName ||
        `${event.organizer?.firstName || ''} ${event.organizer?.lastName || ''}`.trim();

    const STATUS_COLORS = {
        upcoming: { bg: '#d4edda', color: '#155724', label: 'Open for Registration' },
        published: { bg: '#d4edda', color: '#155724', label: 'Open for Registration' }, // legacy
        ongoing: { bg: '#cce5ff', color: '#004085', label: 'Ongoing · Registration Closed' },
        completed: { bg: '#e2e3e5', color: '#383d41', label: 'Event Completed' },
        draft: { bg: '#fff3cd', color: '#856404', label: 'Draft' },
    };
    let statusStyle = STATUS_COLORS[event.status] || STATUS_COLORS.upcoming;
    let statusLabel = statusStyle.label;

    if ((event.status === 'upcoming' || event.status === 'published') && deadlinePassed) {
        statusStyle = { bg: '#f8d7da', color: '#721c24' };
        statusLabel = 'Registration Closed (Deadline Passed)';
    }

    return (
        <div style={{ maxWidth: "860px", margin: "auto", padding: "20px" }}>
            <div style={{ background: "#f9f9f9", padding: "30px", borderRadius: "8px" }}>

                {/* Status Banner */}
                <div style={{ background: statusStyle.bg, color: statusStyle.color, padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "0.9rem", marginBottom: "18px" }}>
                    {statusLabel}
                </div>

                <h1 style={{ margin: "0 0 6px 0" }}>{event.name}</h1>
                <p style={{ color: "gray", fontSize: "1rem", margin: "0 0 16px 0" }}>
                    Organized by: <strong>{organizerDisplayName}</strong>
                    {event.organizer?.organizerCategory && <span style={{ marginLeft: "8px", fontSize: "0.85rem", background: "#e9ecef", padding: "2px 8px", borderRadius: "10px" }}>{event.organizer.organizerCategory}</span>}
                </p>

                {/* Top Badges */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "0 0 18px 0" }}>
                    <span style={badgeStyle}>{event.eventType === 'merchandise' ? 'Merchandise' : 'Normal Event'}</span>
                    <span style={{ ...badgeStyle, background: isIIITOnly ? '#fff3cd' : '#d4edda', color: isIIITOnly ? '#856404' : '#155724' }}>
                        {isIIITOnly ? 'IIIT Only' : 'Open to All'}
                    </span>
                    {event.fee > 0 ? (
                        <span style={{ ...badgeStyle, background: '#e8f4ff', color: '#0056b3' }}>₹{event.fee}</span>
                    ) : (
                        <span style={{ ...badgeStyle, background: '#d4edda', color: '#155724' }}>Free</span>
                    )}
                    <span style={{
                        ...badgeStyle,
                        background: isFull ? '#f8d7da' : slotsLeft <= 10 ? '#fff3cd' : '#e9ecef',
                        color: isFull ? '#721c24' : slotsLeft <= 10 ? '#856404' : '#333'
                    }}>
                        {event.eventType === 'merchandise'
                            ? (isFull ? 'Out of Stock' : `${slotsLeft} in stock`)
                            : (isFull ? 'Fully Booked' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} left`)}
                    </span>
                </div>

                <p style={{ fontSize: "1.05rem", lineHeight: "1.7", color: "#333" }}>{event.description}</p>

                {/* Schedule Box */}
                <div style={{ background: "white", padding: "20px", borderRadius: "8px", marginTop: "20px", border: "1px solid #ddd" }}>
                    <h3 style={{ margin: "0 0 12px" }}>Event Schedule</h3>
                    <p style={{ margin: "6px 0" }}><strong>Starts:</strong> {new Date(event.startDate).toLocaleString()}</p>
                    <p style={{ margin: "6px 0" }}><strong>Ends:</strong> {new Date(event.endDate).toLocaleString()}</p>
                    <p style={{ margin: "6px 0", color: deadlinePassed ? "red" : "inherit" }}>
                        <strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}
                        {deadlinePassed && <span style={{ marginLeft: "8px", fontWeight: "bold", color: "red" }}>(Closed)</span>}
                    </p>
                </div>

                {/* --- REGISTRATION SECTION --- */}
                <div style={{ marginTop: "30px", padding: "20px", background: "#e9ecef", borderRadius: "8px" }}>
                    {successMsg ? (
                        <div style={{ color: "green", fontSize: "1.1rem", fontWeight: "bold" }}>{successMsg}</div>
                    ) : !user ? (
                        <p>Please <a href="/login">login</a> to register for this event.</p>
                    ) : user.role !== 'participant' ? (
                        <p style={{ color: "#555" }}>Only participants can register for events.</p>
                    ) : regClosed ? (
                        // Even when registrations are closed, show existing team so members can manage it
                        event.isTeamEvent && myTeam ? (
                            <div>
                                {regError && <p style={{ color: "red", marginBottom: "10px" }}>{regError}</p>}
                                <p style={{ color: "#004085", fontWeight: "bold", marginBottom: "14px" }}>Registrations are closed — manage your existing team:</p>
                                <ExistingTeamPanel
                                    team={myTeam}
                                    userId={user._id || user.id}
                                    onDisband={async () => {
                                        if (!window.confirm("Disband this team? All members will lose their spot.")) return;
                                        const res = await fetch(`http://localhost:5000/api/teams/${myTeam._id}`, {
                                            method: "DELETE", headers: { "x-auth-token": authTokens.token }
                                        });
                                        if (res.ok) { setMyTeam(null); setSuccessMsg("Team disbanded."); }
                                        else { const d = await res.json(); setRegError(d.msg); }
                                    }}
                                    onLeave={async () => {
                                        if (!window.confirm("Leave this team?")) return;
                                        const res = await fetch(`http://localhost:5000/api/teams/${myTeam._id}/leave`, {
                                            method: "DELETE", headers: { "x-auth-token": authTokens.token }
                                        });
                                        if (res.ok) { setMyTeam(null); setSuccessMsg("You left the team."); }
                                        else { const d = await res.json(); setRegError(d.msg); }
                                    }}
                                />
                            </div>
                        ) : (
                            <p style={{ color: "#004085", fontWeight: "bold" }}>Registrations are closed — this event is {event.status}.</p>
                        )
                    ) : deadlinePassed ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>Registrations closed (deadline passed).</p>
                    ) : isFull ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>{event.eventType === 'merchandise' ? 'Out of Stock' : 'Event is fully booked.'}</p>
                    ) : notEligible ? (
                        <p style={{ color: "red", fontWeight: "bold" }}>This event is restricted to IIIT students only.</p>
                    ) : (
                        <>
                            {!showForm && !event.isTeamEvent && (
                                <button
                                    onClick={() => setShowForm(true)}
                                    style={{ padding: "15px 30px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", fontSize: "1.2rem", cursor: "pointer" }}
                                >
                                    {event.eventType === 'merchandise' ? 'Buy Now' : 'Register Now'}
                                </button>
                            )}

                            {/* ── TEAM EVENT REGISTRATION ── */}
                            {event.isTeamEvent && (
                                <div style={{ background: "white", padding: "20px", borderRadius: "8px", marginTop: "10px" }}>
                                    <h3 style={{ margin: "0 0 14px 0" }}>Team Registration</h3>
                                    {regError && <p style={{ color: "red", margin: "0 0 10px 0" }}>{regError}</p>}

                                    {/* ── User already has a team ── */}
                                    {myTeam === undefined ? (
                                        <p style={{ color: "#888", fontSize: "0.9rem" }}>Checking team status...</p>
                                    ) : myTeam ? (
                                        <ExistingTeamPanel
                                            team={myTeam}
                                            userId={user._id || user.id}
                                            onDisband={async () => {
                                                if (!window.confirm("Disband this team? All members will lose their spot.")) return;
                                                const res = await fetch(`http://localhost:5000/api/teams/${myTeam._id}`, {
                                                    method: "DELETE", headers: { "x-auth-token": authTokens.token }
                                                });
                                                if (res.ok) { setMyTeam(null); setSuccessMsg("Team disbanded."); }
                                                else { const d = await res.json(); setRegError(d.msg); }
                                            }}
                                            onLeave={async () => {
                                                if (!window.confirm("Leave this team?")) return;
                                                const res = await fetch(`http://localhost:5000/api/teams/${myTeam._id}/leave`, {
                                                    method: "DELETE", headers: { "x-auth-token": authTokens.token }
                                                });
                                                if (res.ok) { setMyTeam(null); setSuccessMsg("You left the team."); }
                                                else { const d = await res.json(); setRegError(d.msg); }
                                            }}
                                        />
                                    ) : teamMode === 'none' ? (
                                        /* ── Choose action ── */
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                            <button
                                                onClick={() => setTeamMode('create')}
                                                style={{ padding: "14px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}
                                            >
                                                Create a Team
                                            </button>
                                            <button
                                                onClick={() => setTeamMode('join-preview')}
                                                style={{ padding: "14px", background: "#007bff", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}
                                            >
                                                Join via Invite Code
                                            </button>
                                        </div>

                                    ) : teamMode === 'create' ? (
                                        /* ── Create Team form ── */
                                        <div>
                                            <button onClick={() => { setTeamMode('none'); setRegError(''); }} style={backBtnStyle}>← Back</button>
                                            <h4 style={{ margin: "14px 0 10px" }}>Create Your Team</h4>
                                            <input type="text" placeholder="Team Name" value={teamName}
                                                onChange={e => setTeamName(e.target.value)}
                                                style={{ ...inputStyle, marginBottom: "10px" }} />
                                            <input type="number"
                                                placeholder={`Team Size (${event.minTeamSize}–${event.maxTeamSize})`}
                                                value={targetSize} onChange={e => setTargetSize(e.target.value)}
                                                min={event.minTeamSize} max={event.maxTeamSize}
                                                style={{ ...inputStyle, marginBottom: "16px" }} />

                                            {/* Leader's own form responses */}
                                            {event.formFields && event.formFields.length > 0 && (
                                                <>
                                                    <p style={{ fontWeight: "bold", margin: "0 0 8px 0", color: "#555" }}>Your Registration Details:</p>
                                                    <TeamFormFields fields={event.formFields} responses={teamFormResponses} onChange={(label, val) => setTeamFormResponses(prev => ({ ...prev, [label]: val }))} />
                                                </>
                                            )}

                                            <button onClick={handleCreateTeam}
                                                style={{ width: "100%", padding: "12px", background: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }}>
                                                Create &amp; Get Invite Code
                                            </button>
                                        </div>

                                    ) : teamMode === 'join-preview' ? (
                                        /* ── Enter invite code to preview ── */
                                        <div>
                                            <button onClick={() => { setTeamMode('none'); setRegError(''); setInviteCode(''); }} style={backBtnStyle}>← Back</button>
                                            <h4 style={{ margin: "14px 0 10px" }}>Join via Invite Code</h4>
                                            <div style={{ display: "flex", gap: "10px" }}>
                                                <input type="text" placeholder="Enter 6-character code  (e.g. A1B2C3)"
                                                    value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                                    style={{ ...inputStyle, flex: 1, letterSpacing: "0.15em", fontFamily: "monospace" }} />
                                                <button onClick={handlePreviewTeam}
                                                    style={{ padding: "10px 20px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
                                                    Preview
                                                </button>
                                            </div>
                                        </div>

                                    ) : teamMode === 'join-confirm' && invitePreview ? (
                                        /* ── Show team preview + form, confirm join ── */
                                        <div>
                                            <button onClick={() => { setTeamMode('join-preview'); setInvitePreview(null); setRegError(''); }} style={backBtnStyle}>← Back</button>
                                            <div style={{ background: "#e9ecef", borderRadius: "6px", padding: "14px", margin: "14px 0" }}>
                                                <h4 style={{ margin: "0 0 8px 0" }}>Team: {invitePreview.name}</h4>
                                                <p style={{ margin: "4px 0" }}><strong>Event:</strong> {invitePreview.event?.name}</p>
                                                <p style={{ margin: "4px 0" }}><strong>Leader:</strong> {invitePreview.leader?.firstName} {invitePreview.leader?.lastName}</p>
                                                <p style={{ margin: "4px 0" }}><strong>Members:</strong> {invitePreview.currentSize} / {invitePreview.targetSize} &nbsp;
                                                    <span style={{ color: invitePreview.slotsLeft > 0 ? '#28a745' : '#dc3545' }}>({invitePreview.slotsLeft} slot{invitePreview.slotsLeft !== 1 ? 's' : ''} left)</span>
                                                </p>
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                                                    {invitePreview.members.map(m => (
                                                        <span key={m._id} style={{ background: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "0.85rem" }}>
                                                            {m.firstName} {m.lastName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Joining member's own form responses */}
                                            {event.formFields && event.formFields.length > 0 && (
                                                <>
                                                    <p style={{ fontWeight: "bold", margin: "0 0 8px 0", color: "#555" }}>Your Registration Details:</p>
                                                    <TeamFormFields fields={event.formFields} responses={teamFormResponses} onChange={(label, val) => setTeamFormResponses(prev => ({ ...prev, [label]: val }))} />
                                                </>
                                            )}

                                            <button onClick={handleJoinTeam}
                                                style={{ width: "100%", padding: "12px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }}>
                                                Confirm Join
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {showForm && !event.isTeamEvent && (
                                <form onSubmit={handleRegister} style={{ background: "white", padding: "20px", borderRadius: "8px" }}>
                                    <h3>Complete Registration</h3>
                                    {regError && <p style={{ color: "red" }}>{regError}</p>}

                                    {/* Merchandise Quantity Selector */}
                                    {event.eventType === 'merchandise' && (
                                        <div style={{ marginBottom: "15px" }}>
                                            <label>Quantity (Max {Math.min(event.maxItemsPerUser, event.stock)}): </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max={Math.min(event.maxItemsPerUser, event.stock)}
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
                                                {field.label} {field.required && <span style={{ color: "red" }}>*</span>}
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

                {/* Feedback Section — visible for completed/ongoing events for logged-in participants */}
                {user && user.role === 'participant' && event && (event.status === 'completed' || event.status === 'ongoing') && (
                    <FeedbackForm eventId={id} />
                )}

                {/* ── Organizer View (outside the registration section) ── */}
                {isOrganizer && (
                    <div style={{ marginTop: "40px", borderTop: "2px solid #ccc", paddingTop: "20px" }}>
                        <h2>Organizer Dashboard</h2>

                        {/* Live Stats Board */}
                        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
                            <div style={{ background: "#e9ecef", padding: "15px 20px", borderRadius: "8px", flex: 1, minWidth: "150px", textAlign: "center" }}>
                                <h4 style={{ margin: "0 0 5px", color: "#495057" }}>Total Registered</h4>
                                <span style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#007bff" }}>{registrations.length}</span>
                            </div>
                            <div style={{ background: "#d4edda", padding: "15px 20px", borderRadius: "8px", flex: 1, minWidth: "150px", textAlign: "center" }}>
                                <h4 style={{ margin: "0 0 5px", color: "#155724" }}>Checked In</h4>
                                <span style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#28a745" }}>{registrations.filter(r => r.status === 'attended').length}</span>
                            </div>
                            <div style={{ background: "#fff3cd", padding: "15px 20px", borderRadius: "8px", flex: 1, minWidth: "150px", textAlign: "center" }}>
                                <h4 style={{ margin: "0 0 5px", color: "#856404" }}>Yet to Arrive</h4>
                                <span style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#ffc107" }}>{registrations.filter(r => r.status === 'registered').length}</span>
                            </div>
                        </div>

                        {/* Actions Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
                            <h3>Registered Participants ({registrations.length})</h3>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button onClick={() => setShowScanner(!showScanner)} style={{ padding: "8px 16px", background: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    {showScanner ? "Close Scanner" : "Scan QR Ticket"}
                                </button>
                                <button onClick={handleExportCSV} style={{ padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Scanner UI */}
                        {showScanner && (
                            <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "8px", marginBottom: "20px", border: "2px dashed #17a2b8" }}>
                                <h4 style={{ margin: "0 0 10px", textAlign: "center" }}>Point camera at Participant's QR Code or Upload File</h4>
                                {scanResult && (
                                    <div style={{ textAlign: "center", padding: "10px", margin: "10px 0", borderRadius: "4px", background: scanResult.type === 'success' ? '#d4edda' : '#f8d7da', color: scanResult.type === 'success' ? '#155724' : '#721c24', fontWeight: "bold" }}>
                                        {scanResult.text}
                                    </div>
                                )}
                                <div id="qr-reader" style={{ width: "100%", maxWidth: "500px", margin: "0 auto" }}></div>
                            </div>
                        )}

                        {registrations.length === 0 ? (
                            <p>No one has registered yet.</p>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                                    <thead>
                                        <tr style={{ background: "#f1f1f1", textAlign: "left" }}>
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Name</th>
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Email</th>
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Contact</th>
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Ticket ID</th>
                                            {event.isTeamEvent && <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Team</th>}
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Status</th>
                                            <th style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.map(r => (
                                            <tr key={r._id} style={{ opacity: r.status === 'cancelled' ? 0.5 : 1 }}>
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>{r.user.firstName} {r.user.lastName}</td>
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>{r.user.email}</td>
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>{r.user.contactNumber || "N/A"}</td>
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd", fontFamily: "monospace", fontSize: "0.85rem" }}>{r.ticketId}</td>
                                                {event.isTeamEvent && <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>{r.teamName || "-"}</td>}
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
                                                    <span style={{
                                                        padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold",
                                                        background: r.status === 'attended' ? '#d4edda' : r.status === 'cancelled' ? '#f8d7da' : '#cce5ff',
                                                        color: r.status === 'attended' ? '#155724' : r.status === 'cancelled' ? '#721c24' : '#004085'
                                                    }}>
                                                        {r.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
                                                    {r.status !== 'cancelled' && (
                                                        <button
                                                            onClick={() => handleManualOverride(r._id, `${r.user.firstName} ${r.user.lastName}`, r.status)}
                                                            style={{ padding: "6px 12px", background: r.status === 'attended' ? "#dc3545" : "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                                                        >
                                                            Override to {r.status === 'attended' ? 'Reg' : 'Attend'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const badgeStyle = { background: "#e9ecef", padding: "5px 10px", borderRadius: "15px", fontSize: "0.9rem", fontWeight: "bold" };
const inputStyle = { width: "100%", padding: "9px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box" };
const backBtnStyle = { background: "none", border: "none", cursor: "pointer", color: "#007bff", fontSize: "0.9rem", padding: 0 };

// ── Sub-component: renders the event's custom form fields for a team member ──
const TeamFormFields = ({ fields, responses, onChange }) => (
    <div style={{ marginBottom: "10px" }}>
        {fields.map((field, i) => (
            <div key={i} style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
                    {field.label} {field.required && <span style={{ color: "red" }}>*</span>}
                </label>
                {field.fieldType === 'text' && (
                    <input type="text" value={responses[field.label] || ""} required={field.required}
                        onChange={e => onChange(field.label, e.target.value)} style={inputStyle} />
                )}
                {field.fieldType === 'number' && (
                    <input type="number" value={responses[field.label] || ""} required={field.required}
                        onChange={e => onChange(field.label, e.target.value)} style={inputStyle} />
                )}
                {field.fieldType === 'dropdown' && (
                    <select value={responses[field.label] || ""} required={field.required}
                        onChange={e => onChange(field.label, e.target.value)} style={inputStyle}>
                        <option value="">Select...</option>
                        {field.options?.map((opt, j) => <option key={j} value={opt}>{opt}</option>)}
                    </select>
                )}
                {field.fieldType === 'checkbox' && (
                    <div>{field.options?.map((opt, j) => {
                        const selected = (responses[field.label] || "").split(",").map(s => s.trim()).filter(Boolean);
                        return (
                            <label key={j} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <input type="checkbox" checked={selected.includes(opt)}
                                    onChange={() => {
                                        const updated = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                                        onChange(field.label, updated.join(", "));
                                    }} />
                                {opt}
                            </label>
                        );
                    })}</div>
                )}
                {field.fieldType === 'file' && (
                    <input type="file" required={field.required}
                        onChange={e => onChange(field.label, e.target.files[0]?.name || "")} style={inputStyle} />
                )}
            </div>
        ))}
    </div>
);

// ── Sub-component: shows the user's existing team panel ──
const ExistingTeamPanel = ({ team, userId, onDisband, onLeave, authTokens, onInviteSent }) => {
    const isLeader = team.leader?._id === userId || team.leader?._id?.toString() === userId;
    const inviteLink = `${window.location.origin}/event/${team.event?._id || team.event}?invite=${team.inviteCode}`;
    const [copied, setCopied] = useState(false);
    const copyCode = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteMsg, setInviteMsg] = useState(null);

    const handleInviteAction = async () => {
        if (!inviteEmail.trim()) return;
        try {
            const res = await fetch(`http://localhost:5000/api/teams/${team._id}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ email: inviteEmail.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setInviteMsg({ type: 'success', text: "Invite sent!" });
                setInviteEmail("");
                if (onInviteSent) onInviteSent();
            } else {
                setInviteMsg({ type: 'error', text: data.msg || "Failed to invite." });
            }
            setTimeout(() => setInviteMsg(null), 4000);
        } catch {
            setInviteMsg({ type: 'error', text: "Server error." });
            setTimeout(() => setInviteMsg(null), 4000);
        }
    };

    return (
        <div style={{ border: "2px solid #28a745", borderRadius: "8px", padding: "18px", background: "#f8fff9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                    <h4 style={{ margin: "0 0 4px 0" }}>{team.name}</h4>
                    <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold",
                        background: team.status === 'completed' ? '#d4edda' : '#fff3cd',
                        color: team.status === 'completed' ? '#155724' : '#856404'
                    }}>
                        {team.status === 'completed' ? 'Fully Formed' : 'Forming...'}
                    </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    {team.status === 'forming' && isLeader && (
                        <button onClick={onDisband} style={{ padding: "6px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>Disband</button>
                    )}
                    {team.status === 'forming' && !isLeader && (
                        <button onClick={onLeave} style={{ padding: "6px 12px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>Leave Team</button>
                    )}
                </div>
            </div>

            <p style={{ margin: "12px 0 6px", fontSize: "0.9rem" }}>
                <strong>Members</strong> ({team.members.length} / {team.targetSize}):
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                {team.members.map(m => (
                    <span key={m._id} style={{ background: "white", border: "1px solid #ccc", padding: "4px 10px", borderRadius: "12px", fontSize: "0.85rem" }}>
                        {m.firstName} {m.lastName} {(m._id === userId || m._id?.toString() === userId) ? "(You)" : ""}
                        {team.leader?._id === m._id || team.leader?._id?.toString() === m._id ? " (Leader)" : ""}
                    </span>
                ))}
                {Array.from({ length: team.targetSize - team.members.length }).map((_, i) => (
                    <span key={`empty-${i}`} style={{ background: "#f0f0f0", border: "1px dashed #aaa", padding: "4px 10px", borderRadius: "12px", fontSize: "0.85rem", color: "#aaa" }}>Waiting...</span>
                ))}
            </div>

            {team.status === 'forming' && (
                <div style={{ background: "#e9ecef", borderRadius: "6px", padding: "12px" }}>
                    <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "0.9rem" }}>Share with teammates:</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "1.3rem", fontWeight: "bold", letterSpacing: "0.15em", background: "white", padding: "4px 10px", borderRadius: "4px" }}>{team.inviteCode}</span>
                        <button onClick={() => copyCode(team.inviteCode)} style={{ padding: "5px 12px", background: copied ? "#28a745" : "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>{copied ? "Copied!" : "Copy Code"}</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input readOnly value={inviteLink} style={{ flex: 1, padding: "6px", fontSize: "0.8rem", border: "1px solid #ccc", borderRadius: "4px" }} />
                        <button onClick={() => copyCode(inviteLink)} style={{ padding: "5px 12px", background: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>Copy Link</button>
                    </div>

                    {/* Specific Email Invite */}
                    {isLeader && (
                        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                            <p style={{ margin: "0 0 8px", fontWeight: "bold", fontSize: "0.85rem" }}>Invite specific member:</p>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                    type="email"
                                    placeholder="participant email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    style={{ flex: 1, padding: "5px 8px", fontSize: "0.78rem", border: "1px solid #ccc", borderRadius: "4px", background: "white" }}
                                />
                                <button onClick={handleInviteAction} style={{ padding: "5px 12px", background: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                                    Send Invite
                                </button>
                            </div>
                            {inviteMsg && (
                                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: inviteMsg.type === 'error' ? 'red' : 'green' }}>
                                    {inviteMsg.text}
                                </p>
                            )}

                            {/* Tracking Pending Invites */}
                            {team.invites && team.invites.length > 0 && (
                                <div style={{ marginTop: "10px" }}>
                                    <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "#555" }}>Track Invites:</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        {team.invites.map((inv, idx) => (
                                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", background: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", border: "1px solid #ddd" }}>
                                                <span>{inv.email}</span>
                                                <span style={{ color: inv.status === 'joined' ? '#28a745' : '#856404', fontWeight: "bold", textTransform: "capitalize" }}>
                                                    {inv.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EventDetailsPage;
import { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const OrganizerPublicPage = () => {
    const { id } = useParams();
    const { authTokens, user } = useContext(AuthContext);
    const [organizer, setOrganizer] = useState(null);
    const [events, setEvents] = useState([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const orgs = await fetch(`http://localhost:5000/api/users/organizers/${id}`);
                const orgData = await orgs.json();
                setOrganizer(orgData);

                const evRes = await fetch(`http://localhost:5000/api/events?organizerId=${id}`);
                const eventData = await evRes.json();
                setEvents(eventData);

                // Check if current participant follows this organizer
                if (authTokens && user?.role === "participant") {
                    const profileRes = await fetch("http://localhost:5000/api/users/profile", {
                        headers: { "x-auth-token": authTokens.token }
                    });
                    const profileData = await profileRes.json();
                    const followingIds = (profileData.following || []).map(fid => fid.toString());
                    setIsFollowing(followingIds.includes(id));
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, [id, authTokens, user]);

    const toggleFollow = async () => {
        if (!authTokens) return;
        setFollowLoading(true);
        try {
            // Get current following list
            const profileRes = await fetch("http://localhost:5000/api/users/profile", {
                headers: { "x-auth-token": authTokens.token }
            });
            const profileData = await profileRes.json();
            const followingIds = (profileData.following || []).map(fid => fid.toString());

            const newFollowing = isFollowing
                ? followingIds.filter(fid => fid !== id)
                : [...followingIds, id];

            const res = await fetch("http://localhost:5000/api/users/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-auth-token": authTokens.token },
                body: JSON.stringify({ following: newFollowing })
            });
            if (res.ok) setIsFollowing(!isFollowing);
        } catch (err) {
            console.error("Error updating follow status");
        } finally {
            setFollowLoading(false);
        }
    };

    if (!organizer) return <div style={{ padding: "20px" }}>Loading...</div>;

    const now = new Date();
    const upcoming = events.filter(e => new Date(e.startDate) > now);
    const ongoing  = events.filter(e => new Date(e.startDate) <= now && new Date(e.endDate) >= now);
    const past     = events.filter(e => new Date(e.endDate) < now);

    return (
        <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto" }}>
            {/* Organizer header card */}
            <div style={{ background: "#f4f4f4", padding: "30px", borderRadius: "8px", marginBottom: "30px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                        <h1 style={{ margin: "0 0 8px 0" }}>{organizer.organizerName}</h1>
                        {organizer.organizerCategory && (
                            <span style={{
                                display: "inline-block", padding: "3px 12px", borderRadius: "12px",
                                background: "#dee2e6", fontSize: "0.85rem", fontWeight: "bold", color: "#495057", marginBottom: "12px"
                            }}>
                                {organizer.organizerCategory}
                            </span>
                        )}
                    </div>
                    {user?.role === "participant" && (
                        <button
                            onClick={toggleFollow}
                            disabled={followLoading}
                            style={{
                                padding: "10px 20px", border: "none", borderRadius: "5px", cursor: "pointer",
                                background: isFollowing ? "#6c757d" : "#007bff",
                                color: "white", fontWeight: "bold", fontSize: "0.95rem",
                                opacity: followLoading ? 0.7 : 1
                            }}
                        >
                            {followLoading ? "..." : (isFollowing ? "Unfollow" : "Follow")}
                        </button>
                    )}
                </div>
                <p style={{ margin: "0 0 6px 0", color: "#333" }}>{organizer.description}</p>
                {organizer.contactEmail && (
                    <p style={{ margin: "8px 0 0 0", fontSize: "0.9rem", color: "#555" }}>
                        <strong>Contact:</strong>{" "}
                        <a href={`mailto:${organizer.contactEmail}`} style={{ color: "#007bff" }}>
                            {organizer.contactEmail}
                        </a>
                    </p>
                )}
            </div>

            {/* Ongoing Events */}
            <h2>Ongoing Events</h2>
            {ongoing.length === 0
                ? <p style={{ color: "gray" }}>No ongoing events.</p>
                : <div style={gridStyle}>
                    {ongoing.map(event => <EventCard key={event._id} event={event} badge="Ongoing" badgeColor="#28a745" />)}
                  </div>
            }

            {/* Upcoming Events */}
            <h2>Upcoming Events</h2>
            {upcoming.length === 0
                ? <p style={{ color: "gray" }}>No upcoming events.</p>
                : <div style={gridStyle}>
                    {upcoming.map(event => <EventCard key={event._id} event={event} badge="Upcoming" badgeColor="#007bff" />)}
                  </div>
            }

            {/* Past Events */}
            <h2>Past Events</h2>
            {past.length === 0
                ? <p style={{ color: "gray" }}>No past events.</p>
                : <div style={gridStyle}>
                    {past.map(event => <EventCard key={event._id} event={event} badge="Past" badgeColor="#6c757d" />)}
                  </div>
            }
        </div>
    );
};

const EventCard = ({ event, badge, badgeColor }) => (
    <div style={{border: "1px solid #ddd", padding: "15px", borderRadius: "8px", background: "white"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px"}}>
            <h3 style={{margin: "0"}}>{event.name}</h3>
            <span style={{ background: badgeColor, color: "white", padding: "3px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold"}}>
                {badge}
            </span>
        </div>
        <p style={{margin: "5px 0"}}><strong>Starts:</strong> {new Date(event.startDate).toLocaleString()}</p>
        <p style={{margin: "5px 0"}}><strong>Ends:</strong> {new Date(event.endDate).toLocaleString()}</p> 
        <div style={{marginTop: "15px"}}>
            <Link to={`/event/${event._id}`}>
                <button style={{width: "100%", padding: "8px", cursor: "pointer", background: "#f8f9fa", border: "1px solid #ccc", borderRadius: "4px"}}>
                    View Event
                </button>
            </Link>
        </div>
    </div>
);
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px"};
export default OrganizerPublicPage;
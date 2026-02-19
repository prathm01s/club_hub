import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
const OrganizerPublicPage = () => {
    const { id } = useParams();
    const [organizer, setOrganizer] = useState(null);
    const [events, setEvents] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const orgs = await fetch(`http://localhost:5000/api/users/organizers/${id}`);
                const orgData = await orgs.json();
                setOrganizer(orgData);
                const events = await fetch(`http://localhost:5000/api/events?organizerId=${id}`);
                const eventData = await events.json();
                setEvents(eventData);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, [id]);
    if (!organizer) return <div>Loading...</div>;

    const now = new Date();
    const upcoming = events.filter(e => new Date(e.startDate) > now);
    const ongoing = events.filter(e => new Date(e.startDate) <= now && new Date(e.endDate) >= now);
    const past = events.filter(e => new Date(e.endDate) < now);

    return (
        <div style={{padding: "20px", maxWidth: "1000px", margin: "auto"}}>
            <div style={{background: "#f4f4f4", padding: "30px", borderRadius: "8px", marginBottom: "30px"}}>
                <h1>{organizer.organizerName}</h1>
                <p><strong>Category:</strong>{organizer.organizerCategory}</p>
                <p><strong>Contact:</strong>{organizer.contactEmail}</p>
                <p>{organizer.description}</p>
            </div>
            <h2>Ongoing Events</h2>
            {
                ongoing.length === 0 ? <p style={{color: "grary"}}>No ongoing events.</p> : (
                    <div style={gridStyle}>
                        {ongoing.map(event => <EventCard key={event._id} event={event} badge="Ongoing" badgeColor="#28a745"/>)}
                    </div>
                )
            }
            <h2>Upcoming Events</h2>
            {
                upcoming.length === 0 ? <p style={{color: "grary"}}>No upcoming events.</p> : (
                    <div style={gridStyle}>
                        {upcoming.map(event => <EventCard key={event._id} event={event} badge="Ongoing" badgeColor="#007bff"/>)}
                    </div>
                )
            }
            <h2>Past Events</h2>
            {
                past.length === 0 ? <p style={{color: "grary"}}>No past events.</p> : (
                    <div style={gridStyle}>
                        {past.map(event => <EventCard key={event._id} event={event} badge="Ongoing" badgeColor="#007bff"/>)}
                    </div>
                )
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
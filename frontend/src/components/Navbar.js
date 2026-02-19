import {useContext} from "react";
import {Link} from "react-router-dom";
import AuthContext from "../context/AuthContext";
const Navbar = () => {
    const { user, logoutUser} = useContext(AuthContext);
    return (
        <nav style={{ background: "#333", padding: "10px", color: "white", display: "flex", justifyContent: "space-between" }}>
            <div>
                <strong style={{ fontSize: "1.2rem" }}>EventManager</strong>
            </div>
            
            <div>
                {user ? (
                    <>
                        {/* ADMIN LINKS */}
                        {user.role === 'admin' && (
                            <>
                                <Link to="/admin-dashboard" style={linkStyle}>Manage Clubs</Link>
                                <Link to="/admin-password-resets" style={linkStyle}>Password Resets</Link>
                            </>
                        )}
                        {/* ORGANIZER LINKS (Section 10.1) */}
                        {user.role === 'organizer' && (
                            <>
                                <Link to="/organizer-dashboard" style={linkStyle}>Dashboard</Link>
                                <Link to="/organizer-dashboard?tab=ongoing" style={linkStyle}>Ongoing Events</Link>
                                <Link to="/create-event" style={linkStyle}>Create Event</Link>
                                <Link to="/organizer-profile" style={linkStyle}>Profile</Link>
                            </>
                        )}

                        {/* PARTICIPANT LINKS (Section 9.1) */}
                        {user.role === 'participant' && (
                            <>
                                <Link to="/dashboard" style={linkStyle}>My Events</Link>
                                <Link to="/browse-events" style={linkStyle}>Browse Events</Link>
                                <Link to="/organizers" style={linkStyle}>Clubs</Link>
                                <Link to="/profile" style={linkStyle}>Profile</Link>
                            </>
                        )}

                        {/* COMMON LOGOUT */}
                        <button onClick={logoutUser} style={{ marginLeft: "20px", cursor: "pointer" }}>Logout</button>
                    </>
                ) : (
                    <>
                        <Link to="/login" style={linkStyle}>Login</Link>
                        <Link to="/register" style={linkStyle}>Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
};
const linkStyle = { color: "white", textDecoration: "none", marginRight: "15px" };
export default Navbar;
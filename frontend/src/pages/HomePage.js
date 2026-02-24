import { Link } from "react-router-dom";

const HomePage = () => {
    return (
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "#f7f9fc" }}>
            <div style={{ width: "100%", maxWidth: "680px", background: "white", borderRadius: "10px", padding: "28px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", textAlign: "center" }}>
                <h1 style={{ margin: "0 0 10px 0", fontSize: "1.9rem" }}>Felicity Event Manager</h1>
                <p style={{ margin: "0 0 22px 0", color: "#555", lineHeight: "1.6" }}>
                    Discover events, build teams, and track registrations from one place.
                </p>

                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                    <Link to="/login">
                        <button style={{ padding: "10px 18px", background: "#007bff", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                            Login
                        </button>
                    </Link>
                    <Link to="/register">
                        <button style={{ padding: "10px 18px", background: "#f1f3f5", color: "#222", border: "1px solid #ced4da", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                            Register
                        </button>
                    </Link>
                    <Link to="/browse-events">
                        <button style={{ padding: "10px 18px", background: "#28a745", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                            Browse Events
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePage;

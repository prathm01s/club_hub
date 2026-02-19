import { useEffect, useState, useContext } from "react";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";

const OrganizersListPage = () => {
    const { authTokens } = useContext(AuthContext);
    const [organizers, setOrganizers] = useState([]);
    const [following, setFollowing] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Get all organizers
            const orgRes = await fetch("http://localhost:5000/api/users/organizers");
            const orgData = await orgRes.json();
            setOrganizers(orgData);

            // 2. Get current user's following list
            const profileRes = await fetch("http://localhost:5000/api/users/profile", {
                headers: { "x-auth-token": authTokens.token }
            });
            const profileData = await profileRes.json();
            setFollowing(profileData.following || []);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleFollow = async (organizerId) => {
        let newFollowing;
        if (following.includes(organizerId)) {
            newFollowing = following.filter(id => id !== organizerId); // Unfollow
        } else {
            newFollowing = [...following, organizerId]; // Follow
        }

        try {
            const response = await fetch("http://localhost:5000/api/users/preferences", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": authTokens.token
                },
                body: JSON.stringify({ following: newFollowing })
            });

            if (response.ok) {
                setFollowing(newFollowing); // Update UI instantly
            }
        } catch (err) {
            alert("Error updating follow status");
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "1000px", margin: "auto" }}>
            <h1>Clubs & Organizers</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                {organizers.map(org => (
                    <div key={org._id} style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "8px" }}>
                        <h3>{org.organizerName}</h3>
                        <p style={{ color: "gray" }}>{org.organizerCategory}</p>
                        <p>{org.description}</p>
                        
                        <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                            <Link to={`/organizer/${org._id}`}>
                                <button style={{ padding: "8px 15px", cursor: "pointer" }}>View Details</button>
                            </Link>
                            
                            <button 
                                onClick={() => toggleFollow(org._id)}
                                style={{ 
                                    padding: "8px 15px", 
                                    cursor: "pointer",
                                    background: following.includes(org._id) ? "#6c757d" : "#007bff",
                                    color: "white", border: "none"
                                }}
                            >
                                {following.includes(org._id) ? "Unfollow" : "Follow"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrganizersListPage;
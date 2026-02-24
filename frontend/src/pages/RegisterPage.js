import { useState } from "react";
import { useNavigate } from "react-router-dom";

const RegisterPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: "", lastName: "", email: "", password: "", contactNumber: "", collegeName: ""
    });
    const [error, setError] = useState("");

    const onChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

    // Helper to check if they are typing an IIIT email right now
    const isIIITEmail = formData.email.includes("iiit.ac.in");

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (response.ok) {
                alert("Registration Successful! Please login.");
                navigate("/login");
            } else {
                setError(data.msg || "Registration Failed");
            }
        } catch (err) {
            setError("Server Error");
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "auto", padding: "20px" }}>
            <h2>Participant Registration</h2>
            {error && <p style={{color : "red"}}>{error}</p>}
            
            <form onSubmit={onSubmit}>
                <input type="text" name="firstName" placeholder="First Name" onChange={onChange} required style={inputStyle}/><br/>
                <input type="text" name="lastName" placeholder="Last Name" onChange={onChange} required style={inputStyle}/><br/>
                
                <input type="email" name="email" placeholder="Email (Use IIIT email for IIIT access)" onChange={onChange} required style={inputStyle}/><br/>
                <small style={{ color: isIIITEmail ? "green" : "gray" }}>
                    {isIIITEmail ? "✓ IIIT Institute Email Detected" : "Auto-detects IIIT status based on domain"}
                </small><br/><br/>
                
                <input type="password" name="password" placeholder="Password" onChange={onChange} required style={inputStyle}/><br/>
                <input type="number" name="contactNumber" placeholder="Contact Number" onChange={onChange} required style={inputStyle}/><br/>
                
                {/* Only ask for College Name if it's NOT an IIIT email */}
                {!isIIITEmail && (
                    <input type="text" name="collegeName" placeholder="College Name" onChange={onChange} required style={inputStyle}/>
                )}
                <br/>
                
                <button type="submit" style={{ padding: "10px", width: "100%", cursor: "pointer" }}>Register</button>
            </form>
            <p>Already have an account? <a href="/login">Login</a></p>
        </div>
    );
};

const inputStyle = { width: "100%", padding: "8px", marginBottom: "10px", boxSizing: "border-box" };

export default RegisterPage;
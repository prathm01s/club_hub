import { useContext } from "react";
import { Link } from "react-router-dom";
import AuthContext from "../context/AuthContext";
const LoginPage = () => {
    let { loginUser } = useContext(AuthContext);
    return (
        <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "#f7f9fc" }}>
            <form onSubmit={loginUser} style={{ width: "100%", maxWidth: "380px", background: "white", padding: "24px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
                <h2 style={{ margin: "0 0 16px 0" }}>Login</h2>
                <p style={{ margin: "0 0 18px 0", color: "#666" }}>Enter your account details to continue.</p>

                <label style={labelStyle}>Email</label>
                <input type="email" name="email" placeholder="Enter Email" required style={inputStyle}/>

                <label style={labelStyle}>Password</label>
                <input type="password" name="password" placeholder="Enter Password" required style={inputStyle}/>

                <button type="submit" style={buttonStyle}>Sign In</button>

                <p style={{ marginTop: "14px", fontSize: "0.92rem" }}>
                    New user? <Link to="/register">Create an account</Link>
                </p>
            </form>
        </div>
    );
};

const labelStyle = { display: "block", fontSize: "0.9rem", marginBottom: "6px", color: "#333" };
const inputStyle = { width: "100%", padding: "10px", marginBottom: "12px", borderRadius: "6px", border: "1px solid #ced4da", boxSizing: "border-box" };
const buttonStyle = { width: "100%", padding: "10px", border: "none", borderRadius: "6px", background: "#007bff", color: "white", fontWeight: "bold", cursor: "pointer" };

export default LoginPage;

import { createContext, useState } from "react";
import { jwtDecode } from "jwt-decode"; // Correct import for version 4.x
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();
export default AuthContext;

export const AuthProvider = ({ children }) => {
    let [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem("authTokens") ? JSON.parse(localStorage.getItem("authTokens")) : null
    );

    let [user, setUser] = useState(() => {
        const storedTokens = localStorage.getItem("authTokens");
        return storedTokens ? jwtDecode(JSON.parse(storedTokens).token).user : null
    });

    const navigate = useNavigate();
    let loginUser = async (e) => {
        e.preventDefault();
        const response = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: e.target.email.value,
                password: e.target.password.value
            })
        });
        const data = await response.json();
        // Inside loginUser in AuthContext.js
        if (response.status === 200) {
            setAuthTokens(data);
            const decodedUser = jwtDecode(data.token);
            setUser(decodedUser.user);
            localStorage.setItem("authTokens", JSON.stringify(data));

            if (decodedUser.user.role === 'admin') {
                navigate("/admin-dashboard");
            } else if (decodedUser.user.role === 'organizer') {
                navigate("/organizer-dashboard");
            } else if (decodedUser.user.role === 'participant' && !decodedUser.user.onboardingComplete) {
                navigate("/onboarding");
            } else {
                navigate("/dashboard"); // Participant (onboarding done)
            }
        } else {
            alert("Something went wrong: " + data.msg);
        }
    };
    let logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem("authTokens");
        navigate("/login");
    }
    let contextData = {
        user: user,
        authTokens: authTokens,
        loginUser: loginUser,
        logoutUser: logoutUser
    };
    return (
        <AuthContext.Provider value={contextData}>
            {children}
        </AuthContext.Provider>
    );
};
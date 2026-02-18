import { Navigate, Outlet } from "react-router-dom";
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

// We now accept an array of allowed roles (e.g., ['organizer', 'admin'])
const PrivateRoute = ({ allowedRoles }) => {
    let { user } = useContext(AuthContext);

    // 1. If not logged in at all, kick to login
    if (!user) {
        return <Navigate to="/login" />;
    }

    // 2. If the route specifies required roles, and the user's role isn't in that list, kick them out
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Kick them to their proper dashboard instead of letting them stay
        if (user.role === 'organizer') return <Navigate to="/organizer-dashboard" />;
        if (user.role === 'participant') return <Navigate to="/dashboard" />;
        if (user.role === 'admin') return <Navigate to="/admin-dashboard" />;
    }

    // 3. User is logged in AND has the right role. Let them pass.
    return <Outlet />;
};

export default PrivateRoute;
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./utils/PrivateRoute";
import Navbar from "./components/Navbar";
// Pages
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import BrowseEventsPage from "./pages/BrowseEventsPage";
import CreateEventPage from "./pages/CreateEventPage";
import EventDetailsPage from "./pages/EventDetailsPage";
import ProfilePage from "./pages/ProfilePage";
import OrganizersListingPage from "./pages/OrganizersListingPage";
import OrganizerPublicPage from "./pages/OrganizerPublicPage";
import OrganizerEventDetailPage from "./pages/OrganizerEventDetailPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import AdminPasswordResetPage from "./pages/AdminPasswordResetPage";
import EditEventPage from "./pages/EditEventPage";
import OrganizerProfilePage from "./pages/OrganizerProfilePage";
import TeamChatPage from "./pages/TeamChatPage";
import OnboardingPage from "./pages/OnboardingPage";
function App() {
    return (
        <div className="App">
            <Router>
                <AuthProvider>
                    <Navbar /> {/* <--- Navbar is visible on all pages */}
                    <Routes>
                        {/* PUBLIC ROUTES */}
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/event/:id" element={<EventDetailsPage />} />
                        <Route path="/browse-events" element={<BrowseEventsPage />} />
                        <Route path="/organizers" element={<OrganizersListingPage />} />
                        <Route path="/organizer/:id" element={<OrganizerPublicPage />} />
                        {/* PARTICIPANT ONLY ROUTES */}
                        <Route element={<PrivateRoute allowedRoles={['participant']} />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/team/:teamId/chat" element={<TeamChatPage />} />
                            <Route path="/onboarding" element={<OnboardingPage />} />
                        </Route>

                        {/* ORGANIZER ONLY ROUTES */}
                        <Route element={<PrivateRoute allowedRoles={['organizer']} />}>
                            <Route path="/organizer-dashboard" element={<OrganizerDashboard />} />
                            <Route path="/create-event" element={<CreateEventPage />} />
                            <Route path="/organizer/event/:id" element={<OrganizerEventDetailPage />} />
                            <Route path="/organizer/edit-event/:id" element={<EditEventPage />} />
                            <Route path="/organizer-profile" element={<OrganizerProfilePage />} />
                        </Route>
                        {/* ADMIN ONLY ROUTES */}
                        <Route element={<PrivateRoute allowedRoles={['admin']} />}>
                            <Route path="/admin" element={<AdminOverviewPage />} />
                            <Route path="/admin-dashboard" element={<AdminDashboard />} />
                            <Route path="/admin-password-resets" element={<AdminPasswordResetPage />} />
                        </Route>
                        {/* Default redirect to login */}
                        <Route path="*" element={<HomePage />} />
                    </Routes>
                </AuthProvider>
            </Router>
        </div>
    );
}
export default App;
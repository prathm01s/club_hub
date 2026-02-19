import { BrowserRouter as Router, Routes, Route} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./utils/PrivateRoute";
import Navbar from "./components/Navbar";
// Pages
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
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
import EditEventPage from "./pages/EditEventPage";
import OrganizerProfilePage from "./pages/OrganizerProfilePage";
function App() {
    return (
        <div className="App">
            <Router>
                <AuthProvider>
                    <Navbar/> {/* <--- Navbar is visible on all pages */}
                    <Routes>
                        {/* PUBLIC ROUTES */}
                        <Route path="/login" element={<LoginPage/>}/>
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/event/:id" element={<EventDetailsPage />} />
                        {/* PARTICIPANT ONLY ROUTES */}
                        <Route element={<PrivateRoute allowedRoles={['participant']} />}>
                            <Route path="/dashboard" element={<Dashboard/>}/>
                            <Route path="/browse-events" element={<BrowseEventsPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/organizers" element={<OrganizersListingPage />} />
                            <Route path="/organizer/:id" element={<OrganizerPublicPage />} />
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
                            <Route path="/admin-dashboard" element={<AdminDashboard />} />
                        </Route>
                        {/* Default redirect to login */}
                        <Route path="*" element={<LoginPage />} />
                    </Routes>
                </AuthProvider>
            </Router>
        </div>
    );
}
export default App;
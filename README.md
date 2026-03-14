# Club Hub: Event Management System

A comprehensive, full-stack Event Management platform tailored for university/college ecosystems. Built with the **MERN** stack (MongoDB, Express, React, Node.js) and featuring real-time capabilities via **Socket.IO**. 

This platform connects **Organizers** (like college clubs), **Participants** (students/attendees), and **Administrators** in a unified environment for seamless event creation, ticketing, attendance tracking, and team collaboration.

---

## 🚀 Elaborate Feature Breakdown

### 🏢 1. Granular Role-Based Access Control (RBAC)
The application strictly enforces security authorization at both the UI (React Router) and API (Express Middleware) levels.
- **Admin:** The master overseer. Approves or rejects self-registered Organizer accounts to prevent spam. Has the authority to suspend active clubs and handles manual password reset requests for users who lose access.
- **Organizer (Clubs):** Focuses entirely on event logistics. Organizers operate from a dedicated dashboard to draft events, configure dynamic registration forms, monitor real-time ticket sales/stock, execute CSV attendance exports, and visually track revenue pipelines.
- **Participant:** The consumer portal. Participants utilize a tailored discovery feed (driven by a recommendation algorithm), manage their digital ticket wallets, join Hackathon-style teams, and communicate in isolated real-time WebSocket chat rooms.

### 📅 2. Advanced Event Management & Logistics
Events are not just static pages; they represent complex state machines.
- **Versatile Event Types:** Supports three distinct modes:
  - *Standard:* Basic registration with seat limits.
  - *Team:* Hackathons/competitions where users generate unique invite codes to build rosters before an event starts.
  - *Merchandise:* E-commerce style handling where stock decrement is handled atomically upon purchase instead of tracking 'seats'.
- **Dynamic Custom Forms:** Organizers are not locked into standard "Name/Email" fields. They can dynamically inject requireable fields (e.g., "GitHub URL", "Dietary Restrictions", "T-Shirt Size") into the Event schema. During registration, the backend strictly validates that all custom required fields are answered.
- **Smart Status Automation (Cron Alternative):** Events transition through specific lifecycle phases: *Draft* ➡️ *Upcoming* ➡️ *Ongoing* ➡️ *Completed*. Instead of relying on manual toggles or heavy cron jobs, a lightweight hook syncs event statuses dynamically based on the current UTC timestamp compared to the event's `startDate` and `endDate` whenever events are queried.

### 🎟️ 3. Ticketing, QR Codes, and Access Control
- **Automated Digital Tickets:** Upon successful registration validation (checking stock levels, deadline limits, and IIIT-exclusivity), the backend instantly fires an asynchronous email via `nodemailer`.
- **QR Payload Encryption:** The unique `ticketId` generated via UUID is embedded into a JSON payload with vital event metrics and serialized into a Base64 PNG QR code using the `qrcode` library. This is embedded directly inline into the user's email template via CID.
- **Organizer Scanner Flow:** Organizers utilize a React-based mobile-responsive scanner UI at the venue gates. Scanning a participant's QR code triggers a `PUT` request that idempotently converts the registration status from `Registered` to `Attended`, completely eliminating paper lists.

### 💬 4. Real-Time Team Collaboration (WebSockets)
The platform natively handles internal chat for team-based competitions without requiring Discord or Slack.
- **Socket.IO Sub-Rooms:** When a user opens their Team Dashboard, an Engine.IO handshake upgrades the connection to WebSockets. The server automatically verifies their JWT and places them into an isolated `team_<teamId>` socket room.
- **Live Presence & Typing Indicators:** Participants instantly see who is currently logged into the team room via a real-time presence array. Specific socket broadcasts orchestrate visual "User is typing..." indicators.
- **Rich Media Sharing:** The chat isn't just text. Users can upload image/file assets securely through the backend configuration, which are immediately broadcasted and rendered inline within the team channel.

### 📊 5. Analytics, Search, and Recommendations
- **Aggregation Pipelines:** The Organizer Dashboard bypasses N+1 query problems by using MongoDB `$aggregate` pipelines to simultaneously join events, compute ticket sums, calculate dynamic revenue (based on non-cancelled ticket quantities × dynamic fee structs), and measure attendance ratios.
- **Fuzzy Search & Trends:** The public event discovery page implements highly-optimized MongoDB `$regex` indexing to allow fuzzy searching across Event titles and Organizer names simultaneously.
- **Trending Engine:** The backend determines "Top 5 Trending Events" on the fly by querying the `Registrations` collection for interactions strictly within the last 24 hours (`Date.now() - 24h`) and grouping the velocity metrics.
- **Personalized Feed:** Logged-in participants receive an algorithmically sorted event feed where a scoring engine boosts events if the user currently "Follows" the host club or if the event tags intersect with the user's profile interests.

### 🤖 6. Discord Webhook Integration
- **Zero-Touch Announcements:** Organizers can configure a Discord Webhook URL within their profile settings. When an event transitions from a *Draft* state to *Published/Upcoming*, the Node.js backend uses `axios` to fire a rich-text HTTP POST event to Discord, automating social media announcements.

---

## 🛠️ Technology Stack

**Frontend (Client):**
- React.js (Hooks, Context API)
- React Router DOM
- Axios (HTTP client for REST)
- Tailwind CSS (Rapid Utility Styling)
- Chart.js (Interactive Analytics rendering)

**Backend (API Server):**
- Node.js & Express.js
- MongoDB & Mongoose (ODM)
- Socket.IO (Real-time bi-directional Websockets)
- JSON Web Tokens (JWT) & bcryptjs (Stateless Authentication & Cryptography)
- Nodemailer (SMTP Email transactions)
- Node-QRCode (Base64 Ticket generation)

---

## ⚙️ Local Setup & Installation

Follow these instructions exactly to get the full stack running on your local machine.

### Prerequisites
1. **Node.js** (v18 or higher recommended)
2. **MongoDB** (Local instance installed, or a free MongoDB Atlas URI)
3. **Gmail Account** (You must generate an App Password in your Google Account Security Settings to allow Nodemailer to send tickets)

### 1. Clone the Repository
```bash
git clone <repository_url>
cd <repository_name>
```

### 2. Backend Setup
Open your terminal and navigate to the backend folder to install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file at the root of the `backend/` directory and populate it:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=your_super_secret_jwt_key
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
```

Start the backend development server (uses `nodemon` for hot-reloading):
```bash
npm run dev
```
> **Note:** The backend should now output `Server running on port 5000`. Keep this terminal window open.

### 3. Frontend Setup
Open a **new** terminal window and navigate to the frontend folder:
```bash
cd frontend
npm install
```

Create a `.env` file at the root of the `frontend/` directory and point it to your backend:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

Start the React development server:
```bash
npm start
```
> **Note:** Your default browser will automatically open and navigate to `http://localhost:3000`.

---

## 📁 Core Architecture & Directory Layout

```text
├── backend/
│   ├── config/          # Database connection, Seeding scripts, Nodemailer logic
│   ├── middleware/      # JWT authorization and Role-based Gatekeepers
│   ├── models/          # Complex Mongoose Schemas (User, Event, Registration, Chat, Team)
│   ├── routes/          # Express REST API Endpoints segregated by resource
│   └── server.js        # Application Entry point, Express configs, and Socket.IO hooks
│
└── frontend/
    ├── src/
    │   ├── components/  # Reusable UI widgets (Navbar, Forms, Modals, Cards)
    │   ├── context/     # React Context providers (Global AuthContext state)
    │   ├── pages/       # Distinct Page Views mapped to React Router paths
    │   └── App.js       # Main Routing switch and Component tree root
```

---

## 🔐 Security Considerations
- **Password Hashing:** All user passwords are mathematically hashed with salting via `bcryptjs` before persisting to the MongoDB document structure.
- **Stateless Verification:** Route protection relies entirely on cryptographically signed JSON Web Tokens (JWT) verified strictly server-side.
- **Sanitization:** Input sanitization is explicitly applied to WebSocket broadcast payloads in `server.js` to strip HTML tags, preventing Cross-Site Scripting (XSS) from malicious chat payloads.

---

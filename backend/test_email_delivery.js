require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { // using default for project
});

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
    try {
        console.log("=== Testing Ticket Email Dispatch ===");
        const TARGET_EMAIL = "palakmishra0211@gmail.com";

        // 1. Try to register the user, or login if already exists
        let userTokens;
        console.log(`1. Registering user ${TARGET_EMAIL}...`);
        let res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: 'Prathmesh',
                lastName: 'Sharma',
                email: TARGET_EMAIL,
                password: 'password123',
                role: 'participant',
                contactNumber: '1234567890',
                collegeName: 'IIIT'
            })
        });

        if (res.ok) {
            console.log("   User registered successfully. Logging in to get token...");
            res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: TARGET_EMAIL, password: 'password123' })
            });
            userTokens = await res.json();
        } else {
            const errData = await res.json();
            console.log("   Registration failed (maybe already exists):", errData.msg);
            console.log("   Attempting to login instead...");
            res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: TARGET_EMAIL, password: 'password123' })
            });
            if (res.ok) {
                userTokens = await res.json();
                console.log("   User logged in successfully.");
            } else {
                console.error("   Failed to login as well. Cannot proceed.");
                return;
            }
        }

        // 2. Create an Organizer and an Event
        console.log("2. Creating an Organizer to host an Event...");
        let openEvent;
        const orgEmail = `org_${Date.now()}@gmail.com`;
        await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Org', lastName: 'O', email: orgEmail, password: 'password123', role: 'organizer', contactNumber: '1234567890', collegeName: 'Test' })
        });

        await User.updateOne({ email: orgEmail }, { role: 'organizer' });

        const orgLoginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: orgEmail, password: 'password123' })
        });
        const orgTokens = await orgLoginRes.json();

        console.log("   Creating Event...");
        const eventRes = await fetch(`${BASE_URL}/events`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': orgTokens.token },
            body: JSON.stringify({
                name: "Email Test Event v2", description: "Testing email", category: "Technology", eventType: "normal",
                startDate: new Date(Date.now() + 8640000).toISOString(),
                endDate: new Date(Date.now() + 17280000).toISOString(),
                registrationDeadline: new Date(Date.now() + 4320000).toISOString(),
                registrationLimit: 100,
                eligibility: 'all',
                status: 'published'
            })
        });
        if (!eventRes.ok) {
            console.error("   Event creation failed:", await eventRes.json());
            return;
        }
        openEvent = await eventRes.json();
        console.log(`   Created new Event: ${openEvent.name} (${openEvent._id})`);

        // 3. Register for Event (This triggers the email)
        console.log(`3. Registering ${TARGET_EMAIL} for the event... (Attempting to trigger email)`);
        res = await fetch(`${BASE_URL}/registrations/${openEvent._id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': userTokens.token },
            body: JSON.stringify({ responses: {} })
        });

        if (res.ok) {
            const reg = await res.json();
            console.log(`   Registration Successful! Ticket ID: ${reg.ticketId}`);
            console.log("   An email should have been sent to", TARGET_EMAIL);
        } else {
            const errData = await res.json();
            console.log("   Registration failed (maybe already registered):", errData.msg);
        }

        console.log("=== Test Script Completed ===");
    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        mongoose.connection.close();
    }
}

runTest();

const BASE_URL = 'http://localhost:5000/api';

async function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
    try {
        console.log("=== Testing QR Scanner & Attendance Flow ===");

        // 1. Register Organizer
        const orgEmail = `org_${Date.now()}@test.com`;
        let res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Org', lastName: 'O', email: orgEmail, password: 'password', role: 'organizer' })
        });
        const orgTokens = await res.json();
        console.log("1. Organizer registered:", orgEmail);

        // 2. Create Event
        res = await fetch(`${BASE_URL}/events`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': orgTokens.token },
            body: JSON.stringify({
                name: "Tech Meetup", description: "A great meetup", category: "Technology", eventType: "normal",
                startDate: new Date(Date.now() + 86400000).toISOString(),
                endDate: new Date(Date.now() + 172800000).toISOString(),
                registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
                registrationLimit: 100
            })
        });
        const event = await res.json();
        console.log("2. Event created:", event._id);

        // 3. Register Participant
        const parEmail = `par_${Date.now()}@test.com`;
        res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Par', lastName: 'P', email: parEmail, password: 'password', role: 'participant' })
        });
        const parTokens = await res.json();
        console.log("3. Participant registered:", parEmail);

        // 4. Register Participant to Event
        res = await fetch(`${BASE_URL}/registrations/${event._id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': parTokens.token },
            body: JSON.stringify({ responses: {} })
        });
        const reg = await res.json();
        console.log("4. Participant registered for event! Ticket ID:", reg.ticketId);

        // 5. Test Valid Scan Endpoint
        console.log("5. Organizer scanning valid ticket...");
        res = await fetch(`${BASE_URL}/registrations/scan/${reg.ticketId}`, {
            method: 'PUT', headers: { 'x-auth-token': orgTokens.token }
        });
        let scanResult = await res.json();
        if (res.ok && scanResult.msg.includes("successfully verified")) {
            console.log(" ✅ Scan SUCCESS: Marked as attended.");
        } else {
            console.error(" ❌ Scan FAILED:", scanResult);
        }

        // 6. Test Duplicate Scan Endpoint
        console.log("6. Organizer scanning SAME ticket again...");
        res = await fetch(`${BASE_URL}/registrations/scan/${reg.ticketId}`, {
            method: 'PUT', headers: { 'x-auth-token': orgTokens.token }
        });
        scanResult = await res.json();
        if (!res.ok && scanResult.msg.includes("already marked as attended")) {
            console.log(" ✅ Duplicate Scan SUCCESS: Correctly rejected duplicate scan.");
        } else {
            console.error(" ❌ Duplicate Scan FAILED (should have rejected):", scanResult);
        }

        console.log("=== All Tests Completed ===");
    } catch (err) {
        console.error("Test Error:", err);
    }
}

runTest();

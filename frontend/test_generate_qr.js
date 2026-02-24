const QRCode = require('qrcode');
const fs = require('fs');

async function main() {
    // We will generate a QR code for a dummy ticket ID
    // since we haven't created the booking yet, let's just make the QR code
    // The browser subagent will use this file. We can mock the ticketID on backend
    // Or we will just do everything via the browser subagent in e2e test fashion, and read the ticketID from the DOM!
    // Actually, maybe it's easier to programmatically create the user and registration here.

    // Instead of doing it from scratch, we'll write a script to just generate a QR code given an argument.
    const ticketId = process.argv[2] || "DUMMY123";
    await QRCode.toFile('./test_qr.png', JSON.stringify({ ticketId: ticketId }));
    console.log(`Generated test_qr.png for ticket: ${ticketId}`);
}

main();

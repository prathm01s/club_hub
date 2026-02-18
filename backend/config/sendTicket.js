const nodemailer = require("nodemailer");
const QRcode = require("qrcode");
const sendTicketEmail = async (user, event, ticketId) => {
    try {
        // 1. Generate QR Code containing Ticket ID and Event Name
        const qrData = JSON.stringify({ ticketId, eventName: event.name, userId: user._id});
        const qrImageBase64 = await QRCode.toDataURL(qrData);

        // 2. Configure the Email Sender
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Craft the Email Message
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `Ticker Confirmation: {event.name}`,
            html: `
                <h2>Registration Successful!</h2>
                <p>Hi ${user.firstName},</p>
                <p>You are confirmed for <strong>${event.name}</strong>.</p>
                <ul>
                    <li><strong>Type:</strong> ${event.eventType}</li>
                    <li><strong>Ticket ID:</strong> ${ticketId}</li>
                </ul>
                <p>Please present the attached QR code at the event.</p>
            `,
            attachments: [
                {
                    filename: 'ticket-qr.png',
                    content: qrImageBase64.split("base64,")[1], // Strip the data URL prefix
                    encoding: 'base64'
                }
            ]
        };

        // 4. Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Ticket email sent to ${user.email}`);
    } catch (err) {
        console.error("Error sending email/QR: ", err);
        // We don't throw the error here so that the main registration process doesn't crash 
        // if the email fails to send.
    }
};
module.exports = sendTicketEmail;
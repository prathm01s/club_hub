const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const sendTicketEmail = async (user, event, ticketId, quantity = 1) => {
    try {
        const organizerName = event.organizer?.organizerName ||
            `${event.organizer?.firstName || ''} ${event.organizer?.lastName || ''}`.trim() ||
            'EventManager';

        const qrPayload = JSON.stringify({
            ticketId,
            eventName: event.name,
            eventDate: event.startDate,
            eventType: event.eventType,
            participantName: `${user.firstName} ${user.lastName}`,
            participantEmail: user.email,
            userId: user._id
        });
        const qrImageBase64 = await QRCode.toDataURL(qrPayload);
        const qrBase64Data = qrImageBase64.split('base64,')[1];

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const isMerch = event.eventType === 'merchandise';
        const typeLabel = isMerch ? 'Purchase' : 'Registration';
        const startDate = new Date(event.startDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        const eventTypeName = event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1);

        let feeLine = '';
        if (event.fee && event.fee > 0) {
            const amt = isMerch ? event.fee + ' x ' + quantity + ' = Rs.' + (event.fee * quantity) : 'Rs.' + event.fee;
            feeLine = '<tr><td style="padding:8px 0;color:#666;">Fee</td><td style="padding:8px 0;">' + amt + '</td></tr>';
        }

        const mailOptions = {
            from: `"EventManager" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `${typeLabel} Confirmed - ${event.name}`,
            html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#4f46e5;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">${typeLabel} Confirmed</h2>
        <p style="margin:8px 0 0;opacity:0.9;">You're all set for <strong>${event.name}</strong></p>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
        <p>Hi <strong>${user.firstName}</strong>,</p>
        <p>Your ${typeLabel.toLowerCase()} has been confirmed. Here are your ticket details:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#666;width:120px;">Name</td><td style="padding:8px 0;"><strong>${user.firstName} ${user.lastName}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;">${user.email}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Event</td><td style="padding:8px 0;"><strong>${event.name}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#666;">Type</td><td style="padding:8px 0;">${eventTypeName}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Date</td><td style="padding:8px 0;">${startDate}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Organizer</td><td style="padding:8px 0;">${organizerName}</td></tr>
            ${isMerch ? '<tr><td style="padding:8px 0;color:#666;">Quantity</td><td style="padding:8px 0;">' + quantity + '</td></tr>' : ''}
            ${feeLine}
        </table>
        <div style="text-align:center;margin:24px 0;padding:20px;background:#f9fafb;border-radius:8px;border:1px dashed #d1d5db;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;">TICKET ID</p>
            <p style="margin:0 0 16px;font-family:monospace;font-size:14px;font-weight:bold;letter-spacing:1px;">${ticketId}</p>
            <img src="cid:ticketqr" alt="QR Code" style="width:180px;height:180px;" />
            <p style="margin:8px 0 0;color:#888;font-size:12px;">Present this QR code at the event</p>
        </div>
        <p style="color:#aaa;font-size:12px;">If you did not request this, please ignore this email.</p>
    </div>
    <div style="padding:12px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e5e7eb;">
        EventManager - Powered by Felicity
    </div>
</div>
            `,
            attachments: [{
                filename: `ticket-${ticketId}.png`,
                content: qrBase64Data,
                encoding: 'base64',
                cid: 'ticketqr'
            }]
        };

        await transporter.sendMail(mailOptions);
        console.log(`Ticket email sent to ${user.email}`);
    } catch (err) {
        console.error("Error sending email/QR: ", err);
    }
};
module.exports = sendTicketEmail;
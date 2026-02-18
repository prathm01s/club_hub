const User = require("../models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ role : "admin"});
        if (adminExists) {
            console.log("Admin account already exists.");
            return;
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
        const admin = new User({
            firstName: "System",
            lastName: "Admin",
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            role: "admin"
        });

        await admin.save();
        console.log("Admin account created successfully.");
    } catch (err) {
        console.error("Error seeding admin: ", err.message);
    }
}
module.exports = seedAdmin;
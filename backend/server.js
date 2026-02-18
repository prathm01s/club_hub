const express = require("express");
const connectDB = require('./config/db');
const seedAdmin = require("./config/seeder");
const cors = require('cors');
require('dotenv').config();

connectDB().then(() => {
    seedAdmin();
});
const app = express();

console.log("Attempting to connect...");
console.log("URI from .env is:", process.env.MONGODB_URI);

/*
We want to add modularity to the code AND we can use the power of async functions. Hence we create a separate file db.js to handle
database connection.

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => console.log(err));
*/

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/event'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.get('/', (req, res) => {
    res.send("API is running...");
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
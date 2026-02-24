module.exports = function (req, res, next) {
    // Check if the user role is organizer
    // Note: req.user is already there because 'auth' middleware runs first!
    if (req.user.role != "organizer") {
        return res.status(403).json({msg : "Access Denied. Organizers only."});
    }
    next();
};
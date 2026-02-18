module.exports = function (req, res, next) {
    // Check if the user role is admin
    // Note: req.user is already there because 'auth' middleware runs first!
    if (req.user.role != "admin") {
        return res.status(403).json({msg : "Access Denied. Admins only."});
    }
    next();
};
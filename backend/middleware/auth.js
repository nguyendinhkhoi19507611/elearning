const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });

        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based access control
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required: ${roles.join(', ')}` });
        }
        next();
    };
};

module.exports = { auth, authorize };

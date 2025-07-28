const JWT = require('jsonwebtoken');
require('dotenv').config();

// Use environment variables for sensitive data
const JWT_SECRET = process.env.JWT_SECRET || "Vibha@123";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

function createTokenForUser(user) {
    const payload = {
        _id: user._id,
        email: user.email,
        profileImageURL: user.profileImageURL,
        role: user.role,
        // Add issued at time
        iat: Math.floor(Date.now() / 1000)
    };

    // Add expiration and algorithm
    const token = JWT.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256'
    });
    
    return token;
}

function ValidateToken(req, res, next) {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).redirect('/user/signin');
    }
  
    try {
        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification failed:', err);
        res.clearCookie('token');
        return res.status(401).redirect('/user/signin');
    }
  }

module.exports = {
    createTokenForUser,
    ValidateToken  // Changed to lowercase for consistency
};
const jwt = require('jsonwebtoken');

function checkForAuthenticationCookie(cookieName) {
    return async (req, res, next) => {
        const tokenCookieValue = req.cookies[cookieName];
        
        if (!tokenCookieValue) {
            return next();
        }

        try {
            // Verify the token directly here
            const userPayload = jwt.verify(tokenCookieValue, process.env.JWT_SECRET);
            req.user = userPayload;
        } catch (error) {
            console.error('Token verification failed:', error);
            // Clear invalid token
            res.clearCookie(cookieName);
        }
        
        return next();
    };
}

module.exports = {
    checkForAuthenticationCookie
};
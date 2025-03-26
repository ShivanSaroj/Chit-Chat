const { Router } = require('express');
const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const flash= require('connect-flash')
const { randomBytes, createHmac } = require('crypto');
const { ValidateToken } = require('../services/authentication');
const router = Router();

router.use(flash())
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profile-images/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Signin routes
router.get('/signin', (req, res) => {
    return res.render("signin");
});
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        console.log(`Signin attempt for: ${email}`); // Debug log
        
        const token = await User.matchPasswordAndGenerateToken(email, password);
        console.log('Generated token:', token); // Debug log
        
        return res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            path: '/'
        }).redirect('/');
        
    } catch (error) {
        console.error('Signin error:', error.message); // Debug log
        return res.render('signin', {
            error: "Incorrect email or password",
            email: email // Preserve the email in the form
        });
    }
});
// Signup routes
router.get('/signup', (req, res) => {
    return res.render("signup");
});

router.post('/signup', upload.single('profileImage'), async (req, res) => {
    const { fullname, email, password } = req.body;
    
    try {
        // Handle profile image
        let profileImageURL = '/images/default-profile.png'; // Default image
        if (req.file) {
            profileImageURL = '/uploads/profile-images/' + req.file.filename;
        }

        await User.create({
            fullname,
            email,
            password,
            profileImageURL
        });

        return res.redirect('/');
    } catch (error) {
        console.error('Signup error:', error);
        
        // If there was a file uploaded but error occurred, delete it
        if (req.file) {
            const fs = require('fs');
            fs.unlinkSync(req.file.path);
        }

        return res.render('signup', {
            error: error.message || 'Registration failed. Please try again.',
            formData: req.body // To repopulate form fields
        });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    return res.clearCookie('token').redirect('/');
});

router.get('/forgot-password', async(req, res)=>{
    return res.render('forgot-password')
})
router.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.render('forgot-password', { 
                message: 'If that email exists, a reset link has been sent'
            });
        }

        // Create reset token
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send email
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            text: `You are receiving this because you requested a password reset.\n\n
                Please click on the following link to complete the process:\n\n
                http://${req.headers.host}/user/reset-password/${token}\n\n
                If you did not request this, please ignore this email.`
        };

        await transporter.sendMail(mailOptions);
        res.render('forgot-password', { 
            message: 'If that email exists, a reset link has been sent'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Reset Password Page
router.get('/reset-password/:token', async (req, res) => {
    try {
        const token = req.params.token;
        
        // Debug: Log the incoming token
        console.log('Received token:', token);
        
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        }).select('+resetPasswordToken +resetPasswordExpires');

        // Debug: Log whether user was found
        console.log('User found:', !!user);
        
        if (!user) {
            return res.render('reset-password', {
                error: 'Password reset link is invalid or has expired',
                validToken: false,
                token: null
            });
        }

        res.render('reset-password', {
            token: token,
            validToken: true,
            error: null
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.render('reset-password', {
            error: 'An error occurred. Please try again.',
            validToken: false,
            token: null
        });
    }
});
// Handle Password Reset
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const token = req.params.token;

        // Validate passwords match
        if (password !== confirmPassword) {
            return res.render('reset-password', {
                token,
                validToken: true,
                error: 'Passwords do not match'
            });
        }

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        }).select('+password +salt +resetPasswordToken +resetPasswordExpires');

        if (!user) {
            return res.render('reset-password', {
                token: null,
                validToken: false,
                error: 'Password reset token is invalid or has expired'
            });
        }

        // Update password
        const salt = crypto.randomBytes(16).toString('hex');
        const hashPassword = crypto.createHmac('sha256', salt)
            .update(password)
            .digest('hex');

        user.password = hashPassword;
        user.salt = salt;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Redirect with success
        res.redirect('/user/signin?success=Password+reset+successfully');

    } catch (error) {
        console.error('Password reset error:', error);
        res.render('reset-password', {
            token: req.params.token,
            validToken: true,
            error: 'An error occurred. Please try again.'
        });
    }
});
module.exports = router;
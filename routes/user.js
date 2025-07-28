const { Router } = require('express');
const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
const flash = require('connect-flash');
const { randomBytes, createHmac } = require('crypto');
const { ValidateToken } = require('../services/authentication');
const router = Router();
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.resolve('./public/uploads/profile-images/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Session configuration
router.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Flash messages
router.use(flash());

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.resolve('./public/uploads/profile-images/');
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = 'profile-' + uniqueSuffix + path.extname(file.originalname);
        console.log('Saving new profile image:', filename);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware to make flash messages available to all views
router.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    next();
});

// Signin routes
router.get('/signin', (req, res) => {
    res.render('signin', { 
        email: req.flash('email')[0] || '',
        error: req.flash('error')[0] 
    });
});

router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const token = await User.matchPasswordAndGenerateToken(email, password);
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        }).redirect('/');
    } catch (error) {
        console.error('Signin error:', error.message);
        req.flash('error', 'Incorrect email or password');
        req.flash('email', email);
        res.redirect('/user/signin');
    }
});

// Signup routes
router.get('/signup', (req, res) => {
    res.render('signup', { 
        formData: req.flash('formData')[0] || {},
        error: req.flash('error')[0] 
    });
});

router.post('/signup', upload.single('profileImage'), async (req, res) => {
    const { fullname, email, password } = req.body;
    
    try {
        let profileImageURL = '/images/default-profile.png';
        if (req.file) {
            profileImageURL = '/uploads/profile-images/' + req.file.filename;
        }

        await User.create({
            fullname,
            email,
            password,
            profileImageURL
        });

        req.flash('success', 'Registration successful! Please sign in.');
        res.redirect('/user/signin');
    } catch (error) {
        console.error('Signup error:', error);
        
        if (req.file) {
            const fs = require('fs');
            fs.unlinkSync(req.file.path);
        }

        req.flash('error', error.message || 'Registration failed. Please try again.');
        req.flash('formData', { fullname, email });
        res.redirect('/user/signup');
    }
});

// Logout route
router.get('/logout', (req, res) => {
    res.clearCookie('token').redirect('/');
});

// Password reset routes
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { 
        message: req.flash('message')[0],
        error: req.flash('error')[0] 
    });
});

router.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        
        req.flash('message', 'If an account exists with that email, a reset link has been sent');
        
        if (user) {
            const token = crypto.randomBytes(20).toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000;
            await user.save();

            const transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const resetUrl = `http://${req.headers.host}/user/reset-password/${token}`;
            
            await transporter.sendMail({
                to: user.email,
                from: process.env.EMAIL_USER,
                subject: 'Password Reset',
                html: `
                    <p>You requested a password reset for your account.</p>
                    <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
                    <p>This link expires in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                `
            });
        }

        res.redirect('/user/forgot-password');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error sending reset email. Please try again.');
        res.redirect('/user/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset link is invalid or has expired');
            return res.redirect('/user/forgot-password');
        }

        res.render('reset-password', {
            token: token,
            validToken: true,
            error: req.flash('error')[0]
        });
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/user/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const token = req.params.token;

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.redirect(`/user/reset-password/${token}`);
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired');
            return res.redirect('/user/forgot-password');
        }

        // Update password - the User model's pre-save hook will handle hashing
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success', 'Password reset successfully! Please sign in.');
        res.redirect('/user/signin');
    } catch (error) {
        console.error('Password reset error:', error);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect(`/user/reset-password/${req.params.token}`);
    }
});

// Profile routes (own profile)
router.get('/profile', ValidateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const user = await User.findById(req.user._id)
            .populate('followers', 'fullname profileImageURL')
            .populate('following', 'fullname profileImageURL');
            
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }
        
        // Get user's posts with pagination
        const Blog = require('../models/blog');
        const Comment = require('../models/comment');
        
        const totalPosts = await Blog.countDocuments({ createdBy: req.user._id });
        const totalPages = Math.ceil(totalPosts / limit);
        
        const userPosts = await Blog.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get comment counts for each post
        for (let post of userPosts) {
            post.commentCount = await Comment.countDocuments({ blog: post._id });
        }
        
        res.render('profile', { 
            user,
            userPosts,
            totalPosts,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            success: req.flash('success')[0],
            error: req.flash('error')[0]
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/');
    }
});

router.post('/profile/update', ValidateToken, upload.single('profileImage'), async (req, res) => {
    try {
        const { fullname, email } = req.body;
        const updates = { fullname, email };

        // Get current user to access old image
        const currentUser = await User.findById(req.user._id);
        
        if (req.file) {
            // Set new image path
            updates.profileImageURL = '/uploads/profile-images/' + req.file.filename;
            
            // Delete old image if it exists and is not default
            if (currentUser.profileImageURL && 
                !currentUser.profileImageURL.includes('default') && 
                !currentUser.profileImageURL.includes('placeholder')) {
                
                const oldImagePath = path.join(__dirname, '../public', currentUser.profileImageURL);
                if (fs.existsSync(oldImagePath)) {
                    try {
                        fs.unlinkSync(oldImagePath);
                        console.log('Deleted old image:', oldImagePath);
                    } catch (err) {
                        console.error('Error deleting old image:', err);
                    }
                }
            }
        }

        // Update user in database
        const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
        console.log('Updated user profile image URL:', updatedUser.profileImageURL);
        
        req.flash('success', 'Profile updated successfully');
        res.redirect('/user/profile');
    } catch (error) {
        console.error('Profile update error:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error deleting uploaded file:', err);
            }
        }
        
        req.flash('error', error.message || 'Error updating profile');
        res.redirect('/user/profile');
    }
});

// Follow/Unfollow user
router.post('/follow/:userId', ValidateToken, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user._id;

        if (targetUserId === currentUserId.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            // Unfollow
            currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
            currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
            
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId.toString());
            targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
        } else {
            // Follow
            currentUser.following.push(targetUserId);
            currentUser.followingCount += 1;
            
            targetUser.followers.push(currentUserId);
            targetUser.followersCount += 1;
        }

        await currentUser.save();
        await targetUser.save();

        res.json({
            success: true,
            isFollowing: !isFollowing,
            followersCount: targetUser.followersCount
        });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user profile (public view)
router.get('/profile/:userId', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const profileUser = await User.findById(req.params.userId)
            .populate('followers', 'fullname profileImageURL')
            .populate('following', 'fullname profileImageURL');
            
        if (!profileUser) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }

        // Get user's posts with pagination
        const Blog = require('../models/blog');
        const Comment = require('../models/comment');
        
        const totalPosts = await Blog.countDocuments({ createdBy: req.params.userId });
        const totalPages = Math.ceil(totalPosts / limit);
        
        const userPosts = await Blog.find({ createdBy: req.params.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get comment counts for each post
        for (let post of userPosts) {
            post.commentCount = await Comment.countDocuments({ blog: post._id });
        }

        res.render('userProfile', {
            profileUser,
            userPosts,
            totalPosts,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            user: req.user,
            isOwnProfile: req.user && req.user._id.toString() === profileUser._id.toString(),
            isFollowing: req.user && profileUser.followers.some(follower => follower._id.toString() === req.user._id.toString())
        });
    } catch (error) {
        console.error('Profile error:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/');
    }
});

// Add this at the end of your user routes file for debugging
console.log('User routes loaded');

module.exports = router;

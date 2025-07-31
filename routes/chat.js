const { Router } = require('express');
const Message = require('../models/message');
const User = require('../models/user');

const router = Router();

// Simple auth middleware
const checkAuth = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    next();
};

// Get chat page - shows list of people you follow (who you can message)
const mongoose = require('mongoose');

router.get('/', checkAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('following', 'fullname profileImageURL');

        if (!user) return res.redirect('/');

        const receiverId = new mongoose.Types.ObjectId(req.user._id);

        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    receiver: receiverId,
                    isRead: false
                }
            },
            {
                $group: {
                    _id: '$sender',
                    count: { $sum: 1 }
                }
            }
        ]);

        const unreadMap = {};
        unreadCounts.forEach(entry => {
            unreadMap[entry._id.toString()] = entry.count;
        });

        // Check if this is a share request
        const isSharing = req.query.share === 'true';

        res.render('chat', {
            user,
            followers: user.following,
            unreadMap,
            isSharing // Pass this to the template
        });

    } catch (error) {
        console.error('Chat page error:', error);
        res.redirect('/');
    }
});

// Get conversation with a specific user
router.get('/conversation/:userId', checkAuth, async (req, res) => {
    try {
        const receiverId = req.params.userId;
        const senderId = req.user._id;

        // Check if you follow this person
        const currentUser = await User.findById(senderId);
        const isFollowing = currentUser.following.includes(receiverId);

        if (!isFollowing) {
            return res.status(403).json({ 
                success: false, 
                message: 'You can only chat with people you follow' 
            });
        }

        // Get conversation messages
        const messages = await Message.find({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        })
        .populate('sender', 'fullname profileImageURL')
        .populate('receiver', 'fullname profileImageURL')
        .sort({ createdAt: 1 });

        // Mark messages as read
        await Message.updateMany(
            { sender: receiverId, receiver: senderId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        const receiver = await User.findById(receiverId, 'fullname profileImageURL');

        res.render('conversation', {
            user: req.user,
            receiver,
            messages
        });
    } catch (error) {
        console.error('Conversation error:', error);
        res.redirect('/chat');
    }
});

// Send a message
router.post('/send', checkAuth, async (req, res) => {
    try {
        console.log('Request body:', req.body); // Debug log
        // const { receiverId, content } = req.body;
        const receiverId = req.body.receiverId;
        const content = req.body.content;
        const senderId = req.user._id;

        console.log('Content received:', content); // Debug log
        console.log('Content trimmed:', content?.trim()); // Debug log

        if (!content || !content.trim()) {
            console.log('Content validation failed'); // Debug log
            return res.status(400).json({ 
                success: false, 
                message: 'Message content is required' 
            });
        }

        // Check if you follow this person
        const currentUser = await User.findById(senderId);
        const isFollowing = currentUser.following.includes(receiverId);

        if (!isFollowing) {
            return res.status(403).json({ 
                success: false, 
                message: 'You can only send messages to people you follow' 
            });
        }

        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            content: content.trim()
        });

        await newMessage.save();
        await newMessage.populate('sender', 'fullname profileImageURL');

        console.log('Message saved successfully'); // Debug log

        res.json({ 
            success: true, 
            message: newMessage,
            timestamp: newMessage.createdAt
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error sending message' 
        });
    }
});

// Get unread message count for current user
router.get('/unread-count', checkAuth, async (req, res) => {
    try {
        const userId = req.user._id;

        // Count messages where current user is receiver and message is unread
        const unreadCount = await Message.countDocuments({
            receiver: userId,
            isRead: false
        });

        res.json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread message count'
        });
    }
});


module.exports = router;









require('dotenv').config();
const express= require('express');
const path= require('path');
const fs = require('fs');
const mongoose= require('mongoose');
const userRoute = require('./routes/user')
const blogRoute= require('./routes/blog')
const chatRoute = require('./routes/chat');
const cookieParser=require('cookie-parser'); 
const Blog= require('./models/blog')
const User = require('./models/user')
const { checkForAuthenticationCookie } = require('./middlewares/authentication');

const app =express();
app.use(express.json())
const PORT= process.env.PORT|| 8000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

// Serve static files
app.use(express.static(path.resolve('./public')));
app.use('/uploads', express.static(path.resolve('./public/uploads')));

mongoose.connect(process.env.MONGO_URL)
.then((e)=> console.log("Mongodb connected successfully"))
app.set('view engine', "ejs");
app.set('views', path.resolve('./views'))
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(checkForAuthenticationCookie('token'))

// Helper function to strip HTML and truncate text
function stripHtmlAndTruncate(html, length) {
    // Remove all HTML tags
    let stripped = html.replace(/<[^>]*>/g, '');
    
    // Clean up extra whitespace
    stripped = stripped.replace(/\s+/g, ' ').trim();
    
    return stripped.length > length ? stripped.substring(0, length) + '...' : stripped;
}

app.get('/', async (req, res)=>{
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const totalBlogs = await Blog.countDocuments({});
    const totalPages = Math.ceil(totalBlogs / limit);
    
    const allBlogs = await Blog.find({})
        .populate('createdBy', 'fullname profileImageURL')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    
    // Get comment counts and user following status for each blog
    const Comment = require('./models/comment');
    const User = require('./models/user');
    
    let currentUser = null;
    if (req.user) {
        currentUser = await User.findById(req.user._id).populate('following', '_id');
    }
    
    for (let blog of allBlogs) {
        blog.commentCount = await Comment.countDocuments({ blog: blog._id });
        
        // Check if current user follows the blog author
        if (currentUser && blog.createdBy) {
            blog.isFollowingAuthor = currentUser.following.some(
                followedUser => followedUser._id.toString() === blog.createdBy._id.toString()
            );
        } else {
            blog.isFollowingAuthor = false;
        }
    }
    
    res.render('home', {
        user: req.user,
        blogs: allBlogs,
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
    });
})
app.use('/user', userRoute);
app.use('/blog', blogRoute);
app.use('/chat', chatRoute);

app.listen(PORT, ()=>{
    console.log(`server started at PORT: ${PORT}`);
})


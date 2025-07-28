const {Router}= require('express')
const router= Router();
const multer= require('multer')
const path= require('path');
const Blog=require('../models/blog')
const Comment = require('../models/comment')
const { ValidateToken } = require('../services/authentication');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.resolve(`./public/uploads/`))
    },
    filename: function (req, file, cb) {
     const filename = `${Date.now()}-${file.originalname}`
     cb(null, filename)
    }
  })
  
  const upload = multer({ storage: storage })

router.get('/add-new',  (req, res)=>{
return res.render('addBlog',{
    user: req.user
});
});


router.post('/', upload.single("coverImage"), async (req, res)=>{
    const {title, body}=req.body;

    const blogData = {
        body,
        title,
        createdBy: req.user._id
    };

    // Only add coverImageURL if file was uploaded
    if (req.file) {
        blogData.coverImageURL = `/uploads/${req.file.filename}`;
    }

    const blog = await Blog.create(blogData);
    return res.redirect(`/blog/${blog._id}`);
});
// In your route handler
router.get('/:id', async (req, res) => {
  try {
      const blog = await Blog.findById(req.params.id)
          .populate('createdBy', 'fullname profileImageURL');
      
      if (!blog) {
          return res.status(404).send('Blog not found');
      }

      const comments = await Comment.find({ blog: blog._id })
          .populate('createdBy', 'fullname profileImageURL')
          .sort({ createdAt: -1 });

      res.render('blog', {
          blog,
          comments,
          user: req.user // assuming you have user in session
      });
  } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).send('Server Error');
  }
});



  // routes/blog.js
router.post('/comment/:blogId', ValidateToken, async (req, res) => {
    try {
        const { content } = req.body;
        
        const newComment = new Comment({
            content,
            blog: req.params.blogId,
            createdBy: req.user._id
        });

        await newComment.save();
        
        // Increment comment count
        await Blog.findByIdAndUpdate(req.params.blogId, { 
            $inc: { commentCount: 1 } 
        });
        
        res.redirect(`/blog/${req.params.blogId}`);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send('Error adding comment');
    }
});



// GET route to show edit form
router.get('/edit/:id', ValidateToken, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        
        // Check if user is the author
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).send('You can only edit your own posts');
        }
        
        res.render('editBlog', {
            blog,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching blog for edit:', error);
        res.status(500).send('Server Error');
    }
});

// POST route to handle update
router.post('/edit/:id', ValidateToken, upload.single("coverImage"), async (req, res) => {
    try {
        const { title, body } = req.body;
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).send('Blog not found');
        }
        
        // Check if user is the author
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).send('You can only edit your own posts');
        }
        
        const updateData = { title, body };
        
        // Handle new cover image if uploaded
        if (req.file) {
            updateData.coverImageURL = `/uploads/${req.file.filename}`;
            
            // Delete old image if it exists and is not default
            if (blog.coverImageURL && !blog.coverImageURL.includes('default')) {
                const fs = require('fs');
                const oldImagePath = path.join(__dirname, '../public', blog.coverImageURL);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }
        
        await Blog.findByIdAndUpdate(req.params.id, updateData);
        res.redirect(`/blog/${req.params.id}`);
        
    } catch (error) {
        console.error('Error updating blog:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            const fs = require('fs');
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).send('Error updating blog');
    }
});

router.delete('/delete/:id', ValidateToken, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }
        
        // Check if user is the author
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
        }
        
        // Delete associated comments
        await Comment.deleteMany({ blog: req.params.id });
        
        // Delete cover image if it exists and is not default
        if (blog.coverImageURL && !blog.coverImageURL.includes('default')) {
            const fs = require('fs');
            const imagePath = path.join(__dirname, '../public', blog.coverImageURL);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        // Delete the blog
        await Blog.findByIdAndDelete(req.params.id);
        
        res.json({ success: true, message: 'Blog deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).json({ success: false, message: 'Error deleting blog' });
    }
});

// Like/Unlike blog post
router.post('/like/:id', ValidateToken, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog not found' });
        }

        const userId = req.user._id;
        console.log('User trying to like:', userId);
        console.log('Current likes array:', blog.likes);
        
        const isLiked = blog.likes.some(like => like.toString() === userId.toString());
        console.log('Is currently liked:', isLiked);

        if (isLiked) {
            // Unlike - remove user from likes array
            blog.likes = blog.likes.filter(like => like.toString() !== userId.toString());
            blog.likesCount = Math.max(0, blog.likesCount - 1);
        } else {
            // Like - add user to likes array
            blog.likes.push(userId);
            blog.likesCount += 1;
        }

        await blog.save();
        console.log('Updated likes array:', blog.likes);

        res.json({ 
            success: true, 
            isLiked: !isLiked, 
            likesCount: blog.likesCount 
        });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Image upload route for Quill editor
router.post('/upload-image', ValidateToken, upload.single('image'), async (req, res) => {
    try {
        console.log('Image upload request received');
        console.log('File:', req.file);
        
        if (!req.file) {
            console.log('No file uploaded');
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        console.log('Image uploaded successfully:', imageUrl);
        res.json({ success: true, imageUrl: imageUrl });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ success: false, message: 'Image upload failed' });
    }
});

module.exports=router;

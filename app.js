require('dotenv').config();
const express= require('express');
const path= require('path')
const mongoose= require('mongoose');
const userRoute = require('./routes/user')
const blogRoute= require('./routes/blog')
const cookieParser=require('cookie-parser'); 
const Blog= require('./models/blog')

const { checkForAuthenticationCookie } = require('./middlewares/authentication');

const app =express();
const PORT= process.env.PORT|| 8000;
app.use(express.static(path.resolve('./public')))
mongoose.connect(process.env.MONGO_URL)
.then((e)=> console.log("Mongodb connected successfully"))
app.set('view engine', "ejs");
app.set('views', path.resolve('./views'))
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(checkForAuthenticationCookie('token'))

app.get('/', async (req, res)=>{

    const allBlogs=  await Blog.find({})
    res.render('home', {
        user: req.user,
        blogs: allBlogs
    });
})
app.use('/user', userRoute)
app.use('/blog', blogRoute)

app.listen(PORT, ()=>{
    console.log(`server started at PORT: ${PORT}`);
})


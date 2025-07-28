const {Schema, model}=require('mongoose');

const blogSchema= new Schema({
    title: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    coverImageURL: {
        type: String,
        required: false,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'user',
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'user'
    }],
    likesCount: {
        type: Number,
        default: 0
    },
    commentCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Blog= model('blog', blogSchema)

module.exports=Blog;

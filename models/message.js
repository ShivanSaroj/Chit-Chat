const { Schema, model } = require('mongoose');

const messageSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    receiver: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['text', 'shared_post'],
        default: 'text'
    },
    sharedPost: {
        blogId: {
            type: Schema.Types.ObjectId,
            ref: 'Blog'
        },
        title: String,
        url: String
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });

const Message = model('message', messageSchema);
module.exports = Message;
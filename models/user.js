const { createHmac, randomBytes } = require('crypto');
const { Schema, model } = require('mongoose');
const { createTokenForUser } = require('../services/authentication');

const userSchema = new Schema({
    fullname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    salt: {
        type: String,
        select: false // Hide from query results
    },
    password: {
        type: String,
        required: true,
        select: false // Hide from query results
    },
    profileImageURL: {
        type: String,
        default: '/images/default-profile.png'
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER"
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        select: false
    },
    resetPasswordAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    lastPasswordChange: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            // Remove sensitive fields when converting to JSON
            delete ret.password;
            delete ret.salt;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
            delete ret.resetPasswordAttempts;
            return ret;
        }
    }
});

// Password hashing middleware
userSchema.pre("save", function(next) {
    const user = this;

    if (!user.isModified("password")) return next();

    try {
        const salt = randomBytes(16).toString('hex');
        const hashPassword = createHmac('sha256', salt)
            .update(user.password)
            .digest("hex");
        
        user.salt = salt;
        user.password = hashPassword;
        user.lastPasswordChange = Date.now();
        next();
    } catch (err) {
        next(err);
    }
});

// Password verification method
userSchema.static('matchPasswordAndGenerateToken', async function(email, password) {
    const user = await this.findOne({ email }).select('+password +salt');
    if (!user) {
        throw new Error('User not found!');
    }

    if (!user.isActive) {
        throw new Error('Account is disabled');
    }

    const userProvidedHash = createHmac('sha256', user.salt)
        .update(password)
        .digest("hex");

    if (user.password !== userProvidedHash) {
        throw new Error('Incorrect Password!');
    }

    return createTokenForUser(user);
});




// Generate password reset token method
userSchema.methods.generatePasswordResetToken = function() {
    const token = randomBytes(32).toString('hex');
    this.resetPasswordToken = token;
    this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    this.resetPasswordAttempts += 1;
    return token;
};

// Clear password reset token method
userSchema.methods.clearResetToken = function() {
    this.resetPasswordToken = undefined;
    this.resetPasswordExpires = undefined;
    this.resetPasswordAttempts = 0;
};

const User = model('user', userSchema);
module.exports = User;
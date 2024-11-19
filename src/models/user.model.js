import mongoose from 'mongoose';  // Import mongoose for MongoDB interactions
const Schema = mongoose.Schema;    // Get the Schema constructor from mongoose
import bcrypt from 'bcrypt';       // Import bcrypt for hashing passwords
import jwt from "jsonwebtoken"

// Define the User schema
const userSchema = new Schema({
    username: {
        type: String,  // The user's unique username
        required: true,  // This field is required
        unique: true,    // Ensure that the username is unique in the database
        trim: true,      // Remove leading and trailing spaces
    },
    email: {
        type: String,  // The user's unique email address
        required: true,  // This field is required
        unique: true,    // Ensure that the email is unique in the database
        trim: true,      // Remove leading and trailing spaces
        lowercase: true, // Convert the email to lowercase before saving
    },
    password: {
        type: String,  // The user's password (hashed)
        required: true,  // This field is required
    },
    avatar: {
        type: String,  // URL to the user's avatar image, stored on a service like Cloudinary
        required: true,  // This field is required
    },
    balance: {
        type: Number,  // The user's current balance
        default: 0.0,  // Default balance is 0.0
    },
    freeBalance: {
        type: Number,  // The user's free balance (e.g., bonus money)
        default: 0.0,  // Default free balance is 0.0
    },
    role: {
        type: String,  // The user's role, either 'user' or 'admin'
        enum: ['user', 'admin'],  // Restrict to the values 'user' and 'admin'
        default: 'user',  // Default role is 'user'
    },
    bets: [{
        type: Schema.Types.ObjectId,
        ref: 'Bet',  // Reference to the Bet model
    }],
    refreshToken: {
        type: String
    }

}, {
    timestamps: true,  // Automatically create `createdAt` and `updatedAt` fields
});

// Hash the password before saving the user document
userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();  // If the password is not modified, skip hashing

    this.password = await bcrypt.hash(this.password, 10);  // Hash the password with a salt factor of 10
    next();  // Proceed to the next middleware or save operation
});

// Method to compare a given password with the hashed password stored in the database
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password);  // Compare the provided password with the hashed password
}

// Method to generate a JWT access token for the user
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,  // Include the user's ID in the token payload
            email: this.email,  // Include the user's email in the token payload
            username: this.username,  // Include the user's username in the token payload
        },
        process.env.ACCESS_TOKEN_SECRET,  // Use the secret from the environment variables to sign the token
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY  // Set the token's expiration time
        }
    );
}

// Method to generate a JWT refresh token for the user
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,  // Include the user's ID in the token payload
        },
        process.env.REFRESH_TOKEN_SECRET,  // Use the secret from the environment variables to sign the token
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY  // Set the token's expiration time
        }
    );
}

// Create and export the User model based on the schema
export const User = mongoose.model("User", userSchema);

// Import mongoose and Schema for database modeling
import mongoose, { Schema } from "mongoose";
// Import JSON Web Token for authentication
import jwt from "jsonwebtoken";
// Import bcrypt for password hashing
import bcrypt from "bcryptjs";

// User Schema
const userSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  profile:{
    type: String,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
  },
  name: {
    type: String,
    required: [true, 'name is required'],
    trim: true,
    minlength: [3, 'name must be at least 3 characters'],
  },
    refreshToken: {
      type: String,
    },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


// Pre-save hook to update fullName and hash password
userSchema.pre("save", async function (next) {
  // Ensure fullName always has a space between firstName and lastName
  this.fullName = `${this.firstName} ${this.lastName || ""}`.trim();

  // Hash password if it is modified
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Password verification method
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate Access Token method
userSchema.methods.generateAccessToken = function () {
  console.log("Generating access token for user:", process.env.ACCESS_TOKEN_SECRET);
  return jwt.sign(
    {
      _id: this._id,
      type: "main",
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

// Generate Refresh Token method
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};


// Indexes
userSchema.index({ email: 1 }, { unique: true });
export const User = mongoose.model('User', userSchema);



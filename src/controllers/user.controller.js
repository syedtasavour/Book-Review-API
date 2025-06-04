// Core modules
import fs from "fs";

// Custom utility imports
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { destroyMediaOnS3, uploadOnS3 } from "../utils/awsStorage.js";

// Model imports
import { User } from "../models/user.model.js";


const signup = asyncHandler(async (req, res) => {
  const { email, name, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !name || !password) {
    if (fs.existsSync(req.file?.path)) await fs.promises.unlink(req.file?.path);
    throw new ApiError(400, "Email, name, and password are required");
  }signup
  if (!req.file || !req.file.path) {
    throw new ApiError(
      400,
      null,
      "Profile image is required for registration."
    );
  }
  if (password.length < 8 || !emailRegex.test(email || name.length < 3)) {
    if (fs.existsSync(req.file?.path)) await fs.promises.unlink(req.file?.path);
    throw new ApiError(
      400,
      null,
      "Password must be at least 8 characters long."
    );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (fs.existsSync(req.file?.path)) await fs.promises.unlink(req.file?.path);
    throw new ApiError(400, null, "User with this email already exists.");
  }
  const profile = await uploadOnS3(req.file.path, "profile", false);
  if (!profile.success) {

    throw new ApiError(500, null, "Failed to upload profile image.");
  }
  const user = await User.create({
    email,
    name,
    password,
    profile: profile.key,
  });
  if (!user) {
    await destroyMediaOnS3(profile.key);
  }
  return res
    .status(201)
    .json(new ApiResponse(201, user, "User registered successfully."));
});



export { signup };

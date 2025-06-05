// Core modules
import fs from "fs";
// Import JSON Web Token for authentication
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { destroyMediaOnS3, getS3FileUrl, uploadOnS3 } from "../utils/awsStorage.js";

// Model imports
import { User } from "../models/user.model.js";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError(
      500,
      null,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const signup = asyncHandler(async (req, res) => {
  const { email, name, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Helper to remove local uploaded file if exists
  const removeLocalFile = async () => {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      await fs.promises.unlink(req.file.path);
    }
  };

  // Basic input validation
  if (!email || !name || !password) {
    await removeLocalFile();
    throw new ApiError(400, null, "Email, name, and password are required.");
  }

  if (!emailRegex.test(email)) {
    await removeLocalFile();
    throw new ApiError(400, null, "Invalid email format.");
  }

  if (name.length < 3) {
    await removeLocalFile();
    throw new ApiError(400, null, "Name must be at least 3 characters long.");
  }

  if (password.length < 8) {
    await removeLocalFile();
    throw new ApiError(400, null, "Password must be at least 8 characters long.");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    await removeLocalFile();
    throw new ApiError(400, null, "User with this email already exists.");
  }

  // Optional profile image upload
  let profileKey = "";
  if (req.file?.path) {
    const profileUpload = await uploadOnS3(req.file.path, "profile", false);
    await removeLocalFile(); // clean up local file after upload

    if (!profileUpload.success) {
      throw new ApiError(500, null, "Failed to upload profile image.");
    }

    profileKey = profileUpload.key;
  }

  // Create user
  const user = await User.create({
    
    email,
    name,
    password,
    profile: profileKey,
  });

  if (!user) {
    if (profileKey) await destroyMediaOnS3(profileKey);
    throw new ApiError(500, null, "User creation failed.");
  }

  // Prepare user object for response
  const finalUser = user.toObject();
  delete finalUser.password;
  delete finalUser.refreshToken;
  delete finalUser.__v;
  delete finalUser.createdAt;
  delete finalUser._id;
  if (finalUser.profile) {
    const profileImage = await getS3FileUrl(finalUser.profile, false);
    finalUser.profile = profileImage.url;
  }

  return res
    .status(201)
    .json(new ApiResponse(201, finalUser, "User registered successfully."));
});


const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, null, "All fields are required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, null, "Invalid credentials");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, null, "Invalid credentials");
  }



  const { refreshToken, accessToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -__v -createdAt -_id"
  );
 if(user.profile !== ""){
  const profileImage = await getS3FileUrl(user.profile, false);
  loggedInUser.profile = profileImage.url;
}
 
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  const { accessToken, newRefreshToken } =
    await generateAccessAndRefereshTokens(user._id);

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiError(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed"
      )
    );
});


export { signup ,loginUser,logoutUser,refreshAccessToken};

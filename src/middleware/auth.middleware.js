// 1. Import required packages and modules
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";


// 2. Wrap the middleware with asyncHandler
export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // 3. Get token from cookies or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    // 4. If no token, throw error
    if (!token) {
      throw new ApiError(401, null, "Unauthorized request");
    }

    // 5. Verify token using secret key
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // 6. Find related user excluding sensitive fields
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    // 7. If user not found, throw error
    if (!user) {
      throw new ApiError(401, null, "Invalid Access Token");
    }

    // 8. Attach user to request object
    req.user = user;

    // 9. Proceed to next middleware
    next();
  } catch (error) {
    // 10. Handle invalid or expired token
    throw new ApiError(401, null, error?.message || "Invalid access token");
  }
});
import { Router } from "express";
import { upload } from "../middleware/multer.middleware.js";
import { loginUser, logoutUser, refreshAccessToken, signup } from "../controllers/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/signup").post(upload.single("profile"),signup);
router.route("/login").post(loginUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").patch(verifyJWT,refreshAccessToken); 

export default router;
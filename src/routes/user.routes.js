import { Router } from "express";
import { upload } from "../middleware/multer.middleware.js";
import { signup } from "../controllers/user.controller.js";
const router = Router();

router.route("/signup").post(upload.single("profile"),signup);

export default router;
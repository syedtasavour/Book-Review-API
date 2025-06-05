import { Router } from "express";

import { verifyJWT } from "../middleware/auth.middleware.js";
import { deleteReview, updateReview } from "../controllers/reviews.controller.js";
const router = Router();

router.route("/:Id").put(verifyJWT,updateReview ).delete(verifyJWT,deleteReview);
export default router;
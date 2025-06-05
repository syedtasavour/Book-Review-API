import { Router } from "express";
import { upload } from "../middleware/multer.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js";
import { addBook, books } from "../controllers/books.controller.js";
const router = Router();

router.route("/").post(verifyJWT,upload.single("coverImage"),addBook).get(books)

export default router;
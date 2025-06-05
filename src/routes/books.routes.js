import { Router } from "express";
import { upload } from "../middleware/multer.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js";
import { addBook, books, getBook, submitReview } from "../controllers/books.controller.js";
const router = Router();


router.route('/')
    .post(
        verifyJWT,
        upload.fields([
            { name: 'coverImage', maxCount: 1 }, // Up to 5 images
            { name: 'bookPdf', maxCount: 1 },   // Single PDF
        ]),
        addBook
    ).get(books)
router.route("/:Id/reviews").post(verifyJWT,submitReview);
router.route("/:Id").get(getBook);

export default router;
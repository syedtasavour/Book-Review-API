import { Router } from "express";
import { searchBooks } from "../controllers/search.controller.js";

const router = Router();

router.route("/").get(searchBooks);
export default router;
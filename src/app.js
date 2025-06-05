// Core imports
import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Middleware imports
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import { xss } from "express-xss-sanitizer";
import compression from "compression";
import helmet from "helmet";
// Initialize environment variables
dotenv.config({
  path: "./.env",
});

// Initialize express app
const app = express();

app.use(
    cors({
        origin: process.env.IS_PROD === true ? process.env.CORS_ORIGIN : "*",
        credentials: true
    })
)

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: (req, res) => (req.user?.role === "admin" ? 500 : 100),
  message: "Too many requests, please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use(limiter);
// Sanitization
app.use(mongoSanitize());
app.use(xss());


app.use(compression());
if (process.env.IS_PROD !== "true") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Route imports
import userRoutes from "./routes/user.routes.js";
import booksRoutes from "./routes/books.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import searchRoutes from "./routes/search.routes.js";



// Route declarations
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/books", booksRoutes);
app.use("/api/v1/reviews", reviewsRoutes);
app.use("/api/v1/search", searchRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to the API",
    });
});



export  {app}
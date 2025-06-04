// Core imports
import express from "express";
import dotenv from "dotenv";

// Middleware imports
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

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

if (process.env.IS_PROD !== "true") {
  app.use(morgan("dev"));
}

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Route imports
import userRoutes from "./routes/user.routes.js";



// Route declarations
app.use("/api/v1/users", userRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to the API",
    });
});



export  {app}
import express from "express"
import cookieParser from "cookie-parser"
const app = express()
import cors from "cors";

import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

app.use(
    cors({
        origin: process.env.IS_PROD === true ? process.env.CORS_ORIGIN : "*",
        credentials: true
    })
)

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to the API",
    });
});



export  {app}
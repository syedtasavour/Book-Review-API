// Core Node.js modules
import crypto from "crypto";
import path from "path";

// Third-party packages
import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(12,function(err,name){
        const fn = name.toString("HEX") + path.extname(file.originalname)
        cb(null, fn );
    })
    
  },
});

export const upload = multer({ storage: storage });
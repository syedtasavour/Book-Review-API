// Core modules
import fs from "fs";

// utils imports
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  destroyMediaOnS3,
  getS3FileUrl,
  uploadOnS3,
} from "../utils/awsStorage.js";

// Model imports
import { User } from "../models/user.model.js";
import { Book } from "../models/book.model.js";

const addBook = asyncHandler(async (req, res) => {
  const { title, author, genre } = req.body;
  if (!title || !author || !genre) {
    throw new ApiError(400, null, "Title, author, and genre are required");
  }
  if (!req.file.path) {
    throw new ApiError(400, null, "Book cover image is required");
  }
  console.log(req.file.path);
  const imageUrl = await uploadOnS3(req.file.path, "books", false);
  if (!imageUrl) {
    throw new ApiError(500, null, "Failed to upload book cover image");
  }
  const book = await Book.create({
    userId: req.user._id,
    title,
    author,
    genre,
    image: imageUrl.key,
  });
  if (!book) {
    await destroyMediaOnS3(imageUrl.key, "books");
    throw new ApiError(500, null, "Failed to add book");
  }
  const finalBook = book.toObject();
  const image = await getS3FileUrl(finalBook.image);
    book.image = image.url;
    delete finalBook.__v;


  return res
    .status(201)
    .json(new ApiResponse(201, book, "Book added successfully"));
});

const books = asyncHandler(async (req, res) => {
  const { author, genre } = req.query;

  // Build dynamic match condition with case-insensitive filters
  const matchStage = {};
  if (author) matchStage.author = { $regex: new RegExp(author, "i") };
  if (genre) matchStage.genre = { $regex: new RegExp(genre, "i") };

  const booksAggregate = Book.aggregate([
    { $match: matchStage },
     { $sort: { createdAt: -1 } },
    {
        $project: {
            title: 1,
            author: 1,
            image: 1,
            genre: 1,
        }
    }
  ]);

  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
  };

  const result = await Book.aggregatePaginate(booksAggregate, options);



const { docs, ...meta } = result;
const booksWithImageUrls = await Promise.all(
  docs.map(async (book) => {
    const { url } = await getS3FileUrl(book.image, false);
    return {
      ...book,
      image: url,
    };
  })
);

return res
  .status(200)
  .json(new ApiResponse(200, { books: booksWithImageUrls, meta }, "Books retrieved successfully"));
});

export { addBook,books };

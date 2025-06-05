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
import redis from "../utils/redisConfig.js";
// Model imports
import { Book } from "../models/book.model.js";
import { Review } from "../models/reviews.model.js";
import { isValidObjectId } from "mongoose";

const addBook = asyncHandler(async (req, res) => {
  const { title, author, genre } = req.body;
  const coverImagePath = req?.files?.coverImage[0]?.path;
  const bookPdfPath = req?.files?.bookPdf[0]?.path;
  if (!coverImagePath || !bookPdfPath) {
    throw new ApiError(400, null, "Cover image and book PDF are required");
  }
  if (!title || !author || !genre) {
    throw new ApiError(400, null, "Title, author, and genre are required");
  }

  const imageUrl = await uploadOnS3(coverImagePath, "booksCoverImages", false);
  const bookPdfUrl = await uploadOnS3(bookPdfPath, "booksPdf", false);
  if (!bookPdfUrl) {
    if (imageUrl) await destroyMediaOnS3(imageUrl.key);
    throw new ApiError(500, null, "Failed to upload book PDF");
  }
  if (!imageUrl) {
    if (bookPdfUrl) await destroyMediaOnS3(bookPdfUrl.key);
    throw new ApiError(500, null, "Failed to upload book cover image");
  }
  const book = await Book.create({
    userId: req.user._id,
    bookUrl: bookPdfUrl.key,
    title,
    author,
    genre,
    image: imageUrl.key,
  });
  if (!book) {
    await destroyMediaOnS3(imageUrl.key, "books");
    throw new ApiError(500, null, "Failed to add book");
  }
  const keys = await redis.keys("books:*");
if (keys.length) await redis.del(...keys);

  const image = await getS3FileUrl(book.image);
  const bookPdf = await getS3FileUrl(book.bookUrl);
  book.bookUrl = bookPdf.url;
  book.image = image.url;
  

  return res
    .status(201)
    .json(new ApiResponse(201, book, "Book added successfully"));
});

const books = asyncHandler(async (req, res) => {
  const { author, genre , page = 1, limit = 10} = req.query;

   const cacheKey = `books:author:${author.toLowerCase() || "all"}:genre:${genre.toLowerCase() || "all"}:page:${page}:limit:${limit}`;
const cachedData = await redis.get(cacheKey);
  if (cachedData) {

    return res
      .status(200)
      .json(new ApiResponse(200, JSON.parse(cachedData), "Books retrieved from cache successfully"));
  }
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
        bookUrl: 1,
        genre: 1,
      },
    },
  ]);

   const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await Book.aggregatePaginate(booksAggregate, options);

  const { docs, ...meta } = result;
  const booksWithImageUrls = await Promise.all(
    docs.map(async (book) => {
      const { url } = await getS3FileUrl(book.image, false);
      const bookUrl = await getS3FileUrl(book.bookUrl, false);
      return {
        ...book,
        image: url,
        bookUrl: bookUrl.url,
      };
    })
  );
  const responseData = { books: booksWithImageUrls, meta };
  await redis.set(cacheKey, JSON.stringify(responseData), "EX", 60 * 60);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseData,
        "Books retrieved successfully"
      )
    );
});

const submitReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating) {
    throw new ApiError(400, null, "Rating and comment are required");
  }
const keys = await redis.keys(`book:${req.params.Id}:reviews:*`);
if (keys.length > 0) {
  await redis.del(...keys);
}


  if (!req.params.Id) {
    throw new ApiError(400, null, "Book ID is required");
  }
  const book = await Book.findById(req.params.Id);
  if (!book) {
    throw new ApiError(404, null, "Book not found");
  }
  const existingReview = await Review.findOne({
    bookId: req.params.Id,
    userId: req.user._id,
  });
  if (existingReview) {
    throw new ApiError(
      400,
      null,
      "You have already submitted a review for this book"
    );
  }
  const review = await Review.create({
    bookId: req.params.Id,
    userId: req.user._id,
    rating,
    comment,
  });

  if (!review) {
    throw new ApiError(500, null, "Failed to submit review");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, review, "Review submitted successfully"));
});

const getBook = asyncHandler(async (req, res) => {
  const { Id } = req.params;
  const { page = 1, limit = 10 } = req.query;
 
 const cacheKey = `book:${Id}:reviews:${page}:${limit}`;

// Step 1: Check Redis cache
const cachedData = await redis.get(cacheKey);

if (cachedData) {
  const parsedData = JSON.parse(cachedData); // ✅ parse before sending

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        parsedData,
        "Book reviews retrieved from cache successfully"
      )
    );
}

  // Validate Book ID
  if (!Id || !isValidObjectId(Id)) {
    throw new ApiError(400, null, "Valid Book ID is required");
  }

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, null, "Page must be a positive integer");
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, null, "Limit must be between 1 and 100");
  }

  // Fetch book with specific fields
  const book = await Book.findById(Id).select(
    "_id title author image genre createdAt bookUrl"
  );
  if (!book) {
    throw new ApiError(404, null, "Book not found");
  }

  const bookObject = book.toObject();

  // Fetch S3 URL for book image
  const image = await getS3FileUrl(bookObject.image, false);
  const bookUrl = await getS3FileUrl(bookObject.bookUrl, false);
    if (!bookUrl || !bookUrl.url) {
    throw new ApiError(500, null, "Failed to fetch book URL");
    }
    bookObject.bookUrl = bookUrl.url;
  bookObject.image = image.url;

  // Calculate total review count
  const reviewCount = await Review.countDocuments({ bookId: Id });

  // Calculate average rating using aggregation
  const ratingAggregate = await Review.aggregate([
    { $match: { bookId: Id } },
    { $group: { _id: null, averageRating: { $avg: "$rating" } } },
  ]);
  const averageRating = ratingAggregate[0]?.averageRating
    ? Number(ratingAggregate[0].averageRating.toFixed(2))
    : 0;

  // Fetch paginated reviews
  const reviews = await Review.find({ bookId: Id })
    .populate("userId", "name profile")
    .select("_id userId rating comment")
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  // Map reviews to desired structure
  bookObject.reviews = await Promise.all(
    reviews.map(async (review) => {
      let profileUrl = null;
      if (review.userId?.profile) {
        try {
          profileUrl = (await getS3FileUrl(review.userId.profile, false)).url;
        } catch (error) {
          console.error(
            `Failed to fetch profile image for user ${review.userId._id}:`,
            error
          );
        }
      }
      return {
        id: review._id,
        name: review.userId?.name || "Unknown",
        profile: profileUrl,
        rating: review.rating,
        comment: review.comment,
      };
    })
  );

  // Add calculated fields and pagination metadata
  bookObject.averageRating = averageRating;
  bookObject.reviewCount = reviewCount;
  bookObject.pagination = {
    totalReviews: reviewCount,
    currentPage: pageNum,
    totalPages: Math.ceil(reviewCount / limitNum),
    limit: limitNum,
  };
    // Cache the book data with reviews
 // ✅ Cache the full book data with reviews
await redis.set(cacheKey, JSON.stringify(bookObject), "EX", 60 * 60); // 1 hour


  return res
    .status(200)
    .json(new ApiResponse(200, bookObject, "Book retrieved successfully"));
});

export { addBook, books, submitReview, getBook };

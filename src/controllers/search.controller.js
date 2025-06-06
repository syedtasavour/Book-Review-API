import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {ApiError} from "../utils/ApiError.js";
import {Book} from "../models/book.model.js";
import redis from "../utils/redisConfig.js"; // your redis client instance
import { getS3FileUrl } from "../utils/awsStorage.js";

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour TTL for cache

// Utility to format cache key consistently
const formatCacheKey = (query) =>
  query.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const searchBooks = asyncHandler(async (req, res) => {
  const { query } = req.body;

  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    throw new ApiError(400, null, "Search query cannot be empty");
  }

  const cacheKey = `searchBooks:${formatCacheKey(trimmedQuery)}`;

  // Try fetching cached results
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          JSON.parse(cachedData),
          "Books retrieved from cache successfully"
        )
      );
  }

  // Escape special regex characters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapeRegex(trimmedQuery), "i");
  const exactRegex = new RegExp(`^${escapeRegex(trimmedQuery)}$`, "i");

  const isShortQuery = trimmedQuery.length <= 2;
  const searchConditions = isShortQuery
    ? {
        $or: [
          { title: { $regex: exactRegex } },
          { author: { $regex: exactRegex } },
          { title: { $regex: searchRegex } },
          { author: { $regex: searchRegex } },
        ],
      }
    : { $text: { $search: trimmedQuery } };

  // Fetch up to 10 matching books
  const booksQuery = Book.find(searchConditions)
    .select("title author image genre imageUrl")
    .limit(10)
    .lean();

  if (!isShortQuery) {
    booksQuery.sort({ score: { $meta: "textScore" } });
  }

  const books = await booksQuery;

  // Process books for S3 URLs
  const bookObjects = await Promise.all(
    books.map(async (book) => {
      let imageUrl = null;
      try {
        if (book.imageUrl) {
          imageUrl = book.imageUrl; // Use cached URL if available
        } else if (book.image) {
          const image = await getS3FileUrl(book.image, false);
          imageUrl = image.url;
        }
      } catch (error) {
        console.error(`Failed to fetch image for book ${book._id}:`, error);
      }
      return {
        image: imageUrl,
        name: book.title,
        author: book.author,
        genre: book.genre,
      };
    })
  );

  // For short queries, prioritize exact matches at the top
  if (isShortQuery) {
    bookObjects.sort((a, b) => {
      const aExact =
        a.name.toLowerCase() === trimmedQuery.toLowerCase() ||
        a.author.toLowerCase() === trimmedQuery.toLowerCase();
      const bExact =
        b.name.toLowerCase() === trimmedQuery.toLowerCase() ||
        b.author.toLowerCase() === trimmedQuery.toLowerCase();
      return bExact - aExact;
    });
  }

  // Cache the results in Redis
  await redis.set(cacheKey, JSON.stringify(bookObjects), "EX", CACHE_TTL_SECONDS);

  return res
    .status(200)
    .json(new ApiResponse(200, bookObjects, "Books retrieved successfully"));
});

export  {searchBooks};

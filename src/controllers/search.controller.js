import { Book } from "../models/book.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const searchBooks = asyncHandler(async (req, res) => {
    const { query } = req.body;

    // Validate search query
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
        throw new ApiError(400, null, "Search query cannot be empty");
    }

    // Escape special regex characters
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapeRegex(trimmedQuery), 'i');
    const exactRegex = new RegExp(`^${escapeRegex(trimmedQuery)}$`, 'i');

    // Build query based on length
    const isShortQuery = trimmedQuery.length <= 2;
    const searchConditions = isShortQuery
        ? {
              $or: [
                  { title: { $regex: exactRegex } },
                  { author: { $regex: exactRegex } },
                  { title: { $regex: searchRegex } },
                  { author: { $regex: searchRegex } },
              ]
          }
        : { $text: { $search: trimmedQuery } };

    // Fetch up to 10 matching books
    const booksQuery = Book.find(searchConditions)
        .select('title author image genre imageUrl')
        .limit(10)
        .lean();

    if (!isShortQuery) {
        booksQuery.sort({ score: { $meta: "textScore" } });
    }

    const books = await booksQuery;

    // Process books
    const bookObjects = await Promise.all(
        books.map(async (book) => {
            let imageUrl = null;
            try {
                if (book.imageUrl) {
                    imageUrl = book.imageUrl; // Use cached URL
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

    // Sort short query results to prioritize exact matches
    if (isShortQuery) {
        bookObjects.sort((a, b) => {
            const aExact = a.name.toLowerCase() === trimmedQuery.toLowerCase() || a.author.toLowerCase() === trimmedQuery.toLowerCase();
            const bExact = b.name.toLowerCase() === trimmedQuery.toLowerCase() || b.author.toLowerCase() === trimmedQuery.toLowerCase();
            return bExact - aExact;
        });
    }

    return res
        .status(200)
        .json(new ApiResponse(200, bookObjects, "Books retrieved successfully"));
});

export { searchBooks };
  
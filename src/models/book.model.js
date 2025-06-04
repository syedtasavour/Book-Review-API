// Import mongoose and Schema for MongoDB modeling
import mongoose, { Schema } from "mongoose";
// Import pagination plugin for aggregation queries
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Book Schema
const bookSchema = new Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  author: {
    type: String,
    required: [true, "Author is required"],
    trim: true,
  },
  image: {
    type: String,
    required: [true, "Image URL is required"],
    trim: true,
  },
  genre: {
    type: String,
    required: [true, "Genre is required"],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
});

bookSchema.index({ title: "text", author: "text" }); // For search functionality
bookSchema.index({ genre: 1 }); // For filtering by genre

bookSchema.plugin(mongooseAggregatePaginate);

reviewSchema.index({ bookId: 1, userId: 1 }, { unique: true }); // Ensure one review per user per book

export const Book = mongoose.model("Book", bookSchema);

// Import mongoose and Schema for MongoDB modeling
import mongoose, { Schema } from "mongoose";
// Import pagination plugin for aggregation queries
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Review Schema
const reviewSchema = new Schema({
  bookId: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: [true, "Book ID is required"],
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
  rating: {
    type: Number,
    required: [true, "Rating is required"],
    min: [1, "Rating must be at least 1"],
    max: [5, "Rating cannot exceed 5"],
  },
  comment: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
reviewSchema.plugin(mongooseAggregatePaginate);
export const Review = mongoose.model("Review", reviewSchema);

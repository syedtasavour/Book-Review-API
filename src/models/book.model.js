// Import mongoose and Schema for MongoDB modeling
import mongoose, { Schema } from "mongoose";
// Import pagination plugin for aggregation queries
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Book Schema
const bookSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
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
  bookUrl: {
    type: String,
    required: [true, "Book URL is required"],
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
  }
});

bookSchema.plugin(mongooseAggregatePaginate);


export const Book = mongoose.model("Book", bookSchema);

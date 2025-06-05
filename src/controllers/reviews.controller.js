
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Model imports
import { Review } from "../models/reviews.model.js";

const updateReview = asyncHandler(async (req, res) => {
    const {Id} = req.params;
    const {rating, comment} = req.body;
    if (!rating && !comment) {
        throw new ApiError(400, null, "Rating and comment are required");
    }
    if (!Id) {
        throw new ApiError(400, null, "Review ID is required");
    }
    const review = await Review.findById(Id);
    if (!review) {
        throw new ApiError(404, null, "Review not found");
    }
    if (review.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, null, "You are not authorized to update this review");
    }
    if(rating)review.rating = rating;
    if(comment)review.comment = comment;
    
    const updatedReview = await review.save();
    if (!updatedReview) {
        throw new ApiError(500, null, "Failed to update review");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, updatedReview, "Review updated successfully"));
}
);


const deleteReview = asyncHandler(async (req, res) => {
  const { Id } = req.params;
  if (!Id) {
    throw new ApiError(400, null, "Review ID is required");
  }

  const review = await Review.findById(Id);
  if (!review) {
    throw new ApiError(404, null, "Review not found");
  }

  if (review.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, null, "You are not authorized to delete this review");
  }

  await Review.findByIdAndDelete(Id);

  return res.status(200).json(
    new ApiResponse(200, null, "Review deleted successfully")
  );
});


export {updateReview,deleteReview}


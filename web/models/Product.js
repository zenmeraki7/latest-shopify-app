import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    shopifyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    handle: {
      type: String,
      trim: true,
    },
    productType: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    category: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    seoTitle: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    category_prediction_result: {
      predicted_category_path: { type: String,default: null },
      confidence_per_level: [Number],
      overall_confidence: Number,
      categoryRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "categories",
      },
    },
    category_prediction_status: {
      type: String,
      enum: ["classified", "needs_review", "pending"],
      default: "pending",
    },
    shop: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;

import mongoose from "mongoose";

const ProductCategorySchema = new mongoose.Schema(
  {
    category_id: {
      type: Number,
      required: true,
      unique: true,
    },
    category_path: {
      type: String,
      required: true,
    },
    top_level_category_level_1: {
      type: String,
      default: null,
    },
    sub_category_level_2: {
      type: String,
      default: null,
    },
    product_category_level_3: {
      type: String,
      default: null,
    },
    product_category_level_4: {
      type: String,
      default: null,
    },
    product_category_level_5: {
      type: String,
      default: null,
    },
    product_category_level_6: {
      type: String,
      default: null,
    },
    product_category_level_7: {
      type: String,
      default: null,
    },
    product_category_level_8: {
      type: String,
      default: null,
    },
    product_category_level_9: {
      type: String,
      default: null,
    },
    assureful_rr: {
      type: Number,
      required: false,
      default: 0,
    },
    refer_to_uw: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },
    special_acceptance: {
      type: String,
      required: true,
    },
    qbe_comments: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const ProductCategory = mongoose.model("categories", ProductCategorySchema);
export default ProductCategory;

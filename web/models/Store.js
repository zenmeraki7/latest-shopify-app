import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    shopUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shopOwner: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    accessToken: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },
    isProductsSyncing: {
      type: Boolean,
      default: false,
    },
    bulkOperationId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Store = mongoose.model("Store", storeSchema);

export default Store;

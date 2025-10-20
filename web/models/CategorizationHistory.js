import mongoose from "mongoose";

const CategorizationHistorySchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, index: true },
    totalProducts: { type: Number, required: true },
    processedProducts: { type: Number, default: 0 },
    totalBatches: { type: Number, required: true },
    processedBatches: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["queued", "in-progress", "completed", "failed"],
      default: "queued",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

const CategorizationHistory = mongoose.model(
  "CategorizationHistory",
  CategorizationHistorySchema
);
export default CategorizationHistory;

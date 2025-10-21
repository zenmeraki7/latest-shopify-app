import mongoose from "mongoose";

const CategorizationLogSchema = new mongoose.Schema(
  {
    historyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CategorizationHistory",
      required: true,
      index: true,
    },
    shop: { type: String, required: true },
    batchNumber: Number,
    processedProducts: Number,
    status: {
      type: String,
      enum: ["success", "error", "info"],
      default: "info",
    },
    message: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const CategorizationLog = mongoose.model(
  "CategorizationLog",
  CategorizationLogSchema
);
export default CategorizationLog;

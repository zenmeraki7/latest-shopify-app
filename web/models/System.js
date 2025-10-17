import mongoose from "mongoose";

/* ============================================================================
   🧩 Optional Metadata Schema
   ---------------------------------------------------------------------------
   Define this only if your metadata structure is becoming stable.
   You can safely keep it as a flexible Mixed field for now.
   ========================================================================== */

const metadataSchema = new mongoose.Schema(
  {
    hyperparameters: {
      type: mongoose.Schema.Types.Mixed, // e.g., { learningRate: 0.01, epochs: 10 }
      default: {},
    },
    featureSet: { type: String, trim: true },
    loss: Number,
    precision: Number,
    recall: Number,
    notes: String,
  },
  { _id: false }
);

/* ============================================================================
   🧠 System Schema — Tracks ML model metadata, accuracy, and retraining history
   ========================================================================== */

const systemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /* ------------------------------------------------------------------------
       🤖 ML Model Tracking
       ------------------------------------------------------------------------ */
    lastRetrainedAt: Date,
    accuracy: { type: Number, min: 0, max: 1 },
    modelVersion: { type: String, trim: true },
    trainingDataCount: { type: Number, default: 0 },

    /* ------------------------------------------------------------------------
       🧠 Metadata (structured or flexible)
       ------------------------------------------------------------------------ */
    metadata: {
      type: metadataSchema, // change to Schema.Types.Mixed if you prefer full flexibility
      default: () => ({}),
    },

    /* ------------------------------------------------------------------------
       🧾 Retraining History
       ------------------------------------------------------------------------ */
    history: [
      {
        timestamp: { type: Date, default: Date.now },
        accuracy: Number,
        trainingDataCount: Number,
        notes: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true } // Automatically manages createdAt and updatedAt
);

/* ============================================================================
   ⚙️ Static Methods
   ========================================================================== */

/**
 * Get ML model info (metadata + training stats)
 */
systemSchema.statics.getMLModelInfo = async function () {
  return await this.findOne({ key: "mlModel" }).lean();
};

/**
 * Update ML model info and append a retraining history entry
 */
systemSchema.statics.updateMLModelInfo = async function (data = {}) {
  const current = await this.findOne({ key: "mlModel" }).lean();

  const historyEntry = {
    timestamp: new Date(),
    accuracy: data.accuracy ?? current?.accuracy,
    trainingDataCount: data.trainingDataCount ?? current?.trainingDataCount,
    notes: data.notes || "Model retrained",
  };

  return await this.findOneAndUpdate(
    { key: "mlModel" },
    {
      key: "mlModel",
      lastRetrainedAt: new Date(),
      accuracy: data.accuracy ?? current?.accuracy ?? null,
      modelVersion: data.modelVersion || current?.modelVersion || "v1",
      trainingDataCount:
        data.trainingDataCount ?? current?.trainingDataCount ?? 0,
      metadata: data.metadata || current?.metadata || {},
      $push: { history: historyEntry },
    },
    { upsert: true, new: true }
  );
};

/**
 * Retrieve all system-level stats as a key-value map
 */
systemSchema.statics.getSystemStats = async function () {
  const stats = await this.find({}).lean();
  return stats.reduce((acc, item) => {
    acc[item.key] = {
      lastUpdated: item.updatedAt,
      ...item,
    };
    return acc;
  }, {});
};

/**
 * Reset ML model tracking info (useful for testing)
 */
systemSchema.statics.resetMLModel = async function () {
  return await this.findOneAndUpdate(
    { key: "mlModel" },
    {
      lastRetrainedAt: null,
      accuracy: null,
      trainingDataCount: 0,
      metadata: {},
      history: [],
    },
    { new: true }
  );
};

/* ============================================================================
   🧱 Export
   ========================================================================== */
const System = mongoose.model("System", systemSchema);
export default System;

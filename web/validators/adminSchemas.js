import { z } from "zod";
import mongoose from "mongoose";

/* ============================================================================
   🧩 Shared Helpers
   ========================================================================== */

/**
 * ✅ MongoDB ObjectId validator
 */
const objectId = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid MongoDB ObjectId",
  });

/**
 * ✅ Coerced confidence range (0–1)
 */
const confidenceRangeCoerced = z.coerce
  .number()
  .min(0, "Confidence must be ≥ 0")
  .max(1, "Confidence must be ≤ 1")
  .optional();

/**
 * ✅ Coerced pagination validator
 */
const pagination = {
  page: z.coerce
    .number()
    .int()
    .positive("Page must be a positive integer")
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .positive("Limit must be a positive integer")
    .optional(),
};

/* ============================================================================
   🧾 1️⃣ Override Classification Schema
   POST /api/admin/products/:id/override
   ========================================================================== */
export const overrideSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    category: z
      .string({
        required_error: "Category is required",
        invalid_type_error: "Category must be a string",
      })
      .min(1, "Category cannot be empty"),
    reason: z
      .string()
      .max(300, "Reason too long (max 300 characters)")
      .optional(),
  }),
});

/* ============================================================================
   ⚙️ 2️⃣ Bulk Reclassify Schema
   POST /api/admin/products/bulk-reclassify
   ========================================================================== */
export const bulkReclassifySchema = z.object({
  body: z
    .object({
      productIds: z
        .array(objectId)
        .max(100, "Cannot process more than 100 products at once")
        .optional(),
      filter: z
        .record(z.any())
        .optional()
        .refine(
          (val) => val === undefined || Object.keys(val).length > 0,
          "Filter cannot be empty if provided"
        ),
    })
    .refine(
      (data) =>
        (data.productIds && data.productIds.length > 0) || data.filter,
      {
        message: "Either productIds or filter must be provided",
        path: ["body"],
      }
    ),
});

/* ============================================================================
   📊 3️⃣ Analytics Query Schema
   GET /api/admin/analytics
   ========================================================================== */
export const analyticsQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    minConfidence: confidenceRangeCoerced,
    maxConfidence: confidenceRangeCoerced,
    search: z.string().max(100).optional(),
    ...pagination,
  }),
});

/* ============================================================================
   🤖 4️⃣ Training Data Query Schema
   GET /api/admin/ml/training-data
   ========================================================================== */
export const trainingDataQuerySchema = z.object({
  query: z.object({
    format: z.enum(["json", "csv"]).default("json"),
    minConfidence: confidenceRangeCoerced.default(0),
    includeManual: z
      .enum(["true", "false"])
      .default("true")
      .optional(),
  }),
});

/* ============================================================================
   🧠 5️⃣ Retrain Model Schema
   POST /api/admin/ml/retrain
   ========================================================================== */
export const retrainModelSchema = z.object({
  body: z.object({
    minConfidence: confidenceRangeCoerced.default(0.7),
    includeManualOverrides: z
      .enum(["true", "false"])
      .default("true")
      .optional(),
    dryRun: z
      .enum(["true", "false"])
      .default("false")
      .optional(),
    notes: z
      .string()
      .max(300, "Notes too long (max 300 characters)")
      .optional(),
  }),
});

/* ============================================================================
   🧱 Type Exports (for IDE + TS autocomplete)
   ========================================================================== */
export const AdminSchemas = {
  overrideSchema,
  bulkReclassifySchema,
  analyticsQuerySchema,
  trainingDataQuerySchema,
  retrainModelSchema,
};

/**
 * 🧩 Type Inference
 * Use these for strong typing in controllers or middleware.
 * Example:
 *   import { OverrideSchema } from "../validators/adminSchemas.js";
 *   /** @param {OverrideSchema['body']} reqBody *\/
 */
export const AdminSchemaTypes = {
  Override: {
    body: /** @type {import("zod").infer<typeof overrideSchema>['body']} */ ({}),
    params: /** @type {import("zod").infer<typeof overrideSchema>['params']} */ ({}),
  },
  BulkReclassify: {
    body: /** @type {import("zod").infer<typeof bulkReclassifySchema>['body']} */ ({}),
  },
  AnalyticsQuery: {
    query: /** @type {import("zod").infer<typeof analyticsQuerySchema>['query']} */ ({}),
  },
  TrainingDataQuery: {
    query: /** @type {import("zod").infer<typeof trainingDataQuerySchema>['query']} */ ({}),
  },
  RetrainModel: {
    body: /** @type {import("zod").infer<typeof retrainModelSchema>['body']} */ ({}),
  },
};

export default AdminSchemas;

import express from "express";
import {
  loginAdmin,
  getProductsForAdmin,
  getProductDetails,
  reclassifyProduct,
  overrideClassification,
  getAnalytics,
  bulkReclassifyProducts,
  // getTrainingData,
  retrainModel,
  getModelStatus,
} from "../controllers/adminController.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import {
  // adminRateLimiter,
  createStrictRateLimiter,
  createLoginRateLimite,
} from "../middlewares/rateLimiter.js";
import { performanceLogger, errorLogger } from "../middlewares/logging.js";
import { validate } from "../middlewares/validate.js";
import {
  overrideSchema,
  bulkReclassifySchema,
  trainingDataQuerySchema,
  retrainModelSchema,
} from "../validators/index.js";

const router = express.Router();

/* ============================================================================
   🚀 Global Middleware
   ========================================================================== */

// Request-duration metrics for every admin route
router.use(performanceLogger);

/* ============================================================================
   🔓 Public Routes (no auth required)
   ========================================================================== */

/**
 * Admin login (rate-limited)
 * POST /api/admin/login
 * Body: { apiKey: string }
 */
router.post("/login", createLoginRateLimite, loginAdmin);

/* ============================================================================
   🔐 Protected Routes
   ========================================================================== */

// Require authentication beyond this point
router.use(adminAuth);

// Apply general API limiter
// router.use(adminRateLimiter);

/* ============================================================================
   🩺 Health Check
   ========================================================================== */

router.get("/health", (req, res) =>
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  })
);

/* ============================================================================
   📊 Analytics
   ========================================================================== */

/**
 * Classification analytics (cached)
 * GET /api/admin/analytics
 */
router.get("/analytics", getAnalytics);

/* ============================================================================
   🧾 Product Management
   ========================================================================== */

/**
 * Paginated product listing
 * GET /api/admin/products
 */
router.get("/products", getProductsForAdmin);

/**
 * Single product details
 * GET /api/admin/products/:id
 */
router.get("/products/:id", getProductDetails);

/**
 * Reclassify one product via AI
 * POST /api/admin/products/:id/reclassify
 */
router.post("/products/:id/reclassify", createStrictRateLimiter, reclassifyProduct);

/**
 * Manual classification override
 * POST /api/admin/products/:id/override
 */
router.post(
  "/products/:id/override",
  validate(overrideSchema),
  createStrictRateLimiter,
  overrideClassification
);

/**
 * Bulk reclassification
 * POST /api/admin/products/bulk-reclassify
 */
router.post(
  "/products/bulk-reclassify",
  createStrictRateLimiter,
  validate(bulkReclassifySchema),
  bulkReclassifyProducts
);

/* ============================================================================
   🤖 Machine Learning
   ========================================================================== */

/**
 * Export ML training data
 * GET /api/admin/ml/training-data
 */
// router.get("/ml/training-data", validate(trainingDataQuerySchema), getTrainingData);

/**
 * Trigger ML model retraining
 * POST /api/admin/ml/retrain
 */
router.post("/ml/retrain", createStrictRateLimiter, validate(retrainModelSchema), retrainModel);

/**
 * Get ML model status
 * GET /api/admin/ml/status
 */
router.get("/ml/status", getModelStatus);

/* ============================================================================
   🧹 Cache Management
   ========================================================================== */

/**
 * Clear analytics cache
 * POST /api/admin/cache/clear
 */
router.post("/cache/clear", createStrictRateLimiter, async (req, res) => {
  try {
    const { clearCache } = await import("../utils/cache.js");
    await clearCache();
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (err) {
    console.error("[ADMIN] Cache clear error:", err);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

/**
 * Get cache statistics
 * GET /api/admin/cache/stats
 */
router.get("/cache/stats", async (req, res) => {
  try {
    const { getCacheStats } = await import("../utils/cache.js");
    res.json({ success: true, stats: getCacheStats() });
  } catch (err) {
    console.error("[ADMIN] Cache stats error:", err);
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

/* ============================================================================
   🧠 System Stats & History
   ========================================================================== */

/**
 * Get ML model + system history
 * GET /api/admin/system/stats
 */
router.get("/system/stats", async (req, res) => {
  try {
    const System = (await import("../models/System.js")).default;
    const stats = await System.getSystemStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error("[ADMIN] System stats error:", err);
    res.status(500).json({ error: "Failed to get system stats" });
  }
});

/* ============================================================================
   💥 Error Logger
   ========================================================================== */

router.use(errorLogger);

export default router;

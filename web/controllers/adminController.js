import crypto from "crypto";
import axios from "axios";
import axiosRetry from "axios-retry";
import pLimit from "p-limit";
import Product from "../models/Products.js";
import System from "../models/System.js";
import { classifyProduct } from "../services/classificationOrchestrator.js";
import { getCachedData, setCachedData } from "../utils/cache.js";
import { requestDuration } from "../middlewares/logging.js";
import { APP_CONFIG } from "../config/appConfig.js";

/* ============================================================================
   🔧 Configuration Constants
   ========================================================================== */
const CONCURRENCY_LIMIT = APP_CONFIG.BULK_CONCURRENCY_LIMIT;
const ANALYTICS_CACHE_TTL = APP_CONFIG.ANALYTICS_CACHE_TTL;
const ML_SERVICE_TIMEOUT = APP_CONFIG.ML_SERVICE_TIMEOUT;

/* ============================================================================
   🧠 Secure Compare Utility
   ========================================================================== */
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/* ============================================================================
   ⚙️ Axios Retry Config (for ML service resiliency)
   ========================================================================== */
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

/* ============================================================================
   🔐 Admin Login
   ========================================================================== */
export async function loginAdmin(req, res) {
  const start = Date.now();
  try {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: "API key is required" });

    if (timingSafeCompare(apiKey, process.env.ADMIN_API_KEY)) {
      const duration = Date.now() - start;
      console.info(`[ADMIN] ✅ Login successful - ${duration}ms`);
      return res.json({ success: true, token: process.env.ADMIN_API_KEY });
    }

    return res.status(401).json({ error: "Invalid API key" });
  } catch (error) {
    console.error(`[ADMIN] ❌ Login error:`, error);
    res.status(500).json({ error: "Login failed" });
  }
}

/* ============================================================================
   📦 Get Paginated Products
   ========================================================================== */
export async function getProductsForAdmin(req, res) {
  const start = Date.now();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { vendor: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.category) query.classifiedCategory = req.query.category;
    if (req.query.minConfidence || req.query.maxConfidence) {
      query.confidence = {};
      if (req.query.minConfidence)
        query.confidence.$gte = Number(req.query.minConfidence);
      if (req.query.maxConfidence)
        query.confidence.$lte = Number(req.query.maxConfidence);
    }

    const products = await Product.find(query)
      .select(
        "title classifiedCategory confidence vendor updatedAt shopifyProductId classificationMethod tags"
      )
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 })
      .lean();

    const total = await Product.countDocuments(query);
    const duration = Date.now() - start;

    requestDuration.observe(
      { method: "GET", route: "/products", status: 200 },
      duration
    );

    res.json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: products,
      _meta: { duration: `${duration}ms` },
    });
  } catch (error) {
    console.error(`[ADMIN] Get products error:`, error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

/* ============================================================================
   🔍 Get Single Product Details
   ========================================================================== */
export async function getProductDetails(req, res) {
  const start = Date.now();
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });

    const duration = Date.now() - start;
    requestDuration.observe(
      { method: "GET", route: "/products/:id", status: 200 },
      duration
    );

    res.json({ success: true, product, _meta: { duration: `${duration}ms` } });
  } catch (error) {
    console.error(`[ADMIN] Product detail error:`, error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
}

/* ============================================================================
   🤖 Reclassify Product
   ========================================================================== */
export async function reclassifyProduct(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const result = await classifyProduct(product);
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        classifiedCategory: result.classifiedCategory,
        confidence: result.confidence,
        classificationMethod: result.classificationMethod,
        updatedAt: new Date(),
      },
      { new: true }
    );

    const duration = Date.now() - start;
    requestDuration.observe(
      { method: "POST", route: "/products/:id/reclassify", status: 200 },
      duration
    );

    res.json({
      success: true,
      product: updatedProduct,
      _meta: { duration: `${duration}ms` },
    });
  } catch (error) {
    console.error(`[ADMIN] Reclassification error:`, error);
    res.status(500).json({ error: "Failed to reclassify product" });
  }
}

/* ============================================================================
   ✏️ Manual Override Classification
   ========================================================================== */
export async function overrideClassification(req, res) {
  const start = Date.now();
  try {
    const { id } = req.params;
    const { category, reason } = req.body;
    if (!category)
      return res.status(400).json({ error: "Category is required" });

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        classifiedCategory: category,
        confidence: 1.0,
        classificationMethod: "manual_override",
        overrideReason: reason || "Manual admin override",
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ error: "Not found" });

    const duration = Date.now() - start;
    res.json({
      success: true,
      product: updatedProduct,
      _meta: { duration: `${duration}ms` },
    });
  } catch (error) {
    console.error(`[ADMIN] Override error:`, error);
    res.status(500).json({ error: "Failed to override classification" });
  }
}

/* ============================================================================
   📊 Analytics (with TTL cache)
   ========================================================================== */
export async function getAnalytics(req, res) {
  const start = Date.now();
  try {
    const cacheKey = "admin:analytics";
    const cached = await getCachedData(cacheKey);

    if (cached) {
      const duration = Date.now() - start;
      return res.json({
        ...cached,
        _meta: { cached: true, duration: `${duration}ms` },
      });
    }

    const [result] = await Product.aggregate([
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          byCategory: [
            { $group: { _id: "$classifiedCategory", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byMethod: [
            { $group: { _id: "$classificationMethod", count: { $sum: 1 } } },
          ],
          confidenceByCategory: [
            { $match: { confidence: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: "$classifiedCategory",
                avgConfidence: { $avg: "$confidence" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const totalProducts = result.totalCount[0]?.count || 0;
    const responseData = {
      success: true,
      analytics: {
        totalProducts,
        byCategory: result.byCategory,
        byMethod: result.byMethod,
        confidenceByCategory: result.confidenceByCategory,
      },
    };

    await setCachedData(cacheKey, responseData, ANALYTICS_CACHE_TTL);
    const duration = Date.now() - start;

    res.json({
      ...responseData,
      _meta: { cached: false, duration: `${duration}ms` },
    });
  } catch (error) {
    console.error(`[ADMIN] Analytics error:`, error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

/* ============================================================================
   🔄 Bulk Reclassify (Limited Concurrency)
   ========================================================================== */
export async function bulkReclassifyProducts(req, res) {
  const start = Date.now();
  try {
    const { productIds, filter } = req.body;
    let query = {};

    if (productIds && productIds.length > 0) {
      if (productIds.length > 100)
        return res.status(400).json({ error: "Max 100 products" });
      query._id = { $in: productIds };
    } else if (filter) {
      query = filter;
      const count = await Product.countDocuments(query);
      if (count > 100)
        return res.status(400).json({ error: `Filter matches ${count}` });
    } else return res.status(400).json({ error: "Provide productIds or filter" });

    const products = await Product.find(query);
    if (products.length === 0)
      return res.status(404).json({ error: "No products found" });

    const results = { total: products.length, successful: 0, failed: 0, errors: [] };
    const limitConcurrency = pLimit(CONCURRENCY_LIMIT);

    await Promise.all(
      products.map((p) =>
        limitConcurrency(async () => {
          try {
            const r = await classifyProduct(p);
            await Product.findByIdAndUpdate(p._id, {
              classifiedCategory: r.classifiedCategory,
              confidence: r.confidence,
              classificationMethod: r.classificationMethod,
              updatedAt: new Date(),
            });
            results.successful++;
          } catch (err) {
            results.failed++;
            results.errors.push({ id: p._id, error: err.message });
          }
        })
      )
    );

    const duration = Date.now() - start;
    res.json({ success: true, results, _meta: { duration: `${duration}ms` } });
  } catch (error) {
    console.error(`[ADMIN] Bulk reclassify error:`, error);
    res.status(500).json({ error: "Failed to bulk reclassify products" });
  }
}

/* ============================================================================
   🧠 Retrain ML Model (Tracked)
   ========================================================================== */
export async function retrainModel(req, res) {
  const start = Date.now();
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL;
    if (!mlServiceUrl)
      return res.status(500).json({ error: "ML service URL not configured" });

    const stats = await Product.aggregate([
      {
        $match: {
          classifiedCategory: { $exists: true, $ne: null, $ne: "" },
          confidence: { $gte: 0.7 },
        },
      },
      { $group: { _id: "$classifiedCategory", count: { $sum: 1 } } },
    ]);
    const totalTrainingData = stats.reduce((sum, s) => sum + s.count, 0);

    const response = await axios.post(
      `${mlServiceUrl}/retrain`,
      { minConfidence: 0.7, includeManualOverrides: true },
      {
        timeout: ML_SERVICE_TIMEOUT,
        headers: { Authorization: `Bearer ${process.env.ML_SERVICE_API_KEY || ""}` },
      }
    );

    await System.updateMLModelInfo({
      accuracy: response.data.accuracy,
      trainingDataCount: totalTrainingData,
      modelVersion: response.data.version || "1.0",
      notes: "Model retrained via admin API",
      metadata: {
        categoryDistribution: stats,
        retrainedBy: "admin",
        metrics: response.data.metrics || {},
        retrainDurationMs: Date.now() - start,
      },
    });

    const duration = Date.now() - start;
    res.json({
      success: true,
      message: "Model retrained successfully",
      trainingStats: { totalProducts: totalTrainingData, byCategory: stats },
      modelMetrics: {
        accuracy: response.data.accuracy,
        version: response.data.version,
        timestamp: new Date().toISOString(),
      },
      _meta: { duration: `${duration}ms` },
    });
  } catch (error) {
    console.error(`[ADMIN] Retrain error:`, error);
    if (error.code === "ECONNREFUSED")
      return res.status(503).json({ error: "ML service unavailable" });
    if (error.response)
      return res.status(error.response.status).json({
        error: error.response.data?.error || "ML service error",
      });
    res.status(500).json({ error: "Failed to retrain model" });
  }
}

/* ============================================================================
   📊 Get ML Model Status (Local + Remote)
   ========================================================================== */
export async function getModelStatus(req, res) {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL;
    const localModelInfo = await System.getMLModelInfo();

    if (!mlServiceUrl) {
      return res.json({
        success: true,
        status: "offline",
        localModelInfo,
        summary: {
          version: localModelInfo?.modelVersion,
          accuracy: localModelInfo?.accuracy,
          lastRetrainedAt: localModelInfo?.lastRetrainedAt,
        },
      });
    }

    try {
      const response = await axios.get(`${mlServiceUrl}/status`, {
        timeout: 10000,
        headers: { Authorization: `Bearer ${process.env.ML_SERVICE_API_KEY || ""}` },
      });

      res.json({
        success: true,
        status: "online",
        serviceStatus: response.data,
        localModelInfo,
        summary: {
          version: localModelInfo?.modelVersion,
          accuracy: localModelInfo?.accuracy,
          lastRetrainedAt: localModelInfo?.lastRetrainedAt,
        },
      });
    } catch {
      res.json({
        success: true,
        status: "offline",
        message: "ML service unavailable",
        localModelInfo,
      });
    }
  } catch (error) {
    console.error(`[ADMIN] Get model status error:`, error);
    res.status(500).json({ error: "Failed to fetch model status" });
  }
}

/**
 * Centralized configuration for admin module
 * All values can be overridden by environment variables
 */

export const APP_CONFIG = {
  // ⚙️ General
  NODE_ENV: process.env.NODE_ENV || "development",
  ENABLE_METRICS: process.env.ENABLE_METRICS === "true",

  // 🧠 ML Service
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || "",
  ML_SERVICE_API_KEY: process.env.ML_SERVICE_API_KEY || "",
  ML_SERVICE_TIMEOUT: Number(process.env.ML_SERVICE_TIMEOUT) || 300000, // 5 min

  // 📦 Bulk operations
  BULK_CONCURRENCY_LIMIT: Number(process.env.BULK_CONCURRENCY_LIMIT) || 5,
  BULK_BATCH_LIMIT: Number(process.env.BULK_BATCH_LIMIT) || 100,

  // 📊 Caching
  ANALYTICS_CACHE_TTL: Number(process.env.ANALYTICS_CACHE_TTL) || 300, // 5 min

  // 🔒 Rate limiting
  LOGIN_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  LOGIN_RATE_LIMIT_MAX: 5,
  API_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  API_RATE_LIMIT_MAX: 100,
  STRICT_RATE_LIMIT_WINDOW: 60 * 60 * 1000, // 1 hour
  STRICT_RATE_LIMIT_MAX: 10,

  // 🪣 Redis
  REDIS_URL: process.env.REDIS_URL || null,
};

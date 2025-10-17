import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";
import client from "prom-client"; // optional Prometheus metrics

/* ============================================================================
   🚀 Redis Connection Manager
   ========================================================================== */

let redisClient = null;

async function getRedisClient() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("📝 Rate Limiting: Using in-memory store (development mode)");
    return null;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("❌ Redis: Max reconnection attempts reached");
            return new Error("Redis connection failed");
          }
          return Math.min(retries * 200, 3000);
        },
      },
    });

    redisClient.on("connect", () => console.log("✅ Redis connected for rate limiting"));
    redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("❌ Redis connection failed:", error);
    console.log("📝 Falling back to in-memory rate limiting");
    return null;
  }
}

/* ============================================================================
   📊 Prometheus Metrics (optional)
   ========================================================================== */

const rateLimitHits = new client.Counter({
  name: "rate_limit_hits_total",
  help: "Number of rate limit hits (429 responses)",
  labelNames: ["scope", "ip"],
});

/* ============================================================================
   ⚙️ Utility — Build Redis-backed Limiter
   ========================================================================== */

async function buildLimiter(config, scope, redisPrefix) {
  const redis = await getRedisClient();

  const limiterConfig = {
    ...config,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = req.rateLimit?.resetTime
        ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        : 60;
      rateLimitHits.inc({ scope, ip: req.ip });
      res.setHeader("X-RateLimit-Scope", scope);
      return res.status(429).json({
        error: config.message?.error || "Rate limit exceeded",
        retryAfter,
        limit: req.rateLimit?.limit,
        remaining: req.rateLimit?.remaining,
      });
    },
    keyGenerator: (req) =>
      req.headers["x-forwarded-for"] ||
      req.ip ||
      "unknown-ip",
  };

  if (redis) {
    limiterConfig.store = new RedisStore({
      // @ts-expect-error — known type issue
      client: redis,
      prefix: `${process.env.NODE_ENV || "dev"}:${redisPrefix}`,
    });
    console.log(`✅ ${scope} limiter: Using Redis store`);
  } else {
    console.log(`📝 ${scope} limiter: Using in-memory store`);
  }

  return rateLimit(limiterConfig);
}

/* ============================================================================
   🧩 Specific Limiters
   ========================================================================== */

/**
 * 🧱 Login Limiter
 * - 5 login attempts per 15 minutes per IP
 * - Skips successful logins
 */
export async function createLoginRateLimite() {
  return buildLimiter(
    {
      windowMs: 15 * 60 * 1000, // 15 min
      max: 5,
      skipSuccessfulRequests: true,
      message: { error: "Too many login attempts. Please try again later." },
    },
    "login",
    "rl:login:"
  );
}

/**
 * ⚙️ API Limiter
 * - 100 requests per 15 minutes per IP
 * - Used for general admin API calls
 */
export async function createApiRateLimiter() {
  return buildLimiter(
    {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: "Too many requests. Please slow down." },
    },
    "admin-api",
    "rl:api:"
  );
}

/**
 * 🧠 Strict Limiter
 * - 10 operations per hour per IP
 * - Used for heavy endpoints (bulk reclassification, ML retraining)
 */
export async function createStrictRateLimiter() {
  return buildLimiter(
    {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10,
      message: { error: "Too many sensitive operations. Please try again later." },
    },
    "strict",
    "rl:strict:"
  );
}

/* ============================================================================
   🧹 Graceful Shutdown
   ========================================================================== */
export async function closeRateLimiter() {
  if (redisClient) {
    await redisClient.quit();
    console.log("✅ Redis connection for rate limiter closed");
  }
}

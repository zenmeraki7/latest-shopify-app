/**
 * 🧠 Cache Utility — Redis + In-Memory Hybrid
 * ------------------------------------------
 * - Uses Redis in production for distributed caching
 * - Falls back to in-memory Map() for local or dev mode
 * - Includes graceful error handling, reconnection, metrics, and TTL enforcement
 */

let redisClient = null;
const inMemoryCache = new Map();

// Configuration
const MAX_IN_MEMORY_ITEMS = Number(process.env.CACHE_MAX_ITEMS || 100);
const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 300);

/* ============================================================================
   🚀 Initialize Redis Client (lazy + fault-tolerant)
   ========================================================================== */
export async function initializeCache() {
  if (!process.env.REDIS_URL) {
    console.info("[CACHE] 🧩 Using in-memory cache (no REDIS_URL configured)");
    return;
  }

  try {
    const redis = await import("redis");
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error("[CACHE] ❌ Redis reconnection failed after 3 attempts");
            return new Error("Redis reconnection limit reached");
          }
          return Math.min(retries * 200, 3000);
        },
      },
    });

    redisClient.on("connect", () => console.info("[CACHE] ✅ Redis connected"));
    redisClient.on("error", (err) => {
      console.error("[CACHE] ⚠️ Redis error:", err.message);
      redisClient = null; // failover to in-memory
    });

    await redisClient.connect();
  } catch (err) {
    console.warn("[CACHE] ⚠️ Redis unavailable — using in-memory fallback:", err.message);
    redisClient = null;
  }
}

/* ============================================================================
   📥 Get Cached Data
   ========================================================================== */
export async function getCachedData(key) {
  try {
    // Try Redis first
    if (redisClient?.isOpen) {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
      return null;
    }

    // In-memory fallback
    const cached = inMemoryCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }

    return cached.data;
  } catch (err) {
    console.error(`[CACHE] ❌ Failed to get key '${key}':`, err.message);
    return null;
  }
}

/* ============================================================================
   📤 Set Cached Data
   ========================================================================== */
export async function setCachedData(key, data, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    const ttl = Math.max(1, ttlSeconds);

    if (redisClient?.isOpen) {
      await redisClient.setEx(key, ttl, JSON.stringify(data));
      return;
    }

    // In-memory fallback
    inMemoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttl * 1000,
    });

    // Evict oldest entries if exceeding max
    if (inMemoryCache.size > MAX_IN_MEMORY_ITEMS) {
      const oldestKey = inMemoryCache.keys().next().value;
      inMemoryCache.delete(oldestKey);
    }
  } catch (err) {
    console.error(`[CACHE] ❌ Failed to set key '${key}':`, err.message);
  }
}

/* ============================================================================
   🗑️ Delete Cached Data
   ========================================================================== */
export async function deleteCachedData(key) {
  try {
    if (redisClient?.isOpen) await redisClient.del(key);
    inMemoryCache.delete(key);
  } catch (err) {
    console.error(`[CACHE] ❌ Failed to delete key '${key}':`, err.message);
  }
}

/* ============================================================================
   🧹 Clear Entire Cache
   ========================================================================== */
export async function clearCache() {
  try {
    if (redisClient?.isOpen) await redisClient.flushAll();
    inMemoryCache.clear();
    console.info("[CACHE] 🧽 Cache cleared");
  } catch (err) {
    console.error("[CACHE] ❌ Failed to clear cache:", err.message);
  }
}

/* ============================================================================
   📊 Cache Stats (for metrics dashboards)
   ========================================================================== */
export function getCacheStats() {
  return {
    backend: redisClient?.isOpen ? "redis" : "in-memory",
    inMemoryEntries: inMemoryCache.size,
    redisConnected: Boolean(redisClient?.isOpen),
  };
}

/* ============================================================================
   🕒 Expiration Sweeper — runs every 5 minutes
   ========================================================================== */
setInterval(() => {
  const now = Date.now();
  let expired = 0;
  for (const [key, value] of inMemoryCache.entries()) {
    if (value.expiresAt && now > value.expiresAt) {
      inMemoryCache.delete(key);
      expired++;
    }
  }
  if (expired > 0) console.info(`[CACHE] 🧹 Cleaned ${expired} expired items`);
}, 5 * 60 * 1000);

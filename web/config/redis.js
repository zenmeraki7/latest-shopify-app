import IORedis from "ioredis";

// Create a reusable Redis connection instance
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Recommended for BullMQ
  enableReadyCheck: false,    // Recommended for BullMQ
});


// Optional: Log connection status
redisConnection.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

import IORedis from "ioredis";

// Create a reusable Redis connection instance
export const redisConnection = new IORedis({
  host: "127.0.0.1",   // Redis server host (use your Redis host if remote)
  port: 6379,          // Default Redis port
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

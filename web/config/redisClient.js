// config/redisClient.js
import { createClient } from "redis";

let client;

if (!client) {
  client = createClient({ url: process.env.REDIS_URL });

  client.on("error", (err) => console.error("Redis Client Error", err));
}

export default client;

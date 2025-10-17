import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js"; // your redis config
import { categoriseWorker } from "./workers/categoriseWorker.js"; // ensure worker is imported

export const categoriseQueue = new Queue("categoriseQueue", {
  connection: redisConnection,
});

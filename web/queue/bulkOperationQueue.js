import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { bulkOperationWorker } from "./workers/bulkOperationWorker.js";

export const bulkOperationQueue = new Queue("bulkoperationQueue", {
  connection: redisConnection,
});

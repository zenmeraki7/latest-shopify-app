import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { appInstallationWorker } from "./workers/appInstallationWorker.js";

export const appInstallationQueue = new Queue("appInstallationQueue", {
  connection: redisConnection,
});

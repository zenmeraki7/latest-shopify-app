import dayjs from "dayjs";
import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis.js";
import Store from "../../models/Store.js";
import { ShopifyService } from "../../services/shopifyService.js";
import { getSession } from "../../utils/shopifyUtils.js";

export const bulkOperationWorker = new Worker(
  "bulkoperationQueue",
  async (job) => {
    try {
      const payload = JSON.parse(job.data);
      const { admin_graphql_api_id } = payload;
      if (payload.type === "query") {
        const store = await Store.findOne({
          bulkOperationId: admin_graphql_api_id,
        }).select("shopUrl accessToken");
        if (!store) {
          console.warn("Store not found for bulk operation ID");
        }

        const service = new ShopifyService(store.shopUrl, store.accessToken);

        const session = await getSession(store.shopUrl);
        if (!session) {
          throw new Error("No active session found for shop");
        }
        // Fetch bulk operation details using ID
        const bulkOpDetails = await service.getBulkOperationById(
          admin_graphql_api_id,
          session
        );

        if (!bulkOpDetails.url) {
          throw new Error("Bulk operation URL not ready yet");
        }

        // Download and store products
        const result = await service.downloadAndStoreProducts(
          bulkOpDetails.url
        );
        return result;
      } else {
        return null;
      }
    } catch (err) {
      throw err; // let Bull mark the job as failed and trigger retries
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

const logTime = () => `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`;
if (process.env.NODE_ENV != "production") {
  bulkOperationWorker
    .on("error", (err) => {
      console.error(
        `${logTime()} ❌ Queue Error in bulkoperation process:`,
        err.message
      );
    })
    .on("waiting", (jobId) => {
      console.log(
        `${logTime()} ⏳ in bulkoperation process- Job waiting to be processed | Job ID: ${jobId}`
      );
    })
    .on("active", (job) => {
      console.log(
        `${logTime()} 🚀in bulkoperation process - Job started | Job ID: ${
          job.id
        }`
      );
    })
    .on("completed", (job, result) => {
      console.log(
        `${logTime()} ✅ in bulkoperation process - Job completed | Job ID: ${
          job.id
        } | Result:`,
        result
      );
    })
    .on("failed", (job, err) => {
      console.log(
        `${logTime()} ❗ Job failed in bulkoperation process | Job ID: ${
          job.id
        } | Error:`,
        err.message,
        err
      );
    });
}

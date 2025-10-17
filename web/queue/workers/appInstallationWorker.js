import dayjs from "dayjs";
import { Worker } from "bullmq";
import { redisConnection } from "../../config/redis.js";
import { getShopOwnerEmailAddress } from "../../utils/shopifyUtils.js";
import { ShopifyService } from "../../services/shopifyService.js";
import Store from "../../models/Store.js";

export const appInstallationWorker = new Worker(
  "appInstallationQueue",
  async (job) => {
    try {
      const session = job.data.session;
      const shop = session.shop;
      const accessToken = session.accessToken;
      const { email, shopOwner, name } = await getShopOwnerEmailAddress(
        session
      );
      const shopifyService = new ShopifyService(shop, accessToken);

      const bulkStartResult =
        await shopifyService.startBulkOperationToFetchProducts();

      await Store.findOneAndUpdate(
        { shopUrl: shop },
        {
          accessToken,
          name,
          bulkOperationId: bulkStartResult.bulkOperationId,
          email,
          shopOwner,
          isProductsSyncing: true,
        },
        { upsert: true }
      );
      return { message: "App installation confirmed" };
    } catch (err) {
      throw err; // let Bull mark the job as failed and trigger retries
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

const logTime = () => `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}]`;
if (process.env.NODE_ENV != "production") {
  appInstallationWorker
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
      console.error(
        `${logTime()} ❗ Job failed in bulkoperation process | Job ID: ${
          job.id
        } | Error:`,
        err.message
      );
    });
}

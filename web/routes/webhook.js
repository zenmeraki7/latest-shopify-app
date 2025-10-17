import express from "express";
import crypto from "crypto";
import { ShopifyService } from "../services/shopifyService.js";
import Store from "../models/Store.js";

const router = express.Router();

// Shopify webhook verification middleware
// function verifyShopifyWebhook(req, res, next) {
//   const hmac = req.get("X-Shopify-Hmac-Sha256");
//   const body = JSON.stringify(req.body);
//   const hash = crypto
//     .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
//     .update(body, "utf8")
//     .digest("base64");

//   if (hash !== hmac) {
//     return res.status(401).send("Unauthorized");
//   }
//   next();
// }

// Webhook handler for BULK_OPERATIONS_FINISH
router.post("/bulk-finish", async (req, res) => {
  try {
    const { admin_graphql_api_id } = req.body;
    console.log("🪝 Bulk operation finished:", admin_graphql_api_id);

    const store = await Store.findOne({
      bulkOperationId: admin_graphql_api_id,
    });
    if (!store) {
      console.warn("Store not found for bulk operation ID");
      return res.status(404).send("Store not found");
    }

    const service = new ShopifyService(store.shopUrl, store.accessToken);

    // Fetch bulk operation details using ID
    const bulkOpDetails = await service.getBulkOperationById(
      admin_graphql_api_id
    );
    console.log("Bulk operation details:", bulkOpDetails);

    if (!bulkOpDetails.url) {
      console.warn("Bulk operation URL not ready yet");
      return res.status(400).send("Bulk operation URL not ready");
    }

    // Download and store products
    await service.downloadAndStoreProducts(bulkOpDetails.url);

    res.status(200).send("Products synced successfully");
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).send("Error processing webhook");
  }
});
export default router;

// backend/services/shopifyService.js
import axios from "axios";
import Product from "../models/Product.js";
import { graphqlProductsAllFieldQuery } from "../config/graphqlQuery.js";
import readline from "readline";
import shopify from "../shopify.js";

export class ShopifyService {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.endpoint = `https://${shop}/admin/api/2025-10/graphql.json`;
  }

  /**
   * 🔹 Step 1: Start Bulk Operation to fetch products
   */
  async startBulkOperationToFetchProducts() {
    try {
      const bulkQuery = `
        mutation {
          bulkOperationRunQuery(
            query: """
            ${graphqlProductsAllFieldQuery}
            """
          ) {
            bulkOperation {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }`;

      const response = await axios.post(
        this.endpoint,
        { query: bulkQuery },
        {
          headers: {
            "X-Shopify-Access-Token": this.accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data?.data?.bulkOperationRunQuery;
      if (!data?.bulkOperation) {
        const errorMsg = data?.userErrors?.map((e) => e.message).join(", ");
        throw new Error(errorMsg || "Failed to start bulk operation");
      }

      return {
        message: "Bulk product sync started",
        bulkOperationId: data.bulkOperation.id,
        status: data.bulkOperation.status,
      };
    } catch (error) {
      throw new Error(`Bulk operation error: ${error.message}`);
    }
  }

  /**
   * 🔹 Step 3: Download and store products (called when webhook triggers)
   */
  async getBulkOperationById(bulkOperationId, session) {
    try {
      const client = new shopify.api.clients.Graphql({ session });

      const query = `
      {
        node(id: "${bulkOperationId}") {
          ... on BulkOperation {
            id
            status
            url
            partialDataUrl
            objectCount
            createdAt
            completedAt
            errorCode
          }
        }
      }`;

      const response = await client.query({ data: query });

      const bulkOp = response?.body?.data?.node;
      if (!bulkOp) throw new Error("Bulk operation not found");

      return bulkOp;
    } catch (err) {
      throw new Error(`Failed to fetch bulk operation: ${err.message}`);
    }
  }

  async downloadAndStoreProducts(url) {
    console.log("⬇️  Downloading bulk operation data from:", url);

    try {
      const response = await axios.get(url, { responseType: "stream" });
      const rl = readline.createInterface({ input: response.data });

      const bulkOps = [];
      let totalCount = 0;
      const BATCH_SIZE = 500;

      for await (const line of rl) {
        if (!line.trim()) continue;

        const p = JSON.parse(line);
        bulkOps.push({
          updateOne: {
            filter: { shopifyId: p.id },
            update: {
              $set: {
                shopifyId: p.id,
                title: p.title,
                handle: p.handle,
                productType: p.productType,
                tags: p.tags || [],
                category: p.category?.fullName || null,
                imageUrl: p.featuredMedia?.preview?.image?.url || null,
                seoTitle: p.seo?.title || "",
                seoDescription: p.seo?.description || "",
                shop: this.shop,
              },
            },
            upsert: true,
          },
        });

        totalCount++;

        if (bulkOps.length >= BATCH_SIZE) {
          await Product.bulkWrite(bulkOps, { ordered: false });
          console.log(`✅ Processed ${totalCount} products...`);
          bulkOps.length = 0;
        }
      }

      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps, { ordered: false });
      }

      console.log(
        `🎯 Completed syncing ${totalCount} products for ${this.shop}`
      );
      return {
        message: "Products synced successfully",
        count: totalCount,
      };
    } catch (error) {
      throw new Error(`Download/store failed: ${error.message}`);
    }
  }
}

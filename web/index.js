// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import productRoutes from "./routes/products.js";
import categoryRoutes from "./routes/category.js";
import merchantsRoutes from "./routes/store.js";
import client from "./config/redisClient.js"; // ✅ Redis Cloud client
import { appInstallMiddleware } from "./middlewares/appInstallMiddleware.js";

dotenv.config();

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Test Redis connection
app.get("/test-redis", async (req, res) => {
  try {
    await client.set("connection", "Redis Cloud is working!");
    const result = await client.get("connection");
    res.send(result);
  } catch (err) {
    console.error("Redis test error:", err);
    res.status(500).send("Redis test failed");
  }
});

// ✅ Shopify authentication & webhooks
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  appInstallMiddleware,
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/admin/products", productRoutes);
app.use("/api/category", categoryRoutes);
app.use("/admin/merchant", merchantsRoutes);

app.get("/api/products/count", async (_req, res) => {
  const gqlClient = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });
  const countData = await gqlClient.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);
  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  try {
    await productCreator(res.locals.shopify.session);
    res.status(200).send({ success: true });
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    res.status(500).send({ success: false, error: e.message });
  }
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

// ✅ Connect to MongoDB, then start server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    await client.connect();
    console.log("✅ Redis Cloud connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start app:", error);
  }
}

startServer();

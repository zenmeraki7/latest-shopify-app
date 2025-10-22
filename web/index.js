// @ts-check
// IMPORTANT: Load dotenv FIRST, before any other imports that need env variables
import dotenv from "dotenv";
dotenv.config();

// Add debug logging
console.log("MONGO_URI loaded:", !!process.env.MONGO_URI);

// Now import everything else
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import mongoose from "mongoose";
import cors from "cors";

import shopify from "./shopify.js";  // This now has access to env variables
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import productRoutes from "./routes/products.js";
import categoryRoutes from "./routes/category.js";
import merchantsRoutes from "./routes/store.js";
import { appInstallMiddleware } from "./middlewares/appInstallMiddleware.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();
app.use(cors());

// Set up Shopify authentication and webhook handling
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

app.use(express.json());

app.use("/admin/products", productRoutes);
app.use("/api/category", categoryRoutes);
app.use("/admin/merchant", merchantsRoutes);

app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.log(`Failed to process products/create: ${errorMessage}`);
    status = 500;
    error = errorMessage;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment");
    return;
  }
  
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));
});
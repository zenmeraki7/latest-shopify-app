// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import cors from "cors";
import dotenv from "dotenv";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";

// 🧠 Admin Imports
import adminRoutes from "./routes/admin.js";
// import { adminCors } from "./middlewares/adminAuth.js";
import { errorLogger, metricsHandler } from "./middlewares/logging.js";
import { initializeCache } from "./utils/cache.js";

dotenv.config();

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);
const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

/* ============================================================================
   ⚙️ GLOBAL MIDDLEWARE
   ========================================================================== */

// Regular CORS for merchant-facing Shopify routes
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ============================================================================
   🔐 SHOPIFY APP ROUTES
   ========================================================================== */

// Authentication + Webhooks
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// All /api/* routes require a valid Shopify session
app.use("/api/*", shopify.validateAuthenticatedSession());

/* ============================================================================
   🧩 SHOPIFY EXAMPLE ROUTES (for testing)
   ========================================================================== */

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
  try {
    await productCreator(res.locals.shopify.session);
    res.status(200).send({ success: true });
  } catch (e) {
    console.error(`Failed to create products: ${e.message}`);
    res.status(500).send({ success: false, error: e.message });
  }
});

/* ============================================================================
   🧠 ADMIN API ROUTES (Non-Shopify)
   ========================================================================== */

// Admin routes use their own CORS + API key auth (not Shopify session)
// app.use("/api/admin", adminCors);
app.use("/api/admin", adminRoutes);

/* ============================================================================
   📈 METRICS ENDPOINT (Prometheus)
   ========================================================================== */
app.get("/metrics", metricsHandler);

/* ============================================================================
   🌐 FRONTEND (Shopify Embedded App)
   ========================================================================== */
app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

/* ============================================================================
   💥 ERROR HANDLING
   ========================================================================== */
app.use(errorLogger);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ============================================================================
   🚀 SERVER STARTUP
   ========================================================================== */
async function startServer() {
  try {
    await initializeCache();
    console.info("[SERVER] ✅ Cache initialized");

    app.listen(PORT, () => {
      console.info(`\n🌍 Server running on port ${PORT}`);
      console.info(`🛍 Shopify app at /`);
      console.info(`🔐 Admin API at /api/admin`);
      if (process.env.ENABLE_METRICS === "true")
        console.info(`📈 Prometheus metrics at /metrics`);
    });
  } catch (err) {
    console.error("[SERVER] ❌ Startup failed:", err);
    process.exit(1);
  }
}

startServer();

export default app;

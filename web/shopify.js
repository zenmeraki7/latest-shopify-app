import { BillingInterval } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoClient } from "mongodb";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "shopify-app";
const SESSIONS_COLLECTION = "sessions";

let mongoClient;
let db;

// Initialize MongoDB connection
async function initializeDatabase() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  
  // Create index for faster queries
  await db.collection(SESSIONS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(SESSIONS_COLLECTION).createIndex({ shop: 1 });
}

// MongoDB Session Storage
class MongoDBSessionStorage {
  async storeSession(session) {
    const collection = db.collection(SESSIONS_COLLECTION);
    await collection.updateOne(
      { id: session.id },
      { $set: session },
      { upsert: true }
    );
  }

  async loadSession(id) {
    const collection = db.collection(SESSIONS_COLLECTION);
    const session = await collection.findOne({ id });
    return session || undefined;
  }

  async deleteSession(id) {
    const collection = db.collection(SESSIONS_COLLECTION);
    await collection.deleteOne({ id });
  }

  async deleteSessions(ids) {
    const collection = db.collection(SESSIONS_COLLECTION);
    await collection.deleteMany({ id: { $in: ids } });
  }

  async findSessionsByShop(shop) {
    const collection = db.collection(SESSIONS_COLLECTION);
    return await collection.find({ shop }).toArray();
  }
}

const billingConfig = {
  "My Shopify One-Time Charge": {
    amount: 5.0,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
};

// Initialize database before creating the app
await initializeDatabase();

const shopify = shopifyApp({
  api: {
    apiVersion: "2024-10",
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: new MongoDBSessionStorage(),
});

// Graceful shutdown
process.on("SIGINT", async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

export default shopify;
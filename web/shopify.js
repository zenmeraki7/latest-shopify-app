import { BillingInterval } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const sessionStorage = new MongoDBSessionStorage(process.env.MONGO_URI);

// Example billing configuration
const billingConfig = {
  "My Shopify One-Time Charge": {
    amount: 5.0,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
};

const shopify = shopifyApp({
  api: {
    apiVersion: "2024-10", // explicit version
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined, // or billingConfig
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage, // MongoDB session storage
});

export default shopify;

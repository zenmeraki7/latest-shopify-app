// ==========================================
// FILE: web/models/Shop.js
// ==========================================

import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    // Shopify shop domain (unique identifier)
    shopDomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    // Shop name
    name: {
      type: String,
      required: true,
    },

    // Shop owner email
    email: {
      type: String,
      required: true,
    },

    // Access token for API calls (encrypted)
    accessToken: {
      type: String,
      required: true,
    },

    // Shop scope/permissions
    scope: {
      type: String,
    },

    // Is the app currently installed?
    isActive: {
      type: Boolean,
      default: true,
    },

    // Shop plan/tier
    plan: {
      type: String,
      enum: ["basic", "shopify", "advanced", "plus"],
      default: "basic",
    },

    // Shop country
    country: {
      type: String,
    },

    // Shop currency
    currency: {
      type: String,
      default: "USD",
    },

    // Shop timezone
    timezone: {
      type: String,
    },

    // Shop owner information
    shopOwner: {
      type: String,
    },

    // Last sync date
    lastSync: {
      type: Date,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index for faster queries
shopSchema.index({ shopDomain: 1 });
shopSchema.index({ isActive: 1 });
shopSchema.index({ createdAt: -1 });

// Virtual for product count (if needed)
shopSchema.virtual("productCount", {
  ref: "Product",
  localField: "shopDomain",
  foreignField: "shop",
  count: true,
});

// Method to get shop stats
shopSchema.methods.getStats = async function() {
  const Product = mongoose.model("Product");
  
  const stats = await Product.aggregate([
    { $match: { shop: this.shopDomain } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        classifiedProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$classifiedCategory", null] },
                  { $ne: ["$classifiedCategory", ""] }
                ]
              },
              1,
              0
            ]
          }
        },
        lowConfidenceProducts: {
          $sum: {
            $cond: [{ $lt: ["$confidence", 0.7] }, 1, 0]
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalProducts: 0,
    classifiedProducts: 0,
    lowConfidenceProducts: 0
  };
};

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
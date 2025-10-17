import mongoose from 'mongoose';

/* ============================================================
   📦 PRODUCT MODEL - PRODUCTION OPTIMIZED
   Your schema + performance enhancements
   ============================================================ */

const productSchema = new mongoose.Schema(
  {
    // Shop reference (normalized - single source of truth)
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },

    // Shopify product GID
    shopifyProductId: {
      type: String,
      required: true,
      index: true,
    },

    // Product info
    title: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    handle: {
      type: String,
      trim: true,
      sparse: true,
    },

    featuredImage: {
      type: String,
      default: null,
    },

    // Product status (critical for Shopify)
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
      index: true,
    },

    // Category from custom metafield (optional)
    category: {
      type: String,
      index: true,
      trim: true,
      default: null,
    },

    // Flexible metafields storage
    metafields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Sync tracking
    syncedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Soft delete (optional but recommended)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: 'products',
  }
);

/* ============================================================
   📊 INDEXES - Performance Critical
   ============================================================ */

// Unique constraint: one product per shop
productSchema.index({ shopId: 1, shopifyProductId: 1 }, { unique: true });

// Full-text search
productSchema.index({ title: 'text' });

// Common query patterns
productSchema.index({ shopId: 1, status: 1, updatedAt: -1 });
productSchema.index({ status: 1, category: 1 });
productSchema.index({ syncedAt: -1 });
productSchema.index({ isDeleted: 1, status: 1 });

/* ============================================================
   🔧 INSTANCE METHODS
   ============================================================ */

/**
 * Soft delete
 */
productSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.status = 'archived';
  return this.save();
};

/**
 * Mark as synced
 */
productSchema.methods.markSynced = async function () {
  this.syncedAt = new Date();
  return this.save();
};

/**
 * Get full shop details
 */
productSchema.methods.getShopInfo = async function () {
  await this.populate('shopId');
  return this.shopId;
};

/* ============================================================
   📈 STATIC METHODS
   ============================================================ */

/**
 * Find active products by shop
 */
productSchema.statics.findByShop = function (shopId, options = {}) {
  const query = this.find({
    shopId,
    isDeleted: false,
    status: options.status || 'active',
  });
  
  if (options.limit) query.limit(options.limit);
  if (options.sort) query.sort(options.sort);
  if (options.populate) query.populate(options.populate);
  
  return query;
};

/**
 * Bulk upsert from Shopify sync
 */
productSchema.statics.bulkUpsertProducts = async function (products) {
  const operations = products.map(product => ({
    updateOne: {
      filter: {
        shopId: product.shopId,
        shopifyProductId: product.shopifyProductId,
      },
      update: {
        $set: {
          ...product,
          syncedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  return this.bulkWrite(operations, { ordered: false });
};

/**
 * Get category statistics
 */
productSchema.statics.getCategoryStats = async function (shopId = null) {
  const match = { isDeleted: false, status: 'active' };
  if (shopId) match.shopId = mongoose.Types.ObjectId(shopId);

  return this.aggregate([
    { $match: match },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
};

/**
 * Find stale products needing sync
 */
productSchema.statics.getStaleProducts = function (hoursThreshold = 24) {
  const cutoffDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  
  return this.find({
    isDeleted: false,
    status: { $in: ['active', 'draft'] },
    $or: [
      { syncedAt: { $exists: false } },
      { syncedAt: null },
      { syncedAt: { $lt: cutoffDate } },
    ],
  });
};

/* ============================================================
   🎯 MIDDLEWARE HOOKS
   ============================================================ */

// Auto-update syncedAt on save
productSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.syncedAt = new Date();
  }
  next();
});

/* ============================================================
   📤 VIRTUALS
   ============================================================ */

// Check if sync is stale (> 24 hours)
productSchema.virtual('isSyncStale').get(function () {
  if (!this.syncedAt) return true;
  const hoursSinceSync = (Date.now() - this.syncedAt.getTime()) / 3600000;
  return hoursSinceSync >= 24;
});

// Shopify Admin URL
productSchema.virtual('shopifyAdminUrl').get(function () {
  if (!this.shopifyProductId) return null;
  const productId = this.shopifyProductId.split('/').pop();
  return `https://admin.shopify.com/products/${productId}`;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

/* ============================================================
   📦 EXPORT
   ============================================================ */

const Product = mongoose.model('Product', productSchema);

export default Product;
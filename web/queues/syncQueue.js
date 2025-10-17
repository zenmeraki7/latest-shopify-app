import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import shopifyService from '../services/shopifyService.js';
import twoTierCache from '../services/twoTierCacheService.js';
import metricsService from '../services/metricsService.js';
import logger from '../utils/logger.js';

/* ============================================================
   🔄 SHOPIFY SYNC QUEUE - BullMQ
   Async, parallel, fault-tolerant product synchronization
   ============================================================ */

// Redis connection for BullMQ
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Queue configuration
const queueConfig = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
      count: 5000,
    },
  },
};

// Create queue and events
export const syncQueue = new Queue('shopify-sync', queueConfig);
export const syncEvents = new QueueEvents('shopify-sync', { connection });

/* ============================================================
   📝 JOB TYPES
   ============================================================ */

/**
 * Add shop sync job to queue
 */
export async function queueShopSync(shopId, priority = 5) {
  const job = await syncQueue.add(
    'sync-shop-products',
    { shopId, queuedAt: new Date().toISOString() },
    {
      jobId: `sync-${shopId}-${Date.now()}`,
      priority, // 1-10, lower = higher priority
    }
  );

  logger.info(`📥 [Queue] Shop sync queued: ${shopId} (Job ID: ${job.id})`);
  
  return {
    jobId: job.id,
    shopId,
    status: 'queued',
  };
}

/**
 * Add bulk sync job for multiple shops
 */
export async function queueBulkSync(shopIds, priority = 7) {
  const jobs = shopIds.map((shopId, index) => ({
    name: 'sync-shop-products',
    data: { shopId, queuedAt: new Date().toISOString() },
    opts: {
      jobId: `sync-${shopId}-${Date.now()}`,
      priority: priority + Math.floor(index / 10), // Stagger priorities
    },
  }));

  const addedJobs = await syncQueue.addBulk(jobs);
  
  logger.info(`📥 [Queue] Bulk sync queued: ${shopIds.length} shops`);
  
  return addedJobs.map(job => ({
    jobId: job.id,
    shopId: job.data.shopId,
    status: 'queued',
  }));
}

/**
 * Schedule periodic auto-sync for all active shops
 */
export async function scheduleAutoSync() {
  const shops = await Shop.find({
    accessToken: { $exists: true, $ne: null },
    isActive: true,
  }).select('_id shopDomain lastProductSync');

  const shopsNeedingSync = shops.filter(shop => {
    if (!shop.lastProductSync) return true;
    
    const hoursSinceSync = (Date.now() - shop.lastProductSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync >= 24; // Sync every 24 hours
  });

  if (shopsNeedingSync.length === 0) {
    logger.info('✅ [Auto-Sync] All shops are up to date');
    return { synced: 0 };
  }

  const shopIds = shopsNeedingSync.map(s => s._id.toString());
  await queueBulkSync(shopIds, 8); // Lower priority for auto-sync

  logger.info(`✅ [Auto-Sync] Queued ${shopIds.length} shops for sync`);
  
  return { synced: shopIds.length };
}

/* ============================================================
   👷 WORKER PROCESS
   ============================================================ */

export const syncWorker = new Worker(
  'shopify-sync',
  async (job) => {
    const { shopId } = job.data;
    const startTime = Date.now();

    logger.info(`🔄 [Worker] Starting sync for shop: ${shopId} (Job: ${job.id})`);

    try {
      // Update job progress
      await job.updateProgress(0);

      // Fetch shop with access token
      const shop = await Shop.findById(shopId).select('+accessToken').lean();

      if (!shop) {
        throw new Error(`Shop ${shopId} not found`);
      }

      if (!shop.accessToken) {
        throw new Error(`Shop ${shop.shopDomain} missing access token`);
      }

      const accessToken = shop.accessToken; // Add decryption if needed

      // Track progress
      let productsSynced = 0;
      let hasNextPage = true;
      let cursor = null;
      let pageCount = 0;
      const maxPages = 200;

      // GraphQL query
      const graphqlQuery = `
        query FetchProducts($cursor: String, $first: Int!) {
          products(first: $first, after: $cursor) {
            edges {
              node {
                id
                title
                handle
                status
                featuredImage { url }
                updatedAt
                metafields(namespace: "custom", first: 10) {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      // Pagination loop
      while (hasNextPage && pageCount < maxPages) {
        pageCount++;

        const response = await shopifyService.graphqlRequest(
          shop.shopDomain,
          accessToken,
          graphqlQuery,
          { first: 50, cursor }
        );

        const edges = response.data?.products?.edges || [];

        if (edges.length === 0) break;

        // Build bulk operations
        const bulkOps = edges.map(({ node }) => {
          const categoryMeta = node.metafields?.edges?.find(
            m => ['category', 'product_category'].includes(m.node.key)
          );

          return {
            updateOne: {
              filter: {
                shopId: shop._id,
                shopifyProductId: node.id,
              },
              update: {
                $set: {
                  shopId: shop._id,
                  shopifyProductId: node.id,
                  title: node.title,
                  handle: node.handle,
                  featuredImage: node.featuredImage?.url || null,
                  status: node.status?.toLowerCase() || 'active',
                  category: categoryMeta?.node?.value || null,
                  syncedAt: new Date(),
                  isDeleted: false,
                },
              },
              upsert: true,
            },
          };
        });

        // Execute bulk write
        await Product.bulkWrite(bulkOps, { ordered: false });
        productsSynced += bulkOps.length;

        // Update progress
        const progress = Math.min((pageCount / maxPages) * 100, 99);
        await job.updateProgress(progress);

        // Update pagination
        hasNextPage = response.data?.products?.pageInfo?.hasNextPage || false;
        cursor = response.data?.products?.pageInfo?.endCursor || null;

        // Rate limiting
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Store progress in Redis (for resume capability)
        await connection.setex(
          `sync:progress:${shopId}`,
          3600,
          JSON.stringify({ pageCount, productsSynced, cursor })
        );
      }

      // Update shop
      await Shop.updateOne(
        { _id: shop._id },
        { $set: { lastProductSync: new Date() } }
      );

      // Invalidate caches
      await twoTierCache.del(`admin:products:*${shop.shopDomain}*`);
      await twoTierCache.del('admin:stats:*');

      const durationMs = Date.now() - startTime;

      // Record metrics
      metricsService.recordSyncCompleted(shop.shopDomain, productsSynced, durationMs);

      // Complete job
      await job.updateProgress(100);

      logger.info(
        `✅ [Worker] Sync completed for ${shop.shopDomain}: ` +
        `${productsSynced} products in ${durationMs}ms`
      );

      return {
        shopId: shop._id.toString(),
        shopDomain: shop.shopDomain,
        productsSynced,
        durationMs,
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error({
        message: `❌ [Worker] Sync failed for shop ${shopId}`,
        error: error.stack || error.message,
        jobId: job.id,
      });

      metricsService.recordSyncFailed(shopId, durationMs);

      throw error; // BullMQ will retry based on config
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.SYNC_WORKER_CONCURRENCY || '5', 10),
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  }
);

/* ============================================================
   📊 EVENT LISTENERS
   ============================================================ */

syncEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info(`✅ [Event] Job completed: ${jobId}`);
  metricsService.incrementJobCounter('completed');
});

syncEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`❌ [Event] Job failed: ${jobId} - ${failedReason}`);
  metricsService.incrementJobCounter('failed');
});

syncEvents.on('progress', ({ jobId, data }) => {
  logger.debug(`🔄 [Event] Job progress: ${jobId} - ${data}%`);
});

syncWorker.on('error', (error) => {
  logger.error('❌ [Worker] Error:', error);
});

/* ============================================================
   🛠️ QUEUE MANAGEMENT
   ============================================================ */

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    syncQueue.getWaitingCount(),
    syncQueue.getActiveCount(),
    syncQueue.getCompletedCount(),
    syncQueue.getFailedCount(),
    syncQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
  const job = await syncQueue.getJob(jobId);
  
  if (!job) {
    return { found: false };
  }

  const state = await job.getState();
  
  return {
    found: true,
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress,
    state,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

/**
 * Pause queue
 */
export async function pauseQueue() {
  await syncQueue.pause();
  logger.info('⏸️ Queue paused');
}

/**
 * Resume queue
 */
export async function resumeQueue() {
  await syncQueue.resume();
  logger.info('▶️ Queue resumed');
}

/**
 * Clean old jobs
 */
export async function cleanQueue() {
  await syncQueue.clean(0, 1000, 'completed');
  await syncQueue.clean(0, 1000, 'failed');
  logger.info('🧹 Queue cleaned');
}

export default {
  queue: syncQueue,
  worker: syncWorker,
  events: syncEvents,
  queueShopSync,
  queueBulkSync,
  scheduleAutoSync,
  getQueueStats,
  getJobStatus,
  pauseQueue,
  resumeQueue,
  cleanQueue,
};
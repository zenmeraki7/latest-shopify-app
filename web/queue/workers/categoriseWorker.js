import { Worker } from "bullmq";
import axios from "axios";
import Product from "../../models/Product.js";
import ProductCategory from "../../models/Category.js";
import CategorizationHistory from "../../models/CategorizationHistory.js";
import CategorizationLog from "../../models/CategorizationLog.js";
import { redisConnection } from "../../config/redis.js";

const BATCH_SIZE = 100;
const CONFIDENCE_THRESHOLD = 0.4;
const MAX_LOGS_PER_HISTORY = 1000;

export const categoriseWorker = new Worker(
  "categoriseQueuee",
  async (job) => {
    const { shop, historyId } = job.data;

    console.log(`🚀 Starting categorization for shop: ${shop}`);

    const history = await CategorizationHistory.findById(historyId);
    if (!history) {
      console.error("❌ History not found for job:", job.id);
      return;
    }

    const totalProducts = await Product.countDocuments({
      shop,
      // isPredictionCompleted: { $ne: true },
    });
    const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

    console.log(
      `📦 Total products: ${totalProducts}, Batches: ${totalBatches}`
    );

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchNumber = batchIndex + 1;

      // 🧩 Fetch products for this batch
      const products = await Product.find({
        shop,
        // isPredictionCompleted: { $ne: true },
      })
        .skip(batchIndex * BATCH_SIZE)
        .limit(BATCH_SIZE)
        .select("_id title description category");

      if (!products.length) break;

      const predictions = [];

      // 🔁 Loop through each product and call ML API
      for (const product of products) {
        try {
          const body = {
            tags: product.category || "",
            title: product.title || "",
            description: product.description || "",
          };

          const response = await axios.post(
            "https://zen-vton-categorise.hf.space/predict",
            body
          );

          const result = response.data || {};
          predictions.push({
            productId: product._id,
            predicted_category_path: result.predicted_category_path || null,
            confidence_per_level: result.confidence_per_level || [],
          });

          // Small delay to avoid rate-limiting
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          console.error(
            `❌ Error predicting for product ${product._id}:`,
            err.message
          );
          predictions.push({
            productId: product._id,
            predicted_category_path: null,
            confidence_per_level: [],
          });
        }
      }

      // 🗂️ Collect unique category paths
      const uniqueCategories = [
        ...new Set(
          predictions.map((p) => p.predicted_category_path).filter(Boolean)
        ),
      ];

      // Fetch matching categories
      const categoryDocs = await ProductCategory.find({
        category_path: { $in: uniqueCategories },
      });

      const categoriesMap = Object.fromEntries(
        categoryDocs.map((cat) => [cat.category_path, cat._id])
      );

      // 🔄 Prepare bulk updates
      const bulkOps = predictions
        .map((pred) => {
          const confidenceArray = pred.confidence_per_level || [];
          const overallConfidence = confidenceArray.length
            ? Math.max(...confidenceArray)
            : null;

          const needReview =
            !pred.predicted_category_path ||
            overallConfidence === null ||
            overallConfidence < CONFIDENCE_THRESHOLD;

          return {
            updateOne: {
              filter: { _id: pred.productId },
              update: {
                $set: {
                  category_prediction_result: {
                    predicted_category_path:
                      pred.predicted_category_path || null,
                    confidence_per_level: confidenceArray,
                    overall_confidence: overallConfidence,
                    categoryRef:
                      categoriesMap[pred.predicted_category_path] || null,
                  },
                  category_prediction_status: needReview
                    ? "needs_review"
                    : "classified",
                },
              },
            },
          };
        })
        .filter(Boolean);

      // 🧮 Perform bulk update
      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps);
      }

      // ✅ Update categorization history
      await CategorizationHistory.findByIdAndUpdate(history._id, {
        $inc: {
          processedBatches: 1,
          processedProducts: products.length,
        },
      });

      // 🧹 Limit logs count
      const logCount = await CategorizationLog.countDocuments({
        historyId: history._id,
      });
      if (logCount >= MAX_LOGS_PER_HISTORY) {
        await CategorizationLog.deleteMany({ historyId: history._id });
      }

      await CategorizationLog.create({
        historyId: history._id,
        shop,
        batchNumber,
        processedProducts: products.length,
        status: "success",
        message: `✅ Batch ${batchNumber}/${totalBatches} processed successfully.`,
      });

      console.log(`✅ Batch ${batchNumber} done for shop: ${shop}`);
    }

    console.log(`🎯 Completed categorization for shop: ${shop}`);

    // 🏁 Finalize history
    await CategorizationHistory.findByIdAndUpdate(history._id, {
      $set: { status: "completed", completedAt: new Date() },
    });
  },
  { connection: redisConnection }
);

import { Worker } from "bullmq";
import axios from "axios";
import Product from "../../models/Product.js";
import { redisConnection } from "../../config/redis.js";
import { ProductCategory } from "../../models/Category.js";

const BATCH_SIZE = 50;

export const categoriseWorker = new Worker(
  "categoriseQueue",
  async (job) => {
    const { shop } = job.data;
    console.log(`🚀 Processing categorization for shop: ${shop}`);

    const totalProducts = await Product.countDocuments({
      shop,
      isPredictionCompleted: { $ne: true },
    });
    const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const products = await Product.find({
        shop,
        isPredictionCompleted: { $ne: true },
      })
        .skip(i * BATCH_SIZE)
        .limit(BATCH_SIZE)
        .select("_id title");

      // Map title to _id
      const titleToIdMap = {};
      products.forEach((p) => {
        titleToIdMap[p.title] = p._id;
      });

      const productTitles = products.map((p) => p.title);

      try {
        const response = await axios.post("http://localhost:5000/predict", {
          products: productTitles,
        });

        // Get unique predicted categories for this batch
        const uniqueCategories = [
          ...new Set(response.data.map((p) => p.predicted_category_path)),
        ];

        // Fetch category docs for this batch
        const categoriesMap = {};
        const categoryDocs = await ProductCategory.find({
          category_path: { $in: uniqueCategories },
        });

        categoryDocs.forEach((cat) => {
          categoriesMap[cat.category_path] = cat._id;
        });

        // Prepare bulk operations
        const bulkOps = response.data
          .map((pred) => {
            const productId = titleToIdMap[pred.product];
            if (!productId) return null;

            const categoryId =
              categoriesMap[pred.predicted_category_path] || null;

            return {
              updateOne: {
                filter: { _id: productId },
                update: {
                  $set: {
                    category_prediction_result: {
                      predicted_category_path: pred.predicted_category_path,
                      confidence_per_level: pred.confidence_per_level,
                      overall_confidence: pred.confidence_per_level?.length
                        ? Math.max(...pred.confidence_per_level)
                        : null,
                      categoryRef: categoryId, // ObjectId reference
                    },
                    isPredictionCompleted: true,
                  },
                },
              },
            };
          })
          .filter(Boolean);

        if (bulkOps.length > 0) {
          await Product.bulkWrite(bulkOps);
        }

        console.log(
          `✅ Batch ${i + 1}/${totalBatches} processed for shop: ${shop}`
        );
      } catch (err) {
        console.error(`❌ Error in batch ${i + 1}:`, err.message);
      }
    }

    console.log(`🎯 Completed categorization for shop: ${shop}`);
  },
  { connection: redisConnection }
);

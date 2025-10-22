// backend/controllers/productController.js
import Product from "../models/Product.js";
import Store from "../models/Store.js";
export const getAllStores = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      search = "",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 🧠 Build search filter (optional)
    const matchStage = {};
    if (search) {
      matchStage.shopUrl = { $regex: search, $options: "i" };
    }

    // 🧩 Aggregation pipeline
    const stores = await Store.aggregate([
      { $match: matchStage },

      // 🧷 Lookup products related to the store
      {
        $lookup: {
          from: "products",
          localField: "shopUrl", // or "_id" if Product uses storeId
          foreignField: "shop",
          as: "products",
        },
      },

      // ➕ Add computed fields
      {
        $addFields: {
          totalProducts: { $size: "$products" },
          classifiedProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "prod",
                cond: {
                  $and: [
                    { $eq: ["$$prod.isPredictionCompleted", true] },
                    // Uncomment if needed:
                    // { $eq: ["$$prod.isNeedReview", false] },
                  ],
                },
              },
            },
          },
        },
      },

      // 🎯 Project only needed fields
      {
        $project: {
          _id: 1,
          shopUrl: 1,
          totalProducts: 1,
          classifiedProducts: 1,
          createdAt: 1,
        },
      },

      // 🧮 Sort (dynamic)
      {
        $sort: {
          [sort.replace("-", "")]: sort.startsWith("-") ? -1 : 1,
        },
      },

      // 📄 Pagination
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    // 🧮 Total count (for pagination UI)
    const totalStores = await Store.countDocuments(matchStage);

    res.status(200).json({
      success: true,
      message: "Stores fetched successfully",
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalStores / limit),
      totalStores,
      stores,
    });
  } catch (error) {
    console.error("Error fetching stores:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
export const getStoreById = async (req, res) => {
  try {
    const { shop } = req.params;

    // Fetch store details (only once)
    const shopDetails = await Store.findOne({ shopUrl: shop }).select(
      "name shopUrl email isProductsSyncing shopOwner"
    );

    // Use aggregation to count all status types in one go
    const statusCounts = await Product.aggregate([
      { $match: { shop } },
      {
        $group: {
          _id: "$category_prediction_status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert aggregation output to easy lookup
    const counts = statusCounts.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    );

    const products_count =
      (counts["classified"] || 0) +
      (counts["needs_review"] || 0) +
      (counts["pending"] || 0) +
      (counts["other"] || 0);

    res.status(200).json({
      success: true,
      message: "Store fetched successfully",
      data: {
        shopDetails,
        products_count,
        classified_products_count: counts["classified"] || 0,
        review_need_products_count: counts["needs_review"] || 0,
        pending_products_count: counts["pending"] || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching stores:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMerchantsOverview = async (req, res) => {
  try {
    const merchantsCount = await Store.countDocuments();
    const productsCount = await Product.countDocuments();
    const classified_products = await Product.countDocuments({
      category_prediction_status: "classified",
    });
    const review_need_products = await Product.countDocuments({
      category_prediction_status: "needs_review",
    });
    const merchantsOverview = await Store.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "shopUrl", // or "_id" if Product uses storeId
          foreignField: "shop",
          as: "products",
        },
      },
      {
        $addFields: {
          totalProducts: { $size: "$products" },

          // ✅ Classified products (completed + not needing review)
          classifiedProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "prod",
                cond: {
                  $and: [
                    {
                      $eq: ["$$prod.category_prediction_status", "classified"],
                    },
                    // { $eq: ["$$prod.isNeedReview", false] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          shopUrl: 1,
          totalProducts: 1,
          classifiedProducts: 1,
        },
      },
      {
        $limit: 6,
      },
    ]);
    return res.status(200).json({
      message: "Merchants overview fetched successfully",
      classified_products,
      review_need_products,
      merchantsCount,
      productsCount,
      merchantsOverview,
    });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
};

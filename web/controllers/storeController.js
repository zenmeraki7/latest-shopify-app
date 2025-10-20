// backend/controllers/storeController.js
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

    const query = {};

    // 🔍 If search term provided, match it with shopUrl
    if (search) {
      query.shopUrl = { $regex: search, $options: "i" };
    }

    // 📄 Pagination values
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ⚙️ Fetch stores with sorting, search, and pagination
    const stores = await Store.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-accessToken"); // exclude accessToken from the response

    // 🧮 Total count for pagination
    const totalStores = await Store.countDocuments(query);

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

export const getMerchantsOverview = async (req, res) => {
  try {
    const merchantsCount = await Store.countDocuments();
    const productsCount = await Product.countDocuments();
    const classified_products = await Product.countDocuments({
      isPredictionCompleted: true,
    });
    const review_need_products = await Product.countDocuments({
      isNeedReview: true,
      isPredictionCompleted: true,
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
                    { $eq: ["$$prod.isPredictionCompleted", true] },
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

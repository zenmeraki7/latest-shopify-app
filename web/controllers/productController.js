// backend/controllers/productController.js
import axios from "axios";
import Product from "../models/Product.js";
import { categoriseQueue } from "../queue/categoriseQueue.js";
import CategorizationHistory from "../models/CategorizationHistory.js";
import Store from "../models/Store.js";

// backend/controllers/productController.js
export const getProductsByShop = async (req, res) => {
  try {
    const { shop } = req.params;
    const {
      page = 1,
      limit = 100,
      sort = "-createdAt",
      search = "",
      status = "",
    } = req.query;

    if (!shop) {
      return res
        .status(400)
        .json({ success: false, message: "Shop parameter is required" });
    }

    // 🔍 Search filter
    const query = { shop };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { productType: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { handle: { $regex: search, $options: "i" } },
      ];
    }

    // 🎯 Status filter
    if (status === "classified") {
      query.isPredictionCompleted = true;
      query.isNeedReview = false;
    } else if (status === "needs_review") {
      query.$or = [
        { isNeedReview: true },
        { isPredictionCompleted: false },
      ];
    }

    // 📄 Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ⚙️ Fetch products with ALL necessary fields
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('category_prediction_result.categoryRef', 'name path') // Populate category if needed
      .select(
        "_id shopifyId title handle productType tags category imageUrl seoTitle seoDescription category_prediction_result isPredictionCompleted isNeedReview shop createdAt updatedAt"
      );

    // 🧮 Count total for pagination
    const totalProducts = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      products,
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      search = "",
    } = req.query;

    // 🔍 Build search filter
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { productType: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { shop: { $regex: search, $options: "i" } },
      ];
    }

    // 📄 Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ⚙️ Fetch products with pagination, search, sort, and select
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "shopifyId title handle productType tags category imageUrl seoTitle seoDescription shop createdAt updatedAt"
      ); // ✅ Only needed fields

    // 🧮 Count total
    const totalProducts = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "All products fetched successfully",
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      products,
    });
  } catch (error) {
    console.error("Error fetching all products:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const productCategoriseByShop = async (req, res) => {
  try {
    const { shop } = req.body;

    if (!shop) {
      return res
        .status(400)
        .json({ success: false, message: "Shop parameter is required" });
    }
    const shopExist = await Store.findOne({ shopUrl: shop });
    if (!shopExist) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });
    }
    const totalProducts = await Product.countDocuments({ shop });
    const totalBatches = Math.ceil(totalProducts / 100);
    const newHistory = await CategorizationHistory.create({
      shop,
      totalProducts,
      totalBatches,
    });
    // ➕ Add job to queue
    await categoriseQueue.add("categoriseShopProducts", {
      shop,
      historyId: newHistory._id,
    });

    res.status(200).json({
      success: true,
      message: `Categorization job added to queue for shop: ${shop}`,
      data: newHistory,
    });
  } catch (error) {
    console.error("Error adding job to queue:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

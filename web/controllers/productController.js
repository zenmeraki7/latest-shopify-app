// backend/controllers/productController.js
import axios from "axios";
import Product from "../models/Product.js";
import { categoriseQueue } from "../queue/categoriseQueue.js";
import CategorizationHistory from "../models/CategorizationHistory.js";
import Store from "../models/Store.js";
import { getSession } from "../utils/shopifyUtils.js";
import shopify from "../shopify.js";

export const getProductsByShop = async (req, res) => {
  try {
    const { shop } = req.params;
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      search = "",
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
        {
          "category_prediction_result.predicted_category_path": {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // 📄 Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ⚙️ Fetch products with selected fields
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "shopifyId title productType category_prediction_result category_prediction_status imageUrl createdAt updatedAt"
      ); // ✅ Only include useful fields

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
        {
          "category_prediction_result.predicted_category_path": {
            $regex: search,
            $options: "i",
          },
        },
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
        "shopifyId title productType category_prediction_result.predicted_category_path category_prediction_status imageUrl createdAt updatedAt"
      ); // ✅ Only include useful fields

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

export const getAllShopProducts = async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res
        .status(400)
        .json({ success: false, message: "Shop parameter is required" });
    }

    const session = await getSession(shop);
    const client = new shopify.api.clients.Graphql({ session });

    const query = `
      {
        products(first: 100) {
          edges {
            node {
              id
              title
              description
              productType
              category {
                fullName
              }
              
            }
          }
        }
      }
    `;

    const response = await client.query({ data: query });

    if (!response?.body?.data?.products) {
      return res
        .status(404)
        .json({ success: false, message: "No products found for this shop" });
    }

    const products = response.body.data.products.edges.map((edge) => edge.node);

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Error fetching all shop products:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const categoriseProduct = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "title, description, and category (tags) are required",
      });
    }

    // Prepare the payload for the third-party API
    const payload = {
      tags: category,
      title,
      description,
    };

    // Make POST request to external API
    const response = await axios.post(
      "https://zen-vton-categorise.hf.space/predict",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // optional timeout
      }
    );

    // Extract data from response
    const data = response.data;

    // Get the last confidence score
    const lastConfidence =
      Array.isArray(data.confidence_per_level) &&
      data.confidence_per_level.length > 0
        ? data.confidence_per_level[data.confidence_per_level.length - 1]
        : null;

    res.status(200).json({
      success: true,
      predicted_category_path: data.predicted_category_path,
      confidence: lastConfidence,
      input: data.input,
    });
  } catch (error) {
    console.error("Error categorising product:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==========================================
// FILE: web/controllers/merchantController.js
// ==========================================

import Product from "../models/Product.js";
import Shop from "../models/Shop.js"; // Assuming you have a Shop model

/**
 * Get all merchants/shops with their product counts
 * GET /api/admin/merchants
 */
export async function getMerchants(req, res) {
  try {
    // Aggregate shops with their product counts
    const merchants = await Shop.aggregate([
      {
        $lookup: {
          from: "products", // Your products collection name
          localField: "shopDomain", // Shop identifier
          foreignField: "shop", // Product's shop reference
          as: "products"
        }
      },
      {
        $project: {
          name: 1,
          shopDomain: 1,
          email: 1,
          createdAt: 1,
          totalProducts: { $size: "$products" },
          classifiedProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "product",
                cond: { 
                  $and: [
                    { $ne: ["$$product.classifiedCategory", null] },
                    { $ne: ["$$product.classifiedCategory", ""] }
                  ]
                }
              }
            }
          },
          lowConfidenceProducts: {
            $size: {
              $filter: {
                input: "$products",
                as: "product",
                cond: { $lt: ["$$product.confidence", 0.7] }
              }
            }
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // Calculate totals
    const totals = await Product.aggregate([
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
          needsReview: {
            $sum: {
              $cond: [{ $lt: ["$confidence", 0.7] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      merchants,
      totalMerchants: merchants.length,
      stats: totals[0] || {
        totalProducts: 0,
        classifiedProducts: 0,
        needsReview: 0
      }
    });

  } catch (error) {
    console.error("Get merchants error:", error);
    res.status(500).json({ 
      error: "Failed to fetch merchants" 
    });
  }
}

/**
 * Get products for a specific merchant
 * GET /api/admin/merchants/:shopDomain/products
 */
export async function getMerchantProducts(req, res) {
  try {
    const { shopDomain } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Find products for this shop
    const products = await Product.find({ shop: shopDomain })
      .skip(skip)
      .limit(Number(limit))
      .sort({ updatedAt: -1 })
      .lean();

    const total = await Product.countDocuments({ shop: shopDomain });

    res.json({
      success: true,
      shopDomain,
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Get merchant products error:", error);
    res.status(500).json({ 
      error: "Failed to fetch products" 
    });
  }
}

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
export async function getDashboardStats(req, res) {
  try {
    const [productStats, merchantCount] = await Promise.all([
      Product.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  classified: {
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
                  needsReview: {
                    $sum: {
                      $cond: [{ $lt: ["$confidence", 0.7] }, 1, 0]
                    }
                  }
                }
              }
            ],
            byCategory: [
              {
                $match: {
                  classifiedCategory: { $ne: null, $ne: "" }
                }
              },
              {
                $group: {
                  _id: "$classifiedCategory",
                  count: { $sum: 1 }
                }
              },
              {
                $sort: { count: -1 }
              },
              {
                $limit: 10
              }
            ]
          }
        }
      ]),
      Shop.countDocuments()
    ]);

    const stats = productStats[0].totals[0] || {
      total: 0,
      classified: 0,
      needsReview: 0
    };

    res.json({
      success: true,
      totalMerchants: merchantCount,
      totalProducts: stats.total,
      classifiedProducts: stats.classified,
      needsReview: stats.needsReview,
      topCategories: productStats[0].byCategory
    });

  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ 
      error: "Failed to fetch statistics" 
    });
  }
}

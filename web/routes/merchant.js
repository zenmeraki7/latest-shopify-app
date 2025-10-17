// ==========================================
// FILE: web/routes/merchant.js
// ==========================================

import express from "express";
import {
  getMerchants,
  getMerchantProducts,
  getDashboardStats
} from "../controllers/merchantController.js";
import { adminAuth } from "../middlewares/adminAuth.js";

const router = express.Router();

// Apply authentication to all merchant routes
router.use(adminAuth);

/**
 * Get all merchants with stats
 * GET /api/admin/merchants
 */
router.get("/merchants", getMerchants);

/**
 * Get products for a specific merchant
 * GET /api/admin/merchants/:shopDomain/products
 */
router.get("/merchants/:shopDomain/products", getMerchantProducts);

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
router.get("/dashboard/stats", getDashboardStats);

export default router;
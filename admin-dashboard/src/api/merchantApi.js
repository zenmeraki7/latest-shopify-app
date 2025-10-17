// ==========================================
// FILE: src/api/merchantApi.js
// ==========================================

import api from "./adminApi";

/**
 * Get all merchants with their product stats
 * @returns {Promise<{success: boolean, merchants: Array, totalMerchants: number, stats: Object}>}
 */
export async function getMerchants() {
  const { data } = await api.get("/merchants");
  return data;
}

/**
 * Get products for a specific merchant
 * @param {string} shopDomain - Merchant's shop domain
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<{success: boolean, products: Array, total: number, pages: number}>}
 */
export async function getMerchantProducts(shopDomain, page = 1, limit = 20) {
  const { data } = await api.get(`/merchants/${shopDomain}/products`, {
    params: { page, limit }
  });
  return data;
}

/**
 * Get dashboard statistics
 * @returns {Promise<{success: boolean, totalMerchants: number, totalProducts: number, classifiedProducts: number, needsReview: number}>}
 */
export async function getDashboardStats() {
  const { data } = await api.get("/dashboard/stats");
  return data;
}
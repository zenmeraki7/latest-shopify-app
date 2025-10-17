import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("adminToken");
      window.location.href = "/login";
    }

    // Log rate limiting for debugging
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter || 60;
      console.warn(`⚠️ Rate limited. Retry after ${retryAfter} seconds`);
    }

    return Promise.reject(error);
  }
);

// ==========================================
// AUTH FUNCTIONS
// ==========================================

/**
 * Login with API key
 * @param {string} apiKey - Admin API key
 * @returns {Promise<{success: boolean}>}
 */
export async function loginApi(apiKey) {
  try {
    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL}/login`,
      { apiKey }
    );

    if (data.success && data.token) {
      localStorage.setItem("adminToken", data.token);
      return { success: true };
    }

    throw new Error("Invalid response from server");
  } catch (error) {
    // Handle rate limiting with user-friendly message
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter;
      throw new Error(
        retryAfter
          ? `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
          : "Too many login attempts. Please try again later."
      );
    }
    throw new Error(error.response?.data?.error || "Login failed");
  }
}

/**
 * Logout and clear session
 */
export function logoutApi() {
  localStorage.removeItem("adminToken");
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!localStorage.getItem("adminToken");
}

// ==========================================
// PRODUCT FUNCTIONS
// ==========================================

/**
 * Get paginated products
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20, max: 100)
 * @returns {Promise<{total: number, page: number, pages: number, data: Array}>}
 */
export async function getProducts(page = 1, limit = 20) {
  const { data } = await api.get(`/products`, {
    params: { page, limit },
  });
  return data;
}

/**
 * Reclassify a single product
 * @param {string} id - Product ID
 * @returns {Promise<{success: boolean, product: Object}>}
 */
export async function reclassifyProduct(id) {
  const { data } = await api.post(`/products/${id}/reclassify`);
  return data;
}

/**
 * Bulk reclassify products
 * @param {Object} options - Either { productIds: [...] } or { filter: {...} }
 * @returns {Promise<{success: boolean, results: Object}>}
 */
export async function bulkReclassifyProducts({ productIds, filter }) {
  const payload = productIds ? { productIds } : { filter };
  const { data } = await api.post(`/products/bulk-reclassify`, payload);
  return data;
}

// ==========================================
// ANALYTICS FUNCTIONS
// ==========================================

/**
 * Get analytics dashboard data
 * @returns {Promise<{success: boolean, analytics: Object}>}
 */
export async function getAnalytics() {
  const { data } = await api.get(`/analytics`);
  return data;
}

// ==========================================
// ERROR HANDLING HELPER
// ==========================================

/**
 * Get user-friendly error message from API error
 * @param {Error} error - Error object from API
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  // Rate limiting
  if (error.response?.status === 429) {
    const retryAfter = error.response.data?.retryAfter;
    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      return `Too many requests. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return "Too many requests. Please slow down and try again later.";
  }

  // Not found
  if (error.response?.status === 404) {
    return "Resource not found.";
  }

  // Validation errors
  if (error.response?.status === 400) {
    return error.response.data?.error || "Invalid request.";
  }

  // Server errors
  if (error.response?.status >= 500) {
    return "Server error. Please try again later.";
  }

  // Network errors
  if (!error.response) {
    return "Network error. Please check your connection.";
  }

  // Default to API error message or generic message
  return error.response?.data?.error || error.message || "An error occurred";
}

// ==========================================
// RATE LIMIT INFO HELPER
// ==========================================

/**
 * Extract rate limit info from response headers
 * @param {Object} response - Axios response object
 * @returns {Object|null} Rate limit info or null
 */
export function getRateLimitInfo(response) {
  const headers = response?.headers;
  if (!headers) return null;

  const limit = headers["ratelimit-limit"];
  const remaining = headers["ratelimit-remaining"];
  const reset = headers["ratelimit-reset"];

  if (!limit) return null;

  return {
    limit: Number(limit),
    remaining: Number(remaining),
    reset: Number(reset),
    resetDate: new Date(Number(reset) * 1000),
  };
}

export default api;
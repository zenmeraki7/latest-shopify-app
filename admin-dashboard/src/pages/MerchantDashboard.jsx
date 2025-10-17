import { useState, useEffect } from "react";
import { getMerchants, getMerchantProducts, getDashboardStats } from "../api/merchantApi";
import { reclassifyProduct, getErrorMessage } from "../api/adminApi";

export default function MerchantDashboard() {
  const [merchants, setMerchants] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedMerchant, setExpandedMerchant] = useState(null);
  const [merchantProducts, setMerchantProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState({});
  const [reclassifying, setReclassifying] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const [merchantsData, statsData] = await Promise.all([
        getMerchants(),
        getDashboardStats()
      ]);
      setMerchants(merchantsData.merchants);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleMerchant(shopDomain) {
    if (expandedMerchant === shopDomain) {
      setExpandedMerchant(null);
      return;
    }

    setExpandedMerchant(shopDomain);

    if (!merchantProducts[shopDomain]) {
      setLoadingProducts(prev => ({ ...prev, [shopDomain]: true }));
      try {
        const data = await getMerchantProducts(shopDomain);
        setMerchantProducts(prev => ({
          ...prev,
          [shopDomain]: data.products
        }));
      } catch (err) {
        console.error("Failed to load products:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoadingProducts(prev => ({ ...prev, [shopDomain]: false }));
      }
    }
  }

  async function handleReclassify(productId, shopDomain) {
    setReclassifying(prev => ({ ...prev, [productId]: true }));
    setError("");
    setSuccess("");
    try {
      await reclassifyProduct(productId);
      setSuccess("Product reclassified successfully!");
      
      const data = await getMerchantProducts(shopDomain);
      setMerchantProducts(prev => ({
        ...prev,
        [shopDomain]: data.products
      }));
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Reclassification failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setReclassifying(prev => ({ ...prev, [productId]: false }));
    }
  }

  function getConfidenceColor(confidence) {
    if (confidence >= 0.9) return "#2e7d32";
    if (confidence >= 0.7) return "#f57c00";
    return "#d32f2f";
  }

  function getConfidenceClass(confidence) {
    if (confidence >= 0.9) return "confidence-high";
    if (confidence >= 0.7) return "confidence-medium";
    return "confidence-low";
  }

  const filteredMerchants = merchants.filter(merchant =>
    merchant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    merchant.shopDomain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🏪 Merchant Shops Dashboard</h1>
        <div style={styles.headerActions}>
          <input
            type="text"
            style={styles.searchBox}
            placeholder="Search merchants or products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={styles.closeBtn}>×</button>
        </div>
      )}

      {success && (
        <div style={styles.successBanner}>
          <span>✅ {success}</span>
          <button onClick={() => setSuccess("")} style={styles.closeBtn}>×</button>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Merchants</div>
            <div style={styles.statValue}>{stats.totalMerchants}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Products</div>
            <div style={styles.statValue}>{stats.totalProducts}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Classified</div>
            <div style={styles.statValue}>{stats.classifiedProducts}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Needs Review</div>
            <div style={styles.statValue}>{stats.needsReview}</div>
          </div>
        </div>
      )}

      {/* Merchants Grid */}
      <div style={styles.merchantsGrid}>
        {filteredMerchants.map((merchant) => (
          <div
            key={merchant._id}
            style={{
              ...styles.merchantCard,
              ...(expandedMerchant === merchant.shopDomain ? styles.merchantCardExpanded : {})
            }}
          >
            {/* Merchant Header */}
            <div
              style={styles.merchantHeader}
              onClick={() => toggleMerchant(merchant.shopDomain)}
            >
              <div style={styles.merchantName}>
                <span style={styles.merchantIcon}>🏪</span>
                {merchant.name || merchant.shopDomain}
              </div>
              <div style={styles.shopAddress}>
                <span>📍</span>
                {merchant.shopDomain}
              </div>
              <div style={styles.merchantStats}>
                <div style={styles.merchantStat}>
                  <span>📦</span>
                  <span>{merchant.totalProducts} Products</span>
                </div>
                <div style={styles.merchantStat}>
                  <span>✅</span>
                  <span>{merchant.classifiedProducts} Classified</span>
                </div>
                {merchant.lowConfidenceProducts > 0 && (
                  <div style={styles.merchantStat}>
                    <span>⚠️</span>
                    <span>{merchant.lowConfidenceProducts} Low Conf.</span>
                  </div>
                )}
              </div>
              <span style={{
                ...styles.toggleIcon,
                transform: expandedMerchant === merchant.shopDomain ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>▼</span>
            </div>

            {/* Products Section */}
            {expandedMerchant === merchant.shopDomain && (
              <div style={styles.productsSection}>
                <div style={styles.productsHeader}>
                  <span>Products in Store</span>
                  <span>{merchant.totalProducts} items</span>
                </div>

                {loadingProducts[merchant.shopDomain] ? (
                  <div style={styles.loadingProducts}>
                    <div style={styles.smallSpinner}></div>
                    <p>Loading products...</p>
                  </div>
                ) : merchantProducts[merchant.shopDomain]?.length > 0 ? (
                  merchantProducts[merchant.shopDomain].map((product) => (
                    <div key={product._id} style={styles.productItem}>
                      <div style={styles.productImage}>
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.title} style={styles.productImg} />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>
                      <div style={styles.productInfo}>
                        <div style={styles.productName}>{product.title}</div>
                        <div style={styles.productMeta}>
                          <span style={styles.productCategory}>
                            {product.classifiedCategory || "Unclassified"}
                          </span>
                          {product.confidence && (
                            <span
                              style={styles.productConfidence}
                              className={getConfidenceClass(product.confidence)}
                            >
                              {(product.confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={styles.productActions}>
                        <button
                          style={styles.btnReclassify}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReclassify(product._id, merchant.shopDomain);
                          }}
                          disabled={reclassifying[product._id]}
                        >
                          {reclassifying[product._id] ? "Processing..." : "Reclassify"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={styles.noProducts}>
                    No products found in this store
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredMerchants.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>🔍</div>
            <h2>No merchants found</h2>
            <p>Try adjusting your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "20px",
  },
  header: {
    background: "white",
    padding: "24px 32px",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    marginBottom: "32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "1400px",
    margin: "0 auto 32px",
  },
  title: {
    fontSize: "28px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    gap: "12px",
  },
  searchBox: {
    padding: "10px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    width: "300px",
    fontSize: "14px",
    outline: "none",
  },
  errorBanner: {
    background: "#ffebee",
    color: "#c62828",
    padding: "16px 24px",
    borderRadius: "12px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "1400px",
    margin: "0 auto 20px",
  },
  successBanner: {
    background: "#e8f5e9",
    color: "#2e7d32",
    padding: "16px 24px",
    borderRadius: "12px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: "1400px",
    margin: "0 auto 20px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    padding: "0 8px",
    opacity: 0.7,
  },
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
    maxWidth: "1400px",
    margin: "0 auto 32px",
  },
  statCard: {
    background: "white",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    textAlign: "center",
  },
  statLabel: {
    fontSize: "12px",
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#667eea",
  },
  merchantsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  merchantCard: {
    background: "white",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    overflow: "hidden",
    transition: "transform 0.3s, box-shadow 0.3s",
  },
  merchantCardExpanded: {
    transform: "translateY(-4px)",
    boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
  },
  merchantHeader: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "24px",
    color: "white",
    cursor: "pointer",
    position: "relative",
  },
  merchantName: {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  merchantIcon: {
    width: "32px",
    height: "32px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  shopAddress: {
    fontSize: "14px",
    opacity: 0.9,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "12px",
  },
  merchantStats: {
    display: "flex",
    gap: "20px",
    fontSize: "13px",
    flexWrap: "wrap",
  },
  merchantStat: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  toggleIcon: {
    position: "absolute",
    top: "24px",
    right: "24px",
    fontSize: "24px",
    transition: "transform 0.3s",
  },
  productsSection: {
    maxHeight: "2000px",
    overflow: "hidden",
  },
  productsHeader: {
    padding: "16px 24px",
    background: "#f8f9fa",
    borderBottom: "2px solid #e0e0e0",
    fontWeight: "600",
    color: "#666",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productItem: {
    padding: "16px 24px",
    borderBottom: "1px solid #f0f0f0",
    display: "grid",
    gridTemplateColumns: "60px 1fr auto",
    gap: "16px",
    alignItems: "center",
  },
  productImage: {
    width: "60px",
    height: "60px",
    background: "linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    color: "#999",
    overflow: "hidden",
  },
  productImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontWeight: "600",
    color: "#333",
    marginBottom: "4px",
    fontSize: "14px",
  },
  productMeta: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
    color: "#666",
  },
  productCategory: {
    padding: "2px 8px",
    background: "#e8f5e9",
    color: "#2e7d32",
    borderRadius: "4px",
    fontWeight: "600",
  },
  productConfidence: {
    fontWeight: "600",
  },
  productActions: {
    display: "flex",
    gap: "8px",
  },
  btnReclassify: {
    padding: "6px 12px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },
  loadingProducts: {
    padding: "40px",
    textAlign: "center",
    color: "#666",
  },
  smallSpinner: {
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #667eea",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    animation: "spin 1s linear infinite",
    margin: "0 auto 12px",
  },
  noProducts: {
    padding: "40px 24px",
    textAlign: "center",
    color: "#999",
    fontStyle: "italic",
  },
  emptyState: {
    background: "white",
    padding: "60px 40px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
    gridColumn: "1 / -1",
  },
  emptyStateIcon: {
    fontSize: "64px",
    marginBottom: "16px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  spinner: {
    border: "4px solid rgba(255,255,255,0.3)",
    borderTop: "4px solid white",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
};
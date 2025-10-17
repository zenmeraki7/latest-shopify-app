import { useState, useEffect } from "react";
import {
  getProducts,
  reclassifyProduct,
  bulkReclassifyProducts,
  getErrorMessage,
} from "../api/adminApi";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reclassifying, setReclassifying] = useState({});
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { logout } = useAuth();

  useEffect(() => {
    loadProducts();
  }, [loadProducts, page]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const data = await getProducts(page, 20);
      setProducts(data.data);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleReclassify(id) {
    setReclassifying((prev) => ({ ...prev, [id]: true }));
    setError("");
    setSuccess("");
    try {
      await reclassifyProduct(id);
      setSuccess("Product reclassified successfully!");
      await loadProducts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Reclassification failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setReclassifying((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleBulkReclassify() {
    if (selectedProducts.size === 0) {
      setError("Please select at least one product");
      return;
    }

    if (!confirm(`Reclassify ${selectedProducts.size} selected products?`)) {
      return;
    }

    setBulkProcessing(true);
    setError("");
    setSuccess("");
    try {
      const productIds = Array.from(selectedProducts);
      const result = await bulkReclassifyProducts({ productIds });
      setSuccess(
        `Successfully reclassified ${result.results.successful} of ${result.results.total} products`
      );
      setSelectedProducts(new Set());
      await loadProducts();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      console.error("Bulk reclassification failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setBulkProcessing(false);
    }
  }

  function toggleProductSelection(id) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p._id)));
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Product Classification Dashboard</h1>
        <button onClick={logout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      <div style={styles.content}>
        {/* Alert Messages */}
        {error && (
          <div style={styles.errorBanner}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} style={styles.closeBtn}>
              ×
            </button>
          </div>
        )}

        {success && (
          <div style={styles.successBanner}>
            <span>✅ {success}</span>
            <button onClick={() => setSuccess("")} style={styles.closeBtn}>
              ×
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Total Products</span>
            <span style={styles.statValue}>{total}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Current Page</span>
            <span style={styles.statValue}>
              {page} / {totalPages}
            </span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Selected</span>
            <span style={styles.statValue}>{selectedProducts.size}</span>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedProducts.size > 0 && (
          <div style={styles.bulkActions}>
            <button
              onClick={handleBulkReclassify}
              disabled={bulkProcessing}
              style={styles.bulkBtn}
            >
              {bulkProcessing
                ? "Processing..."
                : `Reclassify ${selectedProducts.size} Selected`}
            </button>
            <button
              onClick={() => setSelectedProducts(new Set())}
              style={styles.clearBtn}
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading products...</p>
          </div>
        ) : (
          <>
            {/* Products Table */}
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thCheckbox}>
                      <input
                        type="checkbox"
                        checked={
                          products.length > 0 &&
                          selectedProducts.size === products.length
                        }
                        onChange={toggleSelectAll}
                        style={styles.checkbox}
                      />
                    </th>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Confidence</th>
                    <th style={styles.th}>Method</th>
                    <th style={styles.th}>Updated</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product._id}
                      style={{
                        ...styles.tr,
                        ...(selectedProducts.has(product._id)
                          ? styles.trSelected
                          : {}),
                      }}
                    >
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product._id)}
                          onChange={() => toggleProductSelection(product._id)}
                          style={styles.checkbox}
                        />
                      </td>
                      <td style={styles.td}>
                        <div style={styles.productTitle}>{product.title}</div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(product.classifiedCategory
                              ? styles.badgeSuccess
                              : styles.badgeWarning),
                          }}
                        >
                          {product.classifiedCategory || "Unclassified"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {product.confidence ? (
                          <span
                            style={{
                              ...styles.confidence,
                              color: getConfidenceColor(product.confidence),
                            }}
                          >
                            {(product.confidence * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={styles.textMuted}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.textSmall}>
                          {product.classificationMethod || "—"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.textSmall}>
                          {new Date(product.updatedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => handleReclassify(product._id)}
                          disabled={reclassifying[product._id]}
                          style={styles.actionBtn}
                        >
                          {reclassifying[product._id]
                            ? "Processing..."
                            : "Reclassify"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {products.length === 0 && (
                <div style={styles.emptyState}>
                  <p>No products found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                style={styles.pageBtn}
              >
                ← Previous
              </button>
              <span style={styles.pageInfo}>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                style={styles.pageBtn}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function for confidence color
function getConfidenceColor(confidence) {
  if (confidence >= 0.9) return "#2e7d32";
  if (confidence >= 0.7) return "#f57c00";
  return "#d32f2f";
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f5f5f5",
  },
  header: {
    background: "white",
    padding: "20px 40px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    color: "#333",
  },
  logoutBtn: {
    padding: "8px 16px",
    background: "#d32f2f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  content: {
    padding: "40px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  errorBanner: {
    background: "#ffebee",
    color: "#c62828",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successBanner: {
    background: "#e8f5e9",
    color: "#2e7d32",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  stat: {
    background: "white",
    padding: "16px 24px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  statLabel: {
    fontSize: "12px",
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  statValue: {
    fontSize: "24px",
    color: "#333",
    fontWeight: "700",
  },
  bulkActions: {
    background: "white",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    display: "flex",
    gap: "12px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  bulkBtn: {
    padding: "10px 20px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  clearBtn: {
    padding: "10px 20px",
    background: "#f5f5f5",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px",
    background: "white",
    borderRadius: "8px",
  },
  spinner: {
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #667eea",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
  },
  tableContainer: {
    background: "white",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "16px",
    textAlign: "left",
    background: "#667eea",
    color: "white",
    fontWeight: "600",
    fontSize: "14px",
  },
  thCheckbox: {
    padding: "16px",
    background: "#667eea",
    width: "50px",
  },
  tr: {
    borderBottom: "1px solid #e0e0e0",
    transition: "background 0.2s",
  },
  trSelected: {
    background: "#f3f4ff",
  },
  td: {
    padding: "16px",
    fontSize: "14px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  productTitle: {
    maxWidth: "300px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badge: {
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "600",
  },
  badgeSuccess: {
    background: "#e8f5e9",
    color: "#2e7d32",
  },
  badgeWarning: {
    background: "#fff3e0",
    color: "#e65100",
  },
  confidence: {
    fontWeight: "600",
  },
  textMuted: {
    color: "#999",
  },
  textSmall: {
    fontSize: "13px",
    color: "#666",
  },
  actionBtn: {
    padding: "6px 12px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },
  emptyState: {
    padding: "60px",
    textAlign: "center",
    color: "#999",
  },
  pagination: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "20px",
  },
  pageBtn: {
    padding: "10px 20px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  pageInfo: {
    fontSize: "14px",
    color: "#666",
  },
};
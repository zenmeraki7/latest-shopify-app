// ==========================================
// FILE: src/App.jsx
// ==========================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import MerchantDashboard from "./pages/MerchantDashboard";
import ProductDashboard from "./pages/ProductDashboard"; // Old dashboard

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/merchants"
            element={
              <ProtectedRoute>
                <MerchantDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default Route - Redirect to Merchants */}
          <Route path="/" element={<Navigate to="/merchants" replace />} />

          {/* 404 Route */}
          <Route path="*" element={<Navigate to="/merchants" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
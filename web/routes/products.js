// backend/routes/products.js
import express from "express";
import {
  categoriseProduct,
  getAllProducts,
  getAllShopProducts,
  getProductsByShop,
  productCategoriseByShop,
} from "../controllers/productController.js";

const router = express.Router();
router.get("/get-by-shop/:shop", getProductsByShop);
router.get("/get-all", getAllProducts);
router.get("/get-all-shop-products", getAllShopProducts);
router.post("/categorise-product", categoriseProduct);
router.post("/categorise-products", productCategoriseByShop);

export default router;

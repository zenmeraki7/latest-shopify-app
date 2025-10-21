// backend/routes/products.js
import express from "express";
import {
  getAllProducts,
  getProductsByShop,
  productCategoriseByShop,
} from "../controllers/productController.js";

const router = express.Router();
router.get("/get-by-shop/:shop", getProductsByShop); //storeView page
router.get("/get-all", getAllProducts);
router.post("/categorise-products", productCategoriseByShop);

export default router;

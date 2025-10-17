// backend/routes/products.js
import express from "express";
import { getCategory } from "../controllers/categoryController.js";

const router = express.Router();
router.get("/get-all", getCategory);
router.get("/overview", getCategory);

export default router;

// backend/routes/products.js
import express from "express";
import { getCategory } from "../controllers/categoryController.js";
import {
  getAllHistories,
  getHistoryLogs,
} from "../controllers/historyController.js";

const router = express.Router();
router.get("/get-all", getCategory);
router.get("/overview", getCategory);
router.get("/get-histories", getAllHistories);
router.get("/get-history-logs/:id", getHistoryLogs);

export default router;

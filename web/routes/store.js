// backend/routes/store.js
import express from "express";
import { getAllStores, getMerchantsOverview } from "../controllers/storeController.js";

const router = express.Router();
router.get("/get", getAllStores);
router.get("/get-overview", getMerchantsOverview);

export default router;

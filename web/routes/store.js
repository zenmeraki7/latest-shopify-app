// backend/routes/store.js
import express from "express";
import {
  getAllStores,
  getMerchantsOverview,
  getStoreById,
} from "../controllers/storeController.js";
const router = express.Router();
router.get("/get", getAllStores);
router.get("/get-details/:shop", getStoreById);//store view
router.get("/get-overview", getMerchantsOverview); //dashboard

export default router;

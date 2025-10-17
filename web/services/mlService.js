// backend/services/mlService.js
import axios from "axios";

export const classifyProducts = async (products) => {
  // Send batch to Python ML microservice
  const response = await axios.post("http://localhost:8000/classify", {
    products,
  });
  return response.data; // returns [{ shopifyId, suggestedCategory, confidence }]
};

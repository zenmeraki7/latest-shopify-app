import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * Classify product using your own ML model
 */
export async function mlClassifier(product) {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/classify`,
      {
        title: product.title || '',
        description: product.description || '',
        tags: product.tags || [],
        vendor: product.vendor || ''
      },
      {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return {
      classifiedCategory: response.data.category,
      confidence: response.data.confidence,
      classificationMethod: 'ML-Model',
      modelVersion: response.data.model_version,
      allProbabilities: response.data.all_probabilities
    };

  } catch (error) {
    console.error('ML classification failed:', error.message);
    
    // Return low confidence so orchestrator tries next method
    return {
      classifiedCategory: null,
      confidence: 0,
      classificationMethod: 'ML-Model',
      error: error.message
    };
  }
}

/**
 * Batch classify multiple products
 */
export async function mlBatchClassifier(products) {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/batch-classify`,
      { products },
      { timeout: 30000 }
    );

    return response.data.results;

  } catch (error) {
    console.error('ML batch classification failed:', error.message);
    return [];
  }
}

/**
 * Check if ML service is available
 */
export async function checkMLService() {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, {
      timeout: 2000
    });
    return response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}
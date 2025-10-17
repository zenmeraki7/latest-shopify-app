import { mlClassifier, checkMLService } from './mlClassifier.js';
// import { keywordClassifier } from './keywordClassifier.js';
// import { gptClassifier } from './gptClassifier.js'; // If you have this

let mlServiceAvailable = false;

// Check ML service on startup
checkMLService().then(available => {
  mlServiceAvailable = available;
  console.log(`ML Service: ${available ? '✓ Available' : '✗ Unavailable'}`);
});

/**
 * Classify product using best available method
 * Priority: ML Model → Keywords → GPT-4 (if configured)
 */
export async function classifyProduct(product) {
  let result = null;

  // 1. Try ML model first (if available)
  if (mlServiceAvailable) {
    result = await mlClassifier(product);
    if (result.confidence > 0.75) {
      console.log(`✓ ML classified: ${result.classifiedCategory} (${(result.confidence * 100).toFixed(1)}%)`);
      return result;
    }
  }

  // 2. Try keyword matching
  // result = await keywordClassifier(product);
  // if (result.confidence > 0.7) {
  //   console.log(`✓ Keyword classified: ${result.classifiedCategory} (${(result.confidence * 100).toFixed(1)}%)`);
  //   return result;
  // }

  // 3. Fall back to GPT-4 (if available and configured)
  // if (process.env.OPENAI_API_KEY) {
  //   result = await gptClassifier(product);
  //   console.log(`✓ GPT-4 classified: ${result.classifiedCategory}`);
  //   return result;
  // }

  // 4. Return best result so far or unclassified
  return result || {
    classifiedCategory: 'Uncategorized',
    confidence: 0,
    classificationMethod: 'None'
  };
}
from flask import Flask, request, jsonify
import joblib
import numpy as np
from models.preprocessor import preprocess_text

app = Flask(__name__)

# Load models on startup
print("Loading ML models...")
model = joblib.load('saved_models/model.pkl')
vectorizer = joblib.load('saved_models/vectorizer.pkl')
label_encoder = joblib.load('saved_models/label_encoder.pkl')
print("Models loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    })

@app.route('/classify', methods=['POST'])
def classify():
    try:
        data = request.json
        
        # Extract features
        title = data.get('title', '')
        description = data.get('description', '')
        tags = data.get('tags', [])
        vendor = data.get('vendor', '')
        
        # Combine text
        text = f"{title} {description} {' '.join(tags)} {vendor}"
        
        # Preprocess
        processed_text = preprocess_text(text)
        
        # Vectorize
        features = vectorizer.transform([processed_text])
        
        # Predict
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        
        # Get category name
        category = label_encoder.inverse_transform([prediction])[0]
        confidence = float(max(probabilities))
        
        # Get all probabilities
        all_categories = label_encoder.classes_
        category_probs = {
            cat: float(prob) 
            for cat, prob in zip(all_categories, probabilities)
        }
        
        return jsonify({
            'category': category,
            'confidence': confidence,
            'all_probabilities': category_probs,
            'model_version': '1.0.0'
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/batch-classify', methods=['POST'])
def batch_classify():
    """Classify multiple products at once"""
    try:
        products = request.json.get('products', [])
        
        # Prepare all texts
        texts = []
        for product in products:
            text = f"{product.get('title', '')} {product.get('description', '')}"
            texts.append(preprocess_text(text))
        
        # Vectorize all at once
        features = vectorizer.transform(texts)
        
        # Predict all
        predictions = model.predict(features)
        probabilities = model.predict_proba(features)
        
        # Format results
        results = []
        for pred, probs in zip(predictions, probabilities):
            category = label_encoder.inverse_transform([pred])[0]
            results.append({
                'category': category,
                'confidence': float(max(probs))
            })
        
        return jsonify({
            'results': results,
            'count': len(results)
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
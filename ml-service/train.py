import sys
import os
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from models.classifier import create_model, create_vectorizer
from models.preprocessor import preprocess_text, extract_features
from pymongo import MongoClient

def fetch_training_data():
    """
    Fetch products from MongoDB for training
    """
    # Connect to MongoDB
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/shopify-app')
    client = MongoClient(mongo_uri)
    db = client.get_database()
    
    # Fetch products with classifications
    products = list(db.products.find({
        'classifiedCategory': {'$exists': True, '$ne': None, '$ne': ''}
    }))
    
    print(f"Fetched {len(products)} classified products from MongoDB")
    
    # Convert to DataFrame
    data = []
    for product in products:
        text = extract_features(product)
        category = product.get('classifiedCategory')
        
        data.append({
            'text': text,
            'category': category,
            'confidence': product.get('confidence', 0),
            'shop': product.get('shop', '')
        })
    
    df = pd.DataFrame(data)
    return df

def train_model():
    """
    Train ML classification model
    """
    print("=" * 60)
    print("Starting ML Model Training")
    print("=" * 60)
    
    # 1. Load data
    print("\n1. Loading training data from MongoDB...")
    df = fetch_training_data()
    
    if len(df) < 100:
        print(f"⚠️  Warning: Only {len(df)} training samples. Need at least 100 for good results.")
        return False
    
    print(f"   ✓ Loaded {len(df)} products")
    print(f"   ✓ Categories: {df['category'].nunique()}")
    print(f"\nCategory distribution:")
    print(df['category'].value_counts())
    
    # 2. Prepare data
    print("\n2. Preparing data...")
    X = df['text'].values
    y = df['category'].values
    
    # Encode labels
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, 
        test_size=0.2, 
        random_state=42,
        stratify=y_encoded
    )
    
    print(f"   ✓ Train samples: {len(X_train)}")
    print(f"   ✓ Test samples: {len(X_test)}")
    
    # 3. Create and train vectorizer
    print("\n3. Training TF-IDF vectorizer...")
    vectorizer = create_vectorizer()
    X_train_vectorized = vectorizer.fit_transform(X_train)
    X_test_vectorized = vectorizer.transform(X_test)
    print(f"   ✓ Vocabulary size: {len(vectorizer.get_feature_names_out())}")
    
    # 4. Train model
    print("\n4. Training classifier...")
    model = create_model('logistic')  # Change to 'random_forest' for better accuracy
    model.fit(X_train_vectorized, y_train)
    print("   ✓ Model trained successfully")
    
    # 5. Evaluate
    print("\n5. Evaluating model...")
    y_pred = model.predict(X_test_vectorized)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"   ✓ Accuracy: {accuracy:.2%}")
    print("\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=label_encoder.classes_
    ))
    
    # 6. Save models
    print("\n6. Saving models...")
    os.makedirs('saved_models', exist_ok=True)
    
    joblib.dump(model, 'saved_models/model.pkl')
    joblib.dump(vectorizer, 'saved_models/vectorizer.pkl')
    joblib.dump(label_encoder, 'saved_models/label_encoder.pkl')
    
    print("   ✓ Models saved to saved_models/")
    
    # 7. Test prediction
    print("\n7. Testing prediction...")
    test_text = "Premium cotton t-shirt blue size M"
    test_vectorized = vectorizer.transform([preprocess_text(test_text)])
    test_pred = model.predict(test_vectorized)[0]
    test_proba = model.predict_proba(test_vectorized)[0]
    test_category = label_encoder.inverse_transform([test_pred])[0]
    
    print(f"   Test: '{test_text}'")
    print(f"   Predicted: {test_category} ({max(test_proba):.2%} confidence)")
    
    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    success = train_model()
    sys.exit(0 if success else 1)
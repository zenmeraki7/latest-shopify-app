import re
import string

def preprocess_text(text):
    """
    Clean and prepare text for classification
    """
    if not text:
        return ""
    
    # Lowercase
    text = text.lower()
    
    # Remove URLs
    text = re.sub(r'http\S+|www\S+', '', text)
    
    # Remove HTML tags
    text = re.sub(r'<.*?>', '', text)
    
    # Remove special characters but keep spaces
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    return text

def extract_features(product):
    """
    Extract features from product for training
    """
    features = {
        'title': product.get('title', ''),
        'description': product.get('description', ''),
        'tags': ' '.join(product.get('tags', [])),
        'vendor': product.get('vendor', ''),
        'price': product.get('price', 0)
    }
    
    # Combine text features
    text = f"{features['title']} {features['description']} {features['tags']} {features['vendor']}"
    
    return preprocess_text(text)
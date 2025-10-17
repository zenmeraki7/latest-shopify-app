from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

def create_model(model_type='naive_bayes'):
    """
    Create ML model pipeline
    
    Options:
    - 'naive_bayes': Fast, good for text
    - 'logistic': Balanced performance
    - 'random_forest': Best accuracy (slower)
    """
    
    if model_type == 'naive_bayes':
        model = MultinomialNB(alpha=0.1)
    elif model_type == 'logistic':
        model = LogisticRegression(
            max_iter=1000,
            C=1.0,
            class_weight='balanced'
        )
    elif model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=50,
            class_weight='balanced',
            n_jobs=-1
        )
    else:
        raise ValueError(f"Unknown model type: {model_type}")
    
    return model

def create_vectorizer():
    """
    Create TF-IDF vectorizer for text features
    """
    return TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),  # Unigrams and bigrams
        min_df=2,            # Ignore rare terms
        max_df=0.8,          # Ignore very common terms
        strip_accents='unicode',
        lowercase=True
    )
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
import time

def get_preprocessor(X):
    """
    Creates a scikit-learn preprocessor pipeline that handles numeric and categorical columns.
    """
    numeric_features = X.select_dtypes(include=['int64', 'float64']).columns
    categorical_features = X.select_dtypes(include=['object', 'category']).columns

    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])
    return preprocessor

def get_models(task_type):
    """Returns a dictionary of models based on the task type (classification/regression)"""
    if task_type == 'classification':
        return {
            'Logistic Regression': LogisticRegression(max_iter=1000),
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'SVM': SVC(probability=True, random_state=42)
        }
    else: # regression
        return {
            'Linear Regression': LinearRegression(),
            'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'SVR': SVR()
        }

def train_and_evaluate(df, target_column, task_type='classification'):
    """Trains multiple models and evaluates them, returning a dict of metrics."""
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")
        
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    # Auto-detect task type if not explicitly provided or to override
    num_unique_classes = y.nunique()
    if pd.api.types.is_numeric_dtype(y) and num_unique_classes > 20 and task_type != 'classification':
        task_type = 'regression'
    else:
        task_type = 'classification'
        # ensure target is encoded if categorical
        if y.dtype == 'object' or str(y.dtype) == 'category':
            from sklearn.preprocessing import LabelEncoder
            y = LabelEncoder().fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    preprocessor = get_preprocessor(X)
    models = get_models(task_type)
    
    results = []
    
    for name, model in models.items():
        start_time = time.time()
        
        pipeline = Pipeline(steps=[('preprocessor', preprocessor),
                                   ('model', model)])
        
        try:
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            training_time = time.time() - start_time
            
            if task_type == 'classification':
                acc = accuracy_score(y_test, y_pred)
                f1 = f1_score(y_test, y_pred, average='weighted')
                results.append({
                    "model_name": name,
                    "metrics": {
                        "Accuracy": float(acc),
                        "F1 Score": float(f1)
                    },
                    "training_time": float(training_time)
                })
            else:
                mse = mean_squared_error(y_test, y_pred)
                r2 = r2_score(y_test, y_pred)
                results.append({
                    "model_name": name,
                    "metrics": {
                        "MSE": float(mse),
                        "R2 Score": float(r2)
                    },
                    "training_time": float(training_time)
                })
        except Exception as e:
            results.append({
                "model_name": name,
                "error": str(e)
            })
            
    # Sort results by primary metric
    if task_type == 'classification':
        results = sorted(results, key=lambda x: x.get('metrics', {}).get('Accuracy', 0), reverse=True)
    else:
        results = sorted(results, key=lambda x: x.get('metrics', {}).get('R2 Score', -float('inf')), reverse=True)
        
    return {
        "task_type": task_type,
        "results": results
    }

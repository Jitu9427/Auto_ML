import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor, 
    GradientBoostingClassifier, GradientBoostingRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
    BaggingClassifier, BaggingRegressor,
    VotingClassifier, VotingRegressor,
    StackingClassifier, StackingRegressor
)
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, mean_absolute_error, r2_score, explained_variance_score, max_error,
    silhouette_score, davies_bouldin_score, calinski_harabasz_score
)
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

def get_base_estimators(task_type):
    if task_type == 'classification':
        return [
            ('lr', LogisticRegression(max_iter=1000)),
            ('dt', DecisionTreeClassifier(random_state=42)),
            ('nv', GaussianNB())
        ]
    else:
        return [
            ('lr', LinearRegression()),
            ('dt', DecisionTreeRegressor(random_state=42)),
            ('ridge', Ridge())
        ]

def get_models(task_type):
    """Returns a dictionary of models based on the task type (classification/regression/clustering)"""
    if task_type == 'classification':
        bases = get_base_estimators('classification')
        return {
            'Logistic Regression': LogisticRegression(max_iter=1000),
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'AdaBoost': AdaBoostClassifier(random_state=42),
            'Bagging': BaggingClassifier(random_state=42),
            'Voting Ensemble': VotingClassifier(estimators=bases, voting='hard'),
            'Stacking Ensemble': StackingClassifier(estimators=bases),
            'SVM': SVC(probability=True, random_state=42),
            'K-Nearest Neighbors': KNeighborsClassifier(),
            'Decision Tree': DecisionTreeClassifier(random_state=42),
            'Naive Bayes': GaussianNB()
        }
    elif task_type == 'regression':
        bases = get_base_estimators('regression')
        return {
            'Linear Regression': LinearRegression(),
            'Ridge Regression': Ridge(),
            'Lasso Regression': Lasso(),
            'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'AdaBoost': AdaBoostRegressor(random_state=42),
            'Bagging': BaggingRegressor(random_state=42),
            'Voting Ensemble': VotingRegressor(estimators=bases),
            'Stacking Ensemble': StackingRegressor(estimators=bases),
            'SVR': SVR(),
            'K-Nearest Neighbors': KNeighborsRegressor(),
            'Decision Tree': DecisionTreeRegressor(random_state=42)
        }
    elif task_type == 'clustering':
        return {
            'K-Means': KMeans(n_clusters=3, random_state=42),
            'DBSCAN': DBSCAN(),
            'Hierarchical (Agglomerative)': AgglomerativeClustering(n_clusters=3)
        }

def train_and_evaluate(df, target_column, task_type='classification', selected_models=None, selected_metrics=None):
    """Trains multiple models and evaluates them, returning a dict of metrics."""
    if task_type != 'clustering' and target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")
        
    if task_type == 'clustering':
        # Drop target column from clustering strictly if the user provided one, otherwise use whole DF
        if target_column in df.columns:
            X = df.drop(columns=[target_column])
        else:
            X = df.copy()
        y = None
    else:
        X = df.drop(columns=[target_column])
        y = df[target_column]
    
    # Auto-detect task type if not explicitly provided or to override
    if y is not None:
        num_unique_classes = y.nunique()
        if pd.api.types.is_numeric_dtype(y) and num_unique_classes > 20 and task_type != 'classification':
            task_type = 'regression'
        elif task_type != 'regression':
            task_type = 'classification'
            # ensure target is encoded if categorical
            if y.dtype == 'object' or str(y.dtype) == 'category':
                from sklearn.preprocessing import LabelEncoder
                y = LabelEncoder().fit_transform(y)

    if task_type != 'clustering':
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    else:
        X_train = X
        X_test = X
    
    preprocessor = get_preprocessor(X)
    all_models = get_models(task_type)
    
    # Filter models if selected_models is provided
    if selected_models and len(selected_models) > 0:
        models = {k: v for k, v in all_models.items() if k in selected_models}
    else:
        models = all_models
    
    results = []
    
    for name, model in models.items():
        start_time = time.time()
        
        pipeline = Pipeline(steps=[('preprocessor', preprocessor),
                                   ('model', model)])
        
        try:
            if task_type == 'clustering':
                # Preprocess first
                X_processed = preprocessor.fit_transform(X_train)
                y_pred = model.fit_predict(X_processed)
                training_time = time.time() - start_time
                
                calc_metrics = {}
                num_classes_found = len(set(y_pred))
                
                # Clustering metrics often require at least 2 clusters and not all points in a single cluster
                if num_classes_found > 1:
                    if not selected_metrics or 'Silhouette Score' in selected_metrics:
                        calc_metrics['Silhouette Score'] = float(silhouette_score(X_processed, y_pred))
                    if not selected_metrics or 'Davies-Bouldin Index' in selected_metrics:
                        calc_metrics['Davies-Bouldin Index'] = float(davies_bouldin_score(X_processed, y_pred))
                    if not selected_metrics or 'Calinski-Harabasz Index' in selected_metrics:
                        calc_metrics['Calinski-Harabasz Index'] = float(calinski_harabasz_score(X_processed, y_pred))
                else:
                    calc_metrics['Error'] = "Generated only 1 cluster. Cannot compute structure metrics."
                
                results.append({
                    "model_name": name,
                    "metrics": calc_metrics,
                    "training_time": float(training_time)
                })
            else:
                pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])
                pipeline.fit(X_train, y_train)
                y_pred = pipeline.predict(X_test)
                training_time = time.time() - start_time
                
                if task_type == 'classification':
                    calc_metrics = {}
                    if not selected_metrics or 'Accuracy' in selected_metrics:
                        calc_metrics['Accuracy'] = float(accuracy_score(y_test, y_pred))
                    if not selected_metrics or 'F1 Score' in selected_metrics:
                        calc_metrics['F1 Score'] = float(f1_score(y_test, y_pred, average='weighted'))
                    if not selected_metrics or 'Precision' in selected_metrics:
                        calc_metrics['Precision'] = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
                    if not selected_metrics or 'Recall' in selected_metrics:
                        calc_metrics['Recall'] = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
                        
                    results.append({
                        "model_name": name,
                        "metrics": calc_metrics,
                        "training_time": float(training_time)
                    })
                else: # Regression
                    calc_metrics = {}
                    mse = mean_squared_error(y_test, y_pred)
                    if not selected_metrics or 'MSE' in selected_metrics:
                        calc_metrics['MSE'] = float(mse)
                    if not selected_metrics or 'RMSE' in selected_metrics:
                        calc_metrics['RMSE'] = float(np.sqrt(mse))
                    if not selected_metrics or 'MAE' in selected_metrics:
                        calc_metrics['MAE'] = float(mean_absolute_error(y_test, y_pred))
                    if not selected_metrics or 'R2 Score' in selected_metrics:
                        calc_metrics['R2 Score'] = float(r2_score(y_test, y_pred))
                    if not selected_metrics or 'Explained Variance' in selected_metrics:
                        calc_metrics['Explained Variance'] = float(explained_variance_score(y_test, y_pred))
                    if not selected_metrics or 'Max Error' in selected_metrics:
                        calc_metrics['Max Error'] = float(max_error(y_test, y_pred))
                        
                    results.append({
                        "model_name": name,
                        "metrics": calc_metrics,
                        "training_time": float(training_time)
                    })
        except Exception as e:
            results.append({
                "model_name": name,
                "error": str(e)
            })
            
    # Sort results by primary metric (first selected metric, or default)
    if task_type == 'classification':
        sort_key = selected_metrics[0] if selected_metrics else 'Accuracy'
        results = sorted(results, key=lambda x: x.get('metrics', {}).get(sort_key, 0), reverse=True)
    elif task_type == 'regression':
        sort_key = selected_metrics[0] if selected_metrics else 'R2 Score'
        sort_reverse = True if sort_key in ['R2 Score', 'Explained Variance'] else False # Lower is better for MSE/RMSE/MAE
        results = sorted(results, key=lambda x: x.get('metrics', {}).get(sort_key, float('inf') if not sort_reverse else -float('inf')), reverse=sort_reverse)
    else: # clustering
        sort_key = selected_metrics[0] if selected_metrics else 'Silhouette Score'
        sort_reverse = True if sort_key in ['Silhouette Score', 'Calinski-Harabasz Index'] else False # Davies-Bouldin is better lower
        results = sorted(results, key=lambda x: x.get('metrics', {}).get(sort_key, float('inf') if not sort_reverse else -float('inf')), reverse=sort_reverse)
        
    return {
        "task_type": task_type,
        "results": results
    }

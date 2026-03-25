import pandas as pd
import numpy as np
import math
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.utils import all_estimators
import warnings
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, mean_absolute_error, r2_score, explained_variance_score, max_error,
    silhouette_score, davies_bouldin_score, calinski_harabasz_score
)
import time

def get_preprocessor(X, config=None):
    """
    Creates a scikit-learn preprocessor pipeline dynamically tracking numeric and categorical columns.
    """
    config = config or {}
    num_impute = config.get('numerical_imputation', 'mean')
    cat_impute = config.get('categorical_imputation', 'most_frequent')
    scaling_algo = config.get('scaling', 'StandardScaler')
    encoding_algo = config.get('encoding', 'OneHotEncoder')

    numeric_features = X.select_dtypes(include=['int64', 'float64']).columns
    categorical_features = X.select_dtypes(include=['object', 'category']).columns

    num_steps = [('imputer', SimpleImputer(strategy=num_impute))]
    if scaling_algo != 'None':
        from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, MaxAbsScaler
        scalers = {
            'StandardScaler': StandardScaler(),
            'MinMaxScaler': MinMaxScaler(),
            'RobustScaler': RobustScaler(),
            'MaxAbsScaler': MaxAbsScaler()
        }
        num_steps.append(('scaler', scalers.get(scaling_algo, StandardScaler())))

    numeric_transformer = Pipeline(steps=num_steps)

    cat_steps = [('imputer', SimpleImputer(strategy=cat_impute))]
    if encoding_algo == 'OrdinalEncoder':
        from sklearn.preprocessing import OrdinalEncoder
        cat_steps.append(('encoder', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)))
    else:
        from sklearn.preprocessing import OneHotEncoder
        cat_steps.append(('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False)))

    categorical_transformer = Pipeline(steps=cat_steps)

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])
    return preprocessor

def get_safe_estimators(task_type):
    """Dynamically loads all safe scikit-learn estimators and their default parameters."""
    if task_type == 'classification':
        estimators = dict(all_estimators(type_filter='classifier'))
    elif task_type == 'regression':
        estimators = dict(all_estimators(type_filter='regressor'))
    elif task_type == 'clustering':
        estimators = dict(all_estimators(type_filter='cluster'))
    else:
        return {}

    safe_estimators = {}
    
    excluded_keywords = ['CV', 'ClassifierChain', 'Stacking', 'Voting', 'Multi', 'OneVs', 'OutputCode', 'RegressorChain', 'Dummy']
    for name, ModelClass in estimators.items():
        if any(keyword in name for keyword in excluded_keywords):
            continue
            
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                instance = ModelClass()
                params = instance.get_params()
                
                safe_params = {}
                for k, v in params.items():
                    if isinstance(v, bool):
                        safe_params[k] = {'type': 'boolean', 'default': v}
                    elif isinstance(v, int) and not isinstance(v, bool):
                        safe_params[k] = {'type': 'int', 'default': v}
                    elif isinstance(v, float):
                        if math.isnan(v):
                            safe_params[k] = {'type': 'string', 'default': 'nan'}
                        elif math.isinf(v):
                            safe_params[k] = {'type': 'string', 'default': 'inf' if v > 0 else '-inf'}
                        else:
                            safe_params[k] = {'type': 'float', 'default': v}
                    elif isinstance(v, str):
                        choices = None
                        try:
                            from sklearn.utils._param_validation import StrOptions
                            constraints = getattr(ModelClass, '_parameter_constraints', {})
                            if k in constraints:
                                for constraint in constraints[k]:
                                    if isinstance(constraint, StrOptions):
                                        choices = list(constraint.options)
                                        if not all(isinstance(c, str) for c in choices): choices = None
                                        break
                        except Exception:
                            pass
                        safe_params[k] = {'type': 'string', 'default': v, 'choices': choices}
                    elif v is None:
                        choices = None
                        try:
                            from sklearn.utils._param_validation import StrOptions
                            constraints = getattr(ModelClass, '_parameter_constraints', {})
                            if k in constraints:
                                for constraint in constraints[k]:
                                    if isinstance(constraint, StrOptions):
                                        choices = list(constraint.options)
                                        if not all(isinstance(c, str) for c in choices): choices = None
                                        break
                        except Exception:
                            pass
                        safe_params[k] = {'type': 'string', 'default': "", 'choices': choices}
                
                safe_estimators[name] = safe_params
        except Exception:
            continue
            
    return safe_estimators

def get_estimator_class(task_type, model_name):
    if task_type == 'classification':
        estimators = dict(all_estimators(type_filter='classifier'))
    elif task_type == 'regression':
        estimators = dict(all_estimators(type_filter='regressor'))
    elif task_type == 'clustering':
        estimators = dict(all_estimators(type_filter='cluster'))
    else:
        return None
    return estimators.get(model_name)

def train_and_evaluate(df, target_column, task_type='classification', model_name=None, model_params=None, selected_metrics=None, preprocessing_config=None):
    """Trains a single models and evaluates it, returning metrics."""
    if task_type != 'clustering' and target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")
        
    if task_type == 'clustering':
        if target_column in df.columns:
            X = df.drop(columns=[target_column])
        else:
            X = df.copy()
        y = None
    else:
        X = df.drop(columns=[target_column])
        y = df[target_column]
    
    if y is not None:
        num_unique_classes = y.nunique()
        if pd.api.types.is_numeric_dtype(y) and num_unique_classes > 20 and task_type != 'classification':
            task_type = 'regression'
        elif task_type != 'regression':
            task_type = 'classification'
            if y.dtype == 'object' or str(y.dtype) == 'category':
                from sklearn.preprocessing import LabelEncoder
                y = LabelEncoder().fit_transform(y)

    prep = preprocessing_config or {}
    test_size = float(prep.get('test_size', 0.2))
    random_state = int(prep.get('random_state', 42))

    if task_type != 'clustering':
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
    else:
        X_train = X
        X_test = X
        
    preprocessor = get_preprocessor(X, prep)
    
    ModelClass = get_estimator_class(task_type, model_name)
    if not ModelClass:
        raise ValueError(f"Model '{model_name}' is not supported for task type '{task_type}'.")

    # Clean input kwargs (e.g. empty strings become None)
    clean_params = {}
    for k, v in (model_params or {}).items():
        if v == "" and k != "": 
            clean_params[k] = None
        elif v == "inf":
            clean_params[k] = float('inf')
        elif v == "-inf":
            clean_params[k] = float('-inf')
        elif v == "nan":
            clean_params[k] = float('nan')
        else:
            clean_params[k] = v

    try:
        model = ModelClass(**clean_params)
    except Exception as e:
        raise ValueError(f"Failed to instantiate parameters for {model_name}: {e}")

    start_time = time.time()
    
    try:
        if task_type == 'clustering':
            X_processed = preprocessor.fit_transform(X_train)
            if hasattr(model, 'fit_predict'):
                y_pred = model.fit_predict(X_processed)
            else:
                y_pred = model.fit(X_processed).labels_
            training_time = time.time() - start_time
            
            calc_metrics = {}
            num_classes_found = len(set(y_pred))
            
            if num_classes_found > 1:
                if not selected_metrics or 'Silhouette Score' in selected_metrics:
                    calc_metrics['Silhouette Score'] = float(silhouette_score(X_processed, y_pred))
                if not selected_metrics or 'Davies-Bouldin Index' in selected_metrics:
                    calc_metrics['Davies-Bouldin Index'] = float(davies_bouldin_score(X_processed, y_pred))
                if not selected_metrics or 'Calinski-Harabasz Index' in selected_metrics:
                    calc_metrics['Calinski-Harabasz Index'] = float(calinski_harabasz_score(X_processed, y_pred))
            else:
                calc_metrics['Error'] = "Generated only 1 cluster. Cannot compute structure metrics."
            
            return {
                "task_type": task_type,
                "model_name": model_name,
                "params": clean_params,
                "metrics": calc_metrics,
                "training_time": float(training_time)
            }
        else:
            pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            training_time = time.time() - start_time
            
            calc_metrics = {}
            if task_type == 'classification':
                if not selected_metrics or 'Accuracy' in selected_metrics:
                    calc_metrics['Accuracy'] = float(accuracy_score(y_test, y_pred))
                if not selected_metrics or 'F1 Score' in selected_metrics:
                    calc_metrics['F1 Score'] = float(f1_score(y_test, y_pred, average='weighted'))
                if not selected_metrics or 'Precision' in selected_metrics:
                    calc_metrics['Precision'] = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
                if not selected_metrics or 'Recall' in selected_metrics:
                    calc_metrics['Recall'] = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
            else: # Regression
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
                    
            return {
                "task_type": task_type,
                "model_name": model_name,
                "params": clean_params,
                "metrics": calc_metrics,
                "training_time": float(training_time)
            }
    except Exception as e:
        raise RuntimeError(f"Pipeline error for {model_name}: {str(e)}")

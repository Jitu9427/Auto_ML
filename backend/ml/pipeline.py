import pandas as pd
import numpy as np
import math
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.utils import all_estimators
import warnings
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    mean_squared_error, mean_absolute_error, r2_score, explained_variance_score, max_error,
    silhouette_score, davies_bouldin_score, calinski_harabasz_score
)
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer, KNNImputer
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler, MaxAbsScaler,
    OneHotEncoder, OrdinalEncoder,
    FunctionTransformer, PowerTransformer, KBinsDiscretizer
)
try:
    from sklearn.preprocessing import TargetEncoder
except ImportError:
    TargetEncoder = None

import time

class OutlierWinsorizer(BaseEstimator, TransformerMixin):
    def __init__(self, method='z-score', action='cap', threshold=3.0):
        self.method = method
        self.action = action
        self.threshold = threshold
        self.bounds_ = {}
        
    def fit(self, X, y=None):
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                if self.method == 'z-score':
                    mean = X[col].mean()
                    std = X[col].std()
                    self.bounds_[col] = (mean - self.threshold * std, mean + self.threshold * std)
                elif self.method == 'iqr':
                    q1 = X[col].quantile(0.25)
                    q3 = X[col].quantile(0.75)
                    iqr = q3 - q1
                    self.bounds_[col] = (q1 - 1.5 * iqr, q3 + 1.5 * iqr)
                elif self.method == 'percentile':
                    lower = X[col].quantile(0.01 if self.threshold == 3.0 else 0.05)
                    upper = X[col].quantile(0.99 if self.threshold == 3.0 else 0.95)
                    self.bounds_[col] = (lower, upper)
        return self

    def transform(self, X):
        X_out = X.copy()
        if not isinstance(X_out, pd.DataFrame):
            X_out = pd.DataFrame(X_out, columns=self.bounds_.keys() if len(self.bounds_) == X_out.shape[1] else None)
            
        for col, (lower, upper) in self.bounds_.items():
            if col in X_out.columns:
                if self.action == 'cap':
                    X_out[col] = X_out[col].clip(lower=lower, upper=upper)
        return X_out

    def get_feature_names_out(self, input_features=None):
        return input_features

class FrequencyEncoder(BaseEstimator, TransformerMixin):
    def __init__(self):
        self.freq_map_ = {}
        
    def fit(self, X, y=None):
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        for col in X.columns:
            self.freq_map_[col] = X[col].value_counts(normalize=True).to_dict()
        return self
        
    def transform(self, X):
        X_out = X.copy()
        if not isinstance(X_out, pd.DataFrame):
            X_out = pd.DataFrame(X_out, columns=self.freq_map_.keys() if len(self.freq_map_) == X_out.shape[1] else None)
        for col, mapping in self.freq_map_.items():
            if col in X_out.columns:
                X_out[col] = X_out[col].map(mapping).fillna(0)
        return X_out
        
    def get_feature_names_out(self, input_features=None):
        return input_features

def apply_pandas_preprocessing(df, target_column, config):
    # Deprecated in V12. Pandas mutates natively strictly via apply_step in router.py
    return df

def get_preprocessor(X, config=None):
    # Deprecated in V12. Mapped dynamically iteratively in router.py
    pass
    
    categorical_constant_value = str(config.get('categorical_constant_value', 'Unknown'))



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
    prep = preprocessing_config or {}
    
    prep = preprocessing_config or {}
    
    if task_type != 'clustering' and target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset after trimming.")
        
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
            if hasattr(model, 'fit_predict'):
                y_pred = model.fit_predict(X_train)
            else:
                y_pred = model.fit(X_train).labels_
            training_time = time.time() - start_time
            
            calc_metrics = {}
            num_classes_found = len(set(y_pred))
            
            if num_classes_found > 1:
                if not selected_metrics or 'Silhouette Score' in selected_metrics:
                    calc_metrics['Silhouette Score'] = float(silhouette_score(X_train, y_pred))
                if not selected_metrics or 'Davies-Bouldin Index' in selected_metrics:
                    calc_metrics['Davies-Bouldin Index'] = float(davies_bouldin_score(X_train, y_pred))
                if not selected_metrics or 'Calinski-Harabasz Index' in selected_metrics:
                    calc_metrics['Calinski-Harabasz Index'] = float(calinski_harabasz_score(X_train, y_pred))
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
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
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

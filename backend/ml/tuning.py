import sys
import subprocess

try:
    import optuna
except ImportError:
    print(f"Auto-Installing required module 'optuna' natively into {sys.executable}...", flush=True)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "optuna"])
    import optuna

import numpy as np
import pandas as pd
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from .pipeline import get_estimator_class, get_safe_estimators
import warnings

warnings.filterwarnings('ignore')

def get_dynamic_search_space(task_type, model_name, trial=None):
    """
    Intelligently infer an aggressive search distribution for ALL available hyperparameters 
    on ANY arbitrary algorithm dynamically by reading its signature parameters.
    """
    from scipy.stats import randint, uniform
    
    # Extract the absolute parameter definitions for the current model
    estimators_info = get_safe_estimators(task_type)
    if model_name not in estimators_info:
        raise ValueError(f"Model {model_name} is completely unrecognized in safety engine.")
        
    model_params = estimators_info[model_name]
    
    space_optuna = {}
    space_random = {}
    
    # Exclude system/internal execution parameters from being mathematically tuned
    blacklist = ['random_state', 'n_jobs', 'verbose', 'warm_start', 'oob_score', 'copy_X', 'fit_intercept']
    
    for param_name, info in model_params.items():
        if param_name in blacklist:
            continue
            
        ptype = info.get('type')
        def_val = info.get('default')
        choices = info.get('choices')
        
        # 1. Categorical / Enum Strings
        if choices is not None and len(choices) > 1:
            if trial:
                space_optuna[param_name] = trial.suggest_categorical(param_name, choices)
            else:
                space_random[param_name] = choices
            continue
            
        # 2. Booleans
        if ptype == 'boolean':
            if trial:
                space_optuna[param_name] = trial.suggest_categorical(param_name, [True, False])
            else:
                space_random[param_name] = [True, False]
            continue
            
        # 3. Integers (max_depth, n_estimators, min_samples)
        if ptype == 'int' and def_val is not None:
            # Smart bounding
            low = 1 if 'min_samples' in param_name else 2
            high = max(10, def_val * 3)
            if 'estimators' in param_name or 'iterations' in param_name:
                low = 50
                high = 300
            
            if trial:
                space_optuna[param_name] = trial.suggest_int(param_name, low, high)
            else:
                space_random[param_name] = randint(low, high + 1)
            continue
            
        # 4. Floats (learning_rate, alpha, C, gamma)
        if ptype == 'float' and def_val is not None:
            low = 1e-4
            high = 10.0
            
            if 'learning_rate' in param_name or 'alpha' in param_name or 'tol' in param_name:
                low = 1e-5
                high = 1.0
            elif param_name == 'C' or 'gamma' in param_name:
                low = 1e-4
                high = 100.0
            elif def_val > 0 and def_val <= 1.0:
                low = 1e-3
                high = 1.0
                
            if trial:
                space_optuna[param_name] = trial.suggest_float(param_name, low, high, log=True)
            else:
                space_random[param_name] = uniform(low, high - low)
            continue
            
    # Fallback to defaults or return inferred maps!
    return space_optuna if trial else space_random

def tune_hyperparameters(df, target_column, task_type, model_name, tuning_method, preprocessing_config=None, max_trials=15):
    """
    Orchestrates the tuning loop across ML estimator wrappers based on specified algorithm logic.
    Dynamically tunes ALL available parameters for ANY supported sklearn algorithm.
    """
    if task_type == 'clustering':
        raise ValueError("Hyperparameter tuning is currently not supported for unsupervised clustering.")

    ModelClass = get_estimator_class(task_type, model_name)
    if not ModelClass:
        raise ValueError(f"Model '{model_name}' is not supported.")
    
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")
        
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    # ---- Auto-Encode non-numeric features so sklearn doesn't crash ----
    from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
    
    # Encode categorical target
    if task_type == 'classification' and (y.dtype == 'object' or str(y.dtype) == 'category'):
        y = LabelEncoder().fit_transform(y)
    
    # Encode categorical feature columns via OrdinalEncoder (fast, preserves shape)
    cat_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
    if cat_cols:
        enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        X[cat_cols] = enc.fit_transform(X[cat_cols])
    
    # Fill any remaining NaNs with column median
    X = X.fillna(X.median(numeric_only=True))
        
    # Sample for speed if massive dataset
    if len(X) > 5000:
        from sklearn.utils import resample
        X, y = resample(X, y, n_samples=5000, random_state=42)

    # Standard splitting for speed. Tuning is done on Train set.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    metric_scorer = 'accuracy' if task_type == 'classification' else 'neg_mean_squared_error'

    def clean_params(params):
        """Convert numpy types → standard Python for JSON serialization."""
        clean = {}
        for k, v in params.items():
            if isinstance(v, np.floating):
                clean[k] = float(v)
            elif isinstance(v, np.integer):
                clean[k] = int(v)
            elif isinstance(v, np.bool_):
                clean[k] = bool(v)
            else:
                clean[k] = v
        return clean

    # ── 1. Random Search ──────────────────────────────────────────
    if tuning_method == 'Random Search':
        space = get_dynamic_search_space(task_type, model_name, trial=None)
        if not space:
            raise ValueError(f"No tunable parameters found for {model_name}.")
        model = ModelClass(random_state=42) if 'random_state' in ModelClass().get_params() else ModelClass()
        search = RandomizedSearchCV(
            model, param_distributions=space, n_iter=max_trials,
            scoring=metric_scorer, cv=3, random_state=42, n_jobs=-1, error_score='raise'
        )
        search.fit(X_train, y_train)
        return clean_params(search.best_params_)

    # ── 2. Bayesian Optimization (Optuna TPE) ────────────────────
    elif tuning_method == 'Bayesian Optimization':
        from sklearn.model_selection import cross_val_score
        optuna.logging.set_verbosity(optuna.logging.WARNING)
        
        def objective(trial):
            params = get_dynamic_search_space(task_type, model_name, trial=trial)
            try:
                model = ModelClass(**params)
                score = cross_val_score(model, X_train, y_train, cv=3, scoring=metric_scorer, n_jobs=-1, error_score=-999).mean()
            except Exception:
                return -999.0
            return score
            
        study = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=42))
        study.optimize(objective, n_trials=max_trials, show_progress_bar=False)
        return clean_params(study.best_params)

    # ── 3. Hyperband (Optuna Successive Halving) ─────────────────
    elif tuning_method == 'Hyperband':
        from sklearn.model_selection import cross_val_score
        optuna.logging.set_verbosity(optuna.logging.WARNING)
        
        def objective(trial):
            params = get_dynamic_search_space(task_type, model_name, trial=trial)
            try:
                model = ModelClass(**params)
                score = cross_val_score(model, X_train, y_train, cv=3, scoring=metric_scorer, n_jobs=-1, error_score=-999).mean()
            except Exception:
                return -999.0
            return score
            
        pruner = optuna.pruners.HyperbandPruner(min_resource=1, max_resource=max_trials, reduction_factor=3)
        study = optuna.create_study(direction='maximize', pruner=pruner, sampler=optuna.samplers.TPESampler(seed=42))
        study.optimize(objective, n_trials=max_trials, show_progress_bar=False)
        return clean_params(study.best_params)
        
    else:
        raise ValueError(f"Unknown tuning method: {tuning_method}")


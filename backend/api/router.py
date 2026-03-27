from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import io
import uuid
from pydantic import BaseModel
from typing import List, Dict, Any
import matplotlib.pyplot as plt
import seaborn as sns
import base64
import matplotlib
matplotlib.use('Agg')  # Required for headless server rendering

from ml.pipeline import train_and_evaluate, get_safe_estimators, apply_pandas_preprocessing, get_preprocessor

router = APIRouter()

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str = ""
    task_type: str = "auto"
    model_name: str
    model_params: Dict[str, Any] = {}
    selected_metrics: List[str] = []
    preprocessing_config: Dict[str, Any] = None

class EDARequest(BaseModel):
    dataset_id: str
    selected_columns: List[str]
    plot_type: str

class PreprocessApplyRequest(BaseModel):
    dataset_id: str
    target_column: str = ""
    preprocessing_config: Dict[str, Any] = {}

class PreprocessStepRequest(BaseModel):
    dataset_id: str
    columns: List[str]
    technique: str
    method: str
    params: Dict[str, Any] = {}

# In-memory storage for datasets (in a real scalable app, use Redis/S3/Database)
DATASETS = {}

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/models/{task_type}")
def get_models(task_type: str):
    if task_type not in ['classification', 'regression', 'clustering']:
        raise HTTPException(status_code=400, detail="Invalid task type.")
    models = get_safe_estimators(task_type)
    return {"models": models}

@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        dataset_id = str(uuid.uuid4())
        DATASETS[dataset_id] = df
        
        columns = df.columns.tolist()
        
        # Determine column types
        dtypes = df.dtypes
        column_types = {}
        for col in columns:
            if pd.api.types.is_numeric_dtype(dtypes[col]):
                column_types[col] = "numerical"
            else:
                column_types[col] = "categorical"
        
        # Provide basic summary of target columns (typically non-id columns)
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "columns": columns,
            "column_types": column_types,
            "num_rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")

@router.post("/train")
def train_models(request: TrainRequest):
    if request.dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
        
    df = DATASETS[request.dataset_id]
    
    try:
        results = train_and_evaluate(
            df, 
            request.target_column, 
            request.task_type, 
            request.model_name,
            request.model_params,
            request.selected_metrics,
            request.preprocessing_config
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing training pipeline: {str(e)}")

@router.get("/eda/summary/{dataset_id}")
def get_eda_summary(dataset_id: str):
    if dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    
    df = DATASETS[dataset_id]
    
    # Phase 1: Summary Stats
    try:
        sample = df.sample(min(5, len(df))).fillna("NaN").to_dict(orient="records")
    except:
        sample = df.head(min(5, len(df))).fillna("NaN").to_dict(orient="records")
        
    shape = list(df.shape) # [rows, cols]
    missing = df.isnull().sum().to_dict()
    duplicates = int(df.duplicated().sum())
    
    # describe() for numerical
    num_df = df.select_dtypes(include='number')
    if not num_df.empty:
        describe_dict = num_df.describe().fillna("NaN").to_dict()
    else:
        describe_dict = {}
        
    # Memory estimation roughly
    memory_mb = round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
    
    dtypes_dict = {str(k): str(v) for k, v in df.dtypes.items()}
    
    return {
        "shape": shape,
        "sample": sample,
        "missing": missing,
        "duplicates": duplicates,
        "describe": describe_dict,
        "dtypes": dtypes_dict,
        "memory_mb": memory_mb
    }

@router.post("/eda/plot")
def generate_eda_plot(request: EDARequest):
    if request.dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
        
    df = DATASETS[request.dataset_id]
    cols = request.selected_columns
    ptype = request.plot_type
    
    # Restrict to valid columns for safety
    valid_cols = [c for c in cols if c in df.columns]
    if not valid_cols:
        raise HTTPException(status_code=400, detail="No valid columns provided.")
    
    fig, ax = plt.subplots(figsize=(8, 6))
    
    try:
        # Special Custom Mappings
        if ptype == 'pie':
            if len(valid_cols) < 1: raise ValueError("Need at least 1 column for pie chart")
            df[valid_cols[0]].value_counts().plot.pie(autopct='%1.1f%%', ax=ax)
            ax.set_ylabel('')
        elif ptype == 'crosstab_heatmap':
            if len(valid_cols) < 2: raise ValueError("Need 2 categorical columns")
            cross = pd.crosstab(df[valid_cols[0]], df[valid_cols[1]])
            sns.heatmap(cross, annot=True, fmt='d', cmap='Blues', ax=ax)
        elif ptype == 'cluster_map':
            if len(valid_cols) < 2: raise ValueError("Need 2 columns")
            plt.close(fig)
            cross = pd.crosstab(df[valid_cols[0]], df[valid_cols[1]])
            cm = sns.clustermap(cross, annot=True, fmt='d', cmap='Blues', figsize=(8, 6))
            fig = cm.fig
        elif ptype == 'distplot_compare':
            if len(valid_cols) < 2: raise ValueError("Need 2 columns (1 Num, 1 Cat)")
            from pandas.api.types import is_numeric_dtype
            col1, col2 = valid_cols[0], valid_cols[1]
            if not is_numeric_dtype(df[col1]) and is_numeric_dtype(df[col2]):
                sns.kdeplot(data=df, x=col2, hue=col1, fill=True, common_norm=False, ax=ax)
            elif not is_numeric_dtype(df[col2]) and is_numeric_dtype(df[col1]):
                sns.kdeplot(data=df, x=col1, hue=col2, fill=True, common_norm=False, ax=ax)
            else:
                sns.kdeplot(data=df, x=col1, hue=col2, fill=True, common_norm=False, ax=ax)
        elif ptype == 'correlation_heatmap':
            corr = df[valid_cols].select_dtypes(include='number').corr()
            sns.heatmap(corr, annot=True, cmap='coolwarm', ax=ax, fmt=".2f")
        else:
            # Dynamic Seaborn Resolving Engine
            if not hasattr(sns, ptype):
                raise ValueError(f"Visual type '{ptype}' is not an available Seaborn capability.")
                
            func = getattr(sns, ptype)
            figure_level_plots = ['relplot', 'catplot', 'displot', 'lmplot', 'pairplot', 'jointplot', 'clustermap', 'hexbin']
            
            kwargs = {"data": df}
            if ptype == 'pairplot':
                 kwargs = {"data": df[valid_cols]}
            else:
                 if len(valid_cols) == 1:
                     kwargs["x"] = valid_cols[0]
                 elif len(valid_cols) >= 2:
                     kwargs["x"] = valid_cols[0]
                     kwargs["y"] = valid_cols[1]
            
            if ptype not in figure_level_plots:
                 kwargs["ax"] = ax
                 
            # Custom argument patching for specific legacy aliases
            if ptype == 'distplot':
                kwargs['stat'] = 'density'
                kwargs['kde'] = True
                func = sns.histplot # distplot is deprecated
            elif ptype == 'histogram':
                kwargs['kde'] = False
                func = sns.histplot
            elif ptype == 'hexbin':
                kwargs['kind'] = 'hex'
                func = sns.jointplot
                
            result = func(**kwargs)
            
            if ptype in figure_level_plots or ptype == 'hexbin':
                 plt.close(fig)
                 if hasattr(result, 'fig'):
                     fig = result.fig
                 else:
                     fig = result
                     
        # Ensure proper layout
        if ptype not in ('pairplot', 'hexbin', 'jointplot', 'cluster_map'):
            fig.tight_layout()
            
        # Convert figure to base64
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        return {"image_base64": img_base64, "plot_type": ptype, "columns": cols}
    except ValueError as ve:
        plt.close(fig)
        raise HTTPException(status_code=400, detail=f"Incompatible Data Types for {ptype}: {str(ve)}")
    except TypeError as te:
        plt.close(fig)
        raise HTTPException(status_code=400, detail=f"Mathematics Error against {ptype} structure: {str(te)}. Try changing column combinations.")
    except Exception as e:
        plt.close(fig)
        raise HTTPException(status_code=500, detail=f"Failed to generate plot: {str(e)}")


@router.post("/eda/head")
def get_eda_head(request: EDARequest):
    if request.dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found.")
        
    df = DATASETS[request.dataset_id]
    cols = request.selected_columns
    
    valid_cols = [c for c in cols if c in df.columns]
    if not valid_cols:
        raise HTTPException(status_code=400, detail="No valid columns provided.")
    
    try:
        sample = df[valid_cols].head(5).fillna("NaN").to_dict(orient="records")
        return {"columns": valid_cols, "sample": sample}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting data sample: {str(e)}")

@router.post("/preprocess/apply")
def apply_preprocessing(request: PreprocessApplyRequest):
    if request.dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
        
    df = DATASETS[request.dataset_id].copy()
    
    try:
        # 1. Apply Pandas native mechanics
        df_clean = apply_pandas_preprocessing(df, request.target_column, request.preprocessing_config)
        
        has_target = request.target_column and request.target_column in df_clean.columns
        if has_target:
            X = df_clean.drop(columns=[request.target_column])
            y = df_clean[request.target_column]
        else:
            X = df_clean
            y = None
            
        # 2. Extract Pipeline parameters
        preprocessor = get_preprocessor(X, request.preprocessing_config)
        
        # 3. Transform mathematically
        if y is not None:
             X_trans = preprocessor.fit_transform(X, y)
        else:
             X_trans = preprocessor.fit_transform(X)
             
        # 4. Guarantee DataFrame Output Structure
        if not isinstance(X_trans, pd.DataFrame):
            try:
                feature_names = preprocessor.get_feature_names_out()
            except:
                feature_names = [f"Feature_{i}" for i in range(X_trans.shape[1])]
            X_trans_df = pd.DataFrame(X_trans, columns=feature_names, index=X.index)
        else:
            X_trans_df = X_trans.copy()
            
        # Re-map stripped label explicitly
        if has_target:
             X_trans_df[request.target_column] = y.values
             
        # 5. Build Dictionaries globally
        before_sample = df.head(5).fillna("NaN").to_dict(orient="records")
        after_sample = X_trans_df.head(5).fillna("NaN").to_dict(orient="records")
        
        new_id = str(uuid.uuid4())
        DATASETS[new_id] = X_trans_df
        
        return {
             "message": "Preprocessing applied successfully.",
             "new_dataset_id": new_id,
             "before_sample": before_sample,
             "after_sample": after_sample,
             "before_shape": list(df.shape),
             "after_shape": list(X_trans_df.shape)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply preprocessing parameters: {str(e)}")

@router.get("/dataset/download/{dataset_id}")
def download_dataset(dataset_id: str):
    if dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found or expired.")
        
    df = DATASETS[dataset_id]
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=processed_dataset_{dataset_id[:8]}.csv"
    
    return response

@router.post("/preprocess/apply_step")
def apply_preprocessing_step(request: PreprocessStepRequest):
    if request.dataset_id not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found or expired.")
        
    df = DATASETS[request.dataset_id].copy()
    valid_cols = [c for c in request.columns if c in df.columns]
    
    if not valid_cols:
        raise HTTPException(status_code=400, detail="No geometrically valid columns were targeted.")
        
    try:
        before_sample = df[valid_cols].head(5).fillna("NaN").astype(str).to_dict(orient="records")
        
        from sklearn.impute import SimpleImputer, KNNImputer
        from sklearn.experimental import enable_iterative_imputer
        from sklearn.impute import IterativeImputer
        from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, MaxAbsScaler
        from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, TargetEncoder
        from sklearn.preprocessing import FunctionTransformer, PowerTransformer, KBinsDiscretizer
        from ml.pipeline import OutlierWinsorizer, FrequencyEncoder
        import numpy as np
        
        subset = df[valid_cols].copy()
        technique = request.technique
        method = request.method
        p = request.params
        
        if technique == 'imputation':
            if method == 'complete_case':
                df = df.dropna(subset=valid_cols)
                subset = df[valid_cols].copy()
            elif method in ['mean', 'median', 'most_frequent']:
                subset[:] = SimpleImputer(strategy=method).fit_transform(subset)
            elif method == 'constant':
                val = p.get('fill_value', 0)
                subset[:] = SimpleImputer(strategy='constant', fill_value=val).fit_transform(subset)
            elif method == 'knn':
                subset[:] = KNNImputer(n_neighbors=int(p.get('n_neighbors', 5))).fit_transform(subset)
            elif method == 'mice':
                subset[:] = IterativeImputer(random_state=42).fit_transform(subset)
                
        elif technique == 'outlier':
            action = p.get('action', 'cap')
            if action == 'trim':
                for c in valid_cols:
                    if method == 'z-score':
                        thresh = float(p.get('threshold', 3.0))
                        mean, std = df[c].mean(), df[c].std()
                        df = df[(df[c] >= mean - thresh*std) & (df[c] <= mean + thresh*std)]
                    elif method == 'iqr':
                        q1, q3 = df[c].quantile(0.25), df[c].quantile(0.75)
                        iqr = q3 - q1
                        df = df[(df[c] >= q1 - 1.5*iqr) & (df[c] <= q3 + 1.5*iqr)]
                    elif method == 'percentile':
                        q1, q99 = df[c].quantile(0.01), df[c].quantile(0.99)
                        df = df[(df[c] >= q1) & (df[c] <= q99)]
                subset = df[valid_cols].copy()
            elif action == 'cap':
                thresh = float(p.get('threshold', 3.0))
                subset[:] = OutlierWinsorizer(method=method, action='cap', threshold=thresh).fit_transform(subset)
                
        elif technique == 'scaling':
            if method == 'StandardScaler': subset[:] = StandardScaler().fit_transform(subset)
            elif method == 'MinMaxScaler': subset[:] = MinMaxScaler().fit_transform(subset)
            elif method == 'RobustScaler': subset[:] = RobustScaler().fit_transform(subset)
            elif method == 'MaxAbsScaler': subset[:] = MaxAbsScaler().fit_transform(subset)
            
        elif technique == 'transformation':
            if method == 'log': subset[:] = FunctionTransformer(np.log1p).fit_transform(subset)
            elif method == 'reciprocal': subset[:] = FunctionTransformer(lambda x: 1/(np.abs(x)+1e-8)).fit_transform(subset)
            elif method == 'square': subset[:] = FunctionTransformer(np.square).fit_transform(subset)
            elif method == 'sqrt': subset[:] = FunctionTransformer(lambda x: np.sqrt(np.abs(x))).fit_transform(subset)
            
        elif technique == 'power_transform':
             subset[:] = PowerTransformer(method=method).fit_transform(subset)
             
        elif technique == 'binning':
             bins = int(p.get('n_bins', 5))
             subset[:] = KBinsDiscretizer(n_bins=bins, encode='ordinal', strategy=method).fit_transform(subset)
             
        elif technique == 'encoding':
             if method == 'OrdinalEncoder':
                 subset[:] = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1).fit_transform(subset)
             elif method == 'FrequencyEncoder':
                 subset[:] = FrequencyEncoder().fit_transform(subset)
             elif method == 'TargetEncoder':
                 target_col = p.get('target_column')
                 if not target_col or target_col not in df.columns:
                     raise ValueError("TargetEncoder requires mapping a valid mathematical target column.")
                 subset[:] = TargetEncoder().fit_transform(subset, df[target_col])
             elif method == 'OneHotEncoder':
                 enc = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
                 encoded_vals = enc.fit_transform(subset)
                 feature_names = enc.get_feature_names_out(valid_cols)
                 encoded_df = pd.DataFrame(encoded_vals, columns=feature_names, index=df.index)
                 df = pd.concat([df.drop(columns=valid_cols), encoded_df], axis=1)
                 subset = encoded_df # Maps expansive dummy variables explicitly
                 valid_cols = list(feature_names)
                 
        # Explicit DataFrame Mutator bypassing Sklearn Prefix
        if technique != 'encoding' or method != 'OneHotEncoder':
             for col in valid_cols:
                 df[col] = subset[col]
             
        after_sample = subset.head(5).fillna("NaN").astype(str).to_dict(orient="records")
             
        new_id = str(uuid.uuid4())
        DATASETS[new_id] = df
        
        return {
             "message": f"Successfully mathematically applied {method} sequentially.",
             "new_dataset_id": new_id,
             "before_sample": before_sample,
             "after_sample": after_sample,
             "before_shape": list(DATASETS[request.dataset_id].shape),
             "after_shape": list(df.shape),
             "new_columns": list(df.columns)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Algorithmic Data Violation: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Safeguard failure mutating dataset: {str(e)}")

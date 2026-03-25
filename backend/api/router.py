from fastapi import APIRouter, File, UploadFile, HTTPException
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

from ml.pipeline import train_and_evaluate, get_safe_estimators

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
        if len(valid_cols) == 1:
            col = valid_cols[0]
            if ptype == 'histogram':
                sns.histplot(data=df, x=col, kde=False, ax=ax)
            elif ptype == 'distplot':
                sns.histplot(data=df, x=col, kde=True, stat="density", ax=ax)
            elif ptype == 'boxplot':
                sns.boxplot(data=df, y=col, ax=ax)
            elif ptype == 'countplot':
                sns.countplot(data=df, x=col, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'pie':
                df[col].value_counts().plot.pie(autopct='%1.1f%%', ax=ax)
                ax.set_ylabel('')
            elif ptype == 'kdeplot':
                sns.kdeplot(data=df, x=col, fill=True, ax=ax)
            elif ptype == 'rugplot':
                sns.rugplot(data=df, x=col, ax=ax)
                sns.histplot(data=df, x=col, kde=True, alpha=0.3, ax=ax) # usually paired
            elif ptype == 'ecdfplot':
                sns.ecdfplot(data=df, x=col, ax=ax)
                
        elif len(valid_cols) == 2:
            col1, col2 = valid_cols[0], valid_cols[1]
            if ptype == 'scatter':
                sns.scatterplot(data=df, x=col1, y=col2, ax=ax)
            elif ptype == 'boxplot':
                sns.boxplot(data=df, x=col1, y=col2, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'violin':
                sns.violinplot(data=df, x=col1, y=col2, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'bar':
                sns.barplot(data=df, x=col1, y=col2, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'stripplot':
                sns.stripplot(data=df, x=col1, y=col2, ax=ax, alpha=0.7)
                plt.xticks(rotation=45)
            elif ptype == 'swarmplot':
                sns.swarmplot(data=df, x=col1, y=col2, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'pointplot':
                sns.pointplot(data=df, x=col1, y=col2, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'hexbin':
                plt.close(fig)
                hb = sns.jointplot(data=df, x=col1, y=col2, kind="hex")
                fig = hb.fig
            elif ptype == 'jointplot':
                plt.close(fig)
                jp = sns.jointplot(data=df, x=col1, y=col2, kind="scatter")
                fig = jp.fig
            elif ptype == 'distplot_compare':
                # hue requires mostly categorical variable. Let's find which one is categorical
                from pandas.api.types import is_numeric_dtype
                if not is_numeric_dtype(df[col1]) and is_numeric_dtype(df[col2]):
                    sns.kdeplot(data=df, x=col2, hue=col1, fill=True, common_norm=False, ax=ax)
                elif not is_numeric_dtype(df[col2]) and is_numeric_dtype(df[col1]):
                    sns.kdeplot(data=df, x=col1, hue=col2, fill=True, common_norm=False, ax=ax)
                else:
                    sns.kdeplot(data=df, x=col1, hue=col2, fill=True, common_norm=False, ax=ax)
            elif ptype == 'crosstab_heatmap':
                cross = pd.crosstab(df[col1], df[col2])
                sns.heatmap(cross, annot=True, fmt='d', cmap='Blues', ax=ax)
            elif ptype == 'cluster_map':
                plt.close(fig) # cluster map creates its own figure
                cross = pd.crosstab(df[col1], df[col2])
                cm = sns.clustermap(cross, annot=True, fmt='d', cmap='Blues', figsize=(8, 6))
                fig = cm.fig
            elif ptype == 'line':
                sns.lineplot(data=df, x=col1, y=col2, ax=ax)
        else: # Multiple columns
            if ptype == 'pairplot':
                plt.close(fig) # Close the default figure
                pp = sns.pairplot(df[valid_cols])
                fig = pp.fig
            elif ptype == 'correlation_heatmap':
                corr = df[valid_cols].select_dtypes(include='number').corr()
                sns.heatmap(corr, annot=True, cmap='coolwarm', ax=ax, fmt=".2f")
            else:
                raise ValueError("Invalid plot type for multiple columns.")
        
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


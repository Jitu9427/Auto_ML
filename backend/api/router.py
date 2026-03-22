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
            request.selected_metrics
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing training pipeline: {str(e)}")

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
                sns.histplot(data=df, x=col, kde=True, ax=ax)
            elif ptype == 'boxplot':
                sns.boxplot(data=df, y=col, ax=ax)
            elif ptype == 'countplot':
                sns.countplot(data=df, x=col, ax=ax)
                plt.xticks(rotation=45)
            elif ptype == 'pie':
                df[col].value_counts().plot.pie(autopct='%1.1f%%', ax=ax)
                ax.set_ylabel('')
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
        if ptype != 'pairplot':
            fig.tight_layout()
            
        # Convert figure to base64
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        return {"image_base64": img_base64}
    except Exception as e:
        plt.close(fig)
        raise HTTPException(status_code=500, detail=f"Failed to generate plot: {str(e)}")


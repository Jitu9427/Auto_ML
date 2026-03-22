from fastapi import APIRouter, File, UploadFile, HTTPException
import pandas as pd
import io
import uuid
from pydantic import BaseModel
from typing import List, Dict, Any
from ml.pipeline import train_and_evaluate, get_safe_estimators

router = APIRouter()

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str = ""
    task_type: str = "auto"
    model_name: str
    model_params: Dict[str, Any] = {}
    selected_metrics: List[str] = []

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
        
        # Provide basic summary of target columns (typically non-id columns)
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "columns": columns,
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


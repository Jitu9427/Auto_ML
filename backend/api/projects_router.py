from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


def serialize_project(project: models.Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "dataset_count": len(project.datasets),
        "run_count": len(project.runs),
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


@router.get("/")
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    projects = (
        db.query(models.Project)
        .filter(models.Project.user_id == current_user.id)
        .order_by(models.Project.created_at.desc())
        .all()
    )
    return {"projects": [serialize_project(p) for p in projects]}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = models.Project(
        user_id=current_user.id,
        name=data.name.strip(),
        description=(data.description or "").strip(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@router.get("/{project_id}")
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    datasets = [
        {
            "id": d.id,
            "dataset_id": d.dataset_id,
            "filename": d.filename,
            "num_rows": d.num_rows,
            "columns": d.columns,
            "column_types": d.column_types,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in project.datasets
    ]

    runs = [
        {
            "id": r.id,
            "dataset_id": r.dataset_id,
            "run_metadata": r.run_metadata,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in sorted(project.runs, key=lambda x: x.created_at, reverse=True)
    ]

    eda_history = [
        {
            "id": e.id,
            "dataset_id": e.dataset_id,
            "eda_metadata": e.eda_metadata,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in sorted(project.eda_history, key=lambda x: x.created_at, reverse=True)
    ]

    result = serialize_project(project)
    result["datasets"] = datasets
    result["runs"] = runs
    result["eda_history"] = eda_history
    return result


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    db.delete(project)
    db.commit()


@router.post("/{project_id}/runs")
def save_run(
    project_id: int,
    run_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    run = models.ProjectRun(
        project_id=project_id,
        dataset_id=run_data.get("dataset_id"),
        run_metadata=run_data,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"id": run.id, "created_at": run.created_at.isoformat()}

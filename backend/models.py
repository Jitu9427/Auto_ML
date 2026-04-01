from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="projects")
    datasets = relationship(
        "ProjectDataset", back_populates="project", cascade="all, delete-orphan"
    )
    runs = relationship(
        "ProjectRun", back_populates="project", cascade="all, delete-orphan"
    )
    eda_history = relationship(
        "ProjectEDA", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectDataset(Base):
    __tablename__ = "project_datasets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String(36), nullable=False)  # UUID used in-memory
    filename = Column(String(255), nullable=False)
    num_rows = Column(Integer, default=0)
    columns = Column(JSON, default=[])
    column_types = Column(JSON, default={})
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="datasets")


class ProjectRun(Base):
    __tablename__ = "project_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String(36), nullable=True)
    run_metadata = Column(JSON, default={})  # model, metrics, params, results
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="runs")


class ProjectEDA(Base):
    __tablename__ = "project_eda"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String(36), nullable=True)
    eda_metadata = Column(JSON, default={})  # type, columns, image_base64/sample
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="eda_history")

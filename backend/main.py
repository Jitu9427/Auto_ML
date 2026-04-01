from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from api.router import router
from api.auth_router import router as auth_router
from api.projects_router import router as projects_router

app = FastAPI(
    title="ML Automation Platform",
    description="Automated machine learning training platform API",
    version="2.0.0",
)

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def read_root():
    return {"status": "ok", "message": "ML Automation Platform API is running"}

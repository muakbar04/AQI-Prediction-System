import os
import sys
import subprocess
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

# Import application settings and routers
from app.core.config import settings
from app.routes import history, forecast, explain
from app.services.model_service import model_service

from app.core.database import engine, Base
from app.models import data_model 
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for the Pearls AQI Predictor",
    version="1.0.0"
)

# --- CORS Configuration ---
# This allows your React frontend (typically running on port 3000) 
# to make requests to this FastAPI backend (running on port 8000).
origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(explain.router, prefix="/api/explain", tags=["Explainability"])

@app.post("/api/reload-model", tags=["Actions"])
def reload_model_webhook(authorization: str = Header(None)):
    """
    Webhook triggered by GitHub Actions after a successful model training.
    """
    expected_secret = os.environ.get("WEBHOOK_SECRET", "super-secret-key-123")
    
    if authorization != f"Bearer {expected_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized webhook trigger")
    
    try:
        # Hot-swaps the model in memory!
        model_service.reload()
        version = model_service.meta.get("version", "unknown")
        return {"message": f"Successfully loaded model version {version} into memory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {str(e)}")

# --- Special Action Routes ---
@app.post("/api/refresh", tags=["Actions"])
def refresh_data():
    """
    Triggers the fetch_features.py script to pull the latest live data 
    from Open-Meteo and save it to the Supabase database.
    """
    try:
        # Resolve absolute path to the script to avoid working directory issues
        script_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../scripts/fetch_features.py")
        )
        
        # Use sys.executable to ensure we use the same Python environment/virtualenv
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        return {
            "message": "Data refreshed successfully.",
            "details": result.stdout.strip()
        }
    except subprocess.CalledProcessError as e:
        # This captures errors if the script crashes
        raise HTTPException(
            status_code=500, 
            detail=f"Script failed with error: {e.stderr.strip()}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger refresh: {str(e)}")

# --- Root Health Check ---
@app.get("/", tags=["Health"])
def read_root():
    return {"status": "ok", "project": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}
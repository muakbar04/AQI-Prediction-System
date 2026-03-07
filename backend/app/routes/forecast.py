from fastapi import APIRouter, HTTPException
from app.services import data_service, feature_service
from app.services.model_service import model_service

router = APIRouter()

@router.get("")
def get_forecast():
    """
    Generates a 72-hour AQI forecast using the XGBoost model.
    """
    try:
        # We fetch 48 hours to ensure we have enough buffer for rolling 
        # features (e.g., 12h trend, 6h std) before pulling the final 24h input window.
        df_raw = data_service.get_historical_data(limit=48)
        
        if df_raw.empty or len(df_raw) < 24:
            raise HTTPException(status_code=400, detail="Not enough historical data to generate forecast.")

        # Apply cyclical and rolling physics features
        df_features = feature_service.apply_physics_features(df_raw)
        
        # Generate the forecast sequence
        forecast_data = model_service.generate_forecast(df_features)
        
        return forecast_data
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate forecast: {str(e)}")
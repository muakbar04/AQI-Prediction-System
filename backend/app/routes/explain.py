from fastapi import APIRouter, HTTPException
from app.services import data_service, feature_service
from app.services.model_service import model_service

router = APIRouter()

@router.get("")
def get_explainability():
    """
    Calculates SHAP values for the immediate next hour prediction 
    to show feature importance in the UI.
    """
    try:
        # Fetch history with buffer for feature engineering
        df_raw = data_service.get_historical_data(limit=48)
        
        if df_raw.empty or len(df_raw) < 24:
            raise HTTPException(status_code=400, detail="Not enough historical data to generate explanations.")

        # Apply features
        df_features = feature_service.apply_physics_features(df_raw)
        
        # Calculate SHAP values
        shap_data = model_service.get_shap_explanations(df_features)
        
        return shap_data
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate explanations: {str(e)}")
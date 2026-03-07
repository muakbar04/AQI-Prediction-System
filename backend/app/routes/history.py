from fastapi import APIRouter, HTTPException
from app.services import data_service

router = APIRouter()

@router.get("")
def get_current_and_history():
    """
    Returns the latest metrics for the dashboard cards and 
    the last 7 days (168 hours) of historical data for the line chart.
    """
    try:
        current_metrics = data_service.get_current_metrics()
        
        # Fetch last 7 days of data
        df = data_service.get_historical_data(limit=168)
        
        if df.empty:
            return {"current": {}, "history": []}

        # Select and rename columns to match the React frontend expectations
        history_df = df[['timestamp', 'pm25', 'aqi_pm25']].copy()
        history_df = history_df.rename(columns={'aqi_pm25': 'aqi'})
        
        # Convert timestamps to ISO format strings for JSON serialization
        history_df['timestamp'] = history_df['timestamp'].astype(str)
        
        return {
            "current": current_metrics,
            "history": history_df.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history data: {str(e)}")
import pandas as pd
from sqlalchemy.orm import Session
from app.core.database import engine
from datetime import datetime

def get_historical_data(limit: int = 168) -> pd.DataFrame:
    """
    Fetches the historical data from the database strictly up to the CURRENT time.
    Returns a pandas DataFrame sorted chronologically.
    """
    # Get the current time as a string to safely cap the SQL query
    current_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Query only data where the timestamp is less than or equal to right now
    query = f"""
        SELECT * FROM aqi_features 
        WHERE timestamp <= '{current_time_str}'
        ORDER BY timestamp DESC 
        LIMIT {limit}
    """
    
    try:
        df = pd.read_sql(query, con=engine)
        if not df.empty:
            # Ensure timestamp is a datetime object and sort chronologically for the ML model
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp').reset_index(drop=True)
        return df
    except Exception as e:
        print(f"Database query error: {e}")
        return pd.DataFrame()

def get_current_metrics() -> dict:
    """
    Fetches the single most recent row (up to the current time) for the dashboard's current metrics.
    """
    current_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    query = f"""
        SELECT * FROM aqi_features 
        WHERE timestamp <= '{current_time_str}'
        ORDER BY timestamp DESC 
        LIMIT 2
    """
    
    try:
        df = pd.read_sql(query, con=engine)
        if df.empty:
            return {}
            
        latest = df.iloc[0]
        # Calculate diff if we have at least 2 rows
        pm25_diff = latest['pm25'] - df.iloc[1]['pm25'] if len(df) > 1 else 0.0
        
        return {
            "timestamp": latest['timestamp'].isoformat(),
            "pm25": float(latest['pm25']),
            "pm25_diff": float(pm25_diff),
            "aqi": float(latest['aqi_pm25']),
            "temp": float(latest['temp']),
            "wind": float(latest['wind_speed'])
        }
    except Exception as e:
        print(f"Database query error: {e}")
        return {}
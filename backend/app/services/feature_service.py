import numpy as np
import pandas as pd

def apply_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies cyclical time features and dynamics to the raw dataframe.
    Requires a chronological dataframe with at least 12 rows to calculate trends safely.
    """
    if df.empty:
        return df

    df = df.copy()
    
    # Cyclical Time Features
    if 'hour' in df.columns:
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
    if 'month' in df.columns:
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        
    # Dynamics (Standard Deviation and Trend)
    if 'pm25' in df.columns:
        df['pm25_6h_std'] = df['pm25'].rolling(window=6).std().fillna(0)
        df['pm25_trend_12h'] = (df['pm25'] - df['pm25'].shift(12)).fillna(0)
    
    # Drop rows with NaNs introduced by rolling/shifting if strict strictness is required,
    # or handle them gracefully so we don't lose the most recent timestamps.
    df = df.bfill().reset_index(drop=True)
    
    return df
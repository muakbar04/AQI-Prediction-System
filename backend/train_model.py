import os
import json
import joblib
import requests
import boto3
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.multioutput import MultiOutputRegressor 
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler

# --- Configuration & Env Vars ---
DB_URL = os.environ.get("DATABASE_URL")
R2_BUCKET = os.environ.get("R2_BUCKET_NAME")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_PREFIX = os.environ.get("R2_MODEL_DIR_PREFIX", "model/")

# Where the API lives (e.g., your Render URL)
API_URL = os.environ.get("VITE_API_URL", "http://localhost:8000")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")

def fetch_data_from_db():
    print("Fetching training data from Supabase...")
    engine = create_engine(DB_URL)
    query = "SELECT * FROM aqi_features ORDER BY timestamp ASC"
    df = pd.read_sql(query, con=engine)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def add_physics_features(df):
    df = df.copy()
    if 'hour' in df:
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
    if 'month' in df:
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    if 'pm25' in df:
        df['pm25_6h_std'] = df['pm25'].rolling(window=6).std().fillna(0)
        df['pm25_trend_12h'] = (df['pm25'] - df['pm25'].shift(12)).fillna(0)
    return df.dropna().reset_index(drop=True)

def create_sequences(df, input_width=24, label_width=72, target_col='aqi_pm25'):
    base_features = ['temp','humidity','wind_speed','pm25','pm10','no2','o3',
                     'weekday','pm25_change','aqi_change_rate',
                     'pm25_3h_mean','pm25_24h_mean',
                     'hour_sin', 'hour_cos', 'month_sin', 'month_cos',
                     'pm25_6h_std', 'pm25_trend_12h']
    
    feature_cols = [c for c in base_features if c in df.columns]
    X, y = [], []
    
    for i in range(len(df) - input_width - label_width):
        window = df.iloc[i : i+input_width][feature_cols].values
        X.append(window.flatten())
        target = df.iloc[i+input_width : i+input_width+label_width][target_col].values
        y.append(target)
        
    return np.array(X), np.array(y), feature_cols

def manage_r2_artifacts(xgb, scaler, metrics, feature_cols, input_width, horizon):
    print("\nConnecting to Cloudflare R2...")
    s3 = boto3.client("s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name="auto"
    )

    # 1. Fetch current metadata to get the current version
    current_version = 0
    old_model_file = None
    old_scaler_file = None
    
    try:
        response = s3.get_object(Bucket=R2_BUCKET, Key=f"{R2_PREFIX}model_meta.json")
        old_meta = json.loads(response['Body'].read().decode('utf-8'))
        current_version = old_meta.get("version", 0)
        old_model_file = old_meta.get("model_file")
        old_scaler_file = old_meta.get("scaler_file")
    except s3.exceptions.NoSuchKey:
        print("No existing metadata found. Starting at version 1.")

    new_version = current_version + 1
    new_model_name = f"best_model_v{new_version}.pkl"
    new_scaler_name = f"scaler_v{new_version}.pkl"

    # 2. Save locally first
    os.makedirs("./tmp_models", exist_ok=True)
    joblib.dump(xgb, f"./tmp_models/{new_model_name}")
    joblib.dump(scaler, f"./tmp_models/{new_scaler_name}")
    
    new_meta = {
        "version": new_version,
        "model_file": new_model_name,
        "scaler_file": new_scaler_name,
        "metrics": metrics,
        "feature_cols": feature_cols,
        "input_width": input_width,
        "horizon": horizon,
        "last_trained": str(pd.Timestamp.now())
    }
    with open("./tmp_models/model_meta.json", "w") as f:
        json.dump(new_meta, f, indent=2)

    # 3. Upload new artifacts to R2
    print(f"Uploading version {new_version} to R2...")
    s3.upload_file(f"./tmp_models/{new_model_name}", R2_BUCKET, f"{R2_PREFIX}{new_model_name}")
    s3.upload_file(f"./tmp_models/{new_scaler_name}", R2_BUCKET, f"{R2_PREFIX}{new_scaler_name}")
    s3.upload_file("./tmp_models/model_meta.json", R2_BUCKET, f"{R2_PREFIX}model_meta.json")

    # 4. Cleanup old artifacts from R2
    if old_model_file and old_scaler_file:
        print(f"Deleting old version ({old_model_file}) from R2...")
        s3.delete_object(Bucket=R2_BUCKET, Key=f"{R2_PREFIX}{old_model_file}")
        s3.delete_object(Bucket=R2_BUCKET, Key=f"{R2_PREFIX}{old_scaler_file}")

    print("✅ R2 Artifact rotation complete.")

def trigger_backend_reload():
    print(f"\nNotifying API at {API_URL} to reload model...")
    try:
        response = requests.post(
            f"{API_URL}/api/reload-model",
            headers={"Authorization": f"Bearer {WEBHOOK_SECRET}"}
        )
        response.raise_for_status()
        print("✅ Backend successfully reloaded the new model into memory!")
    except Exception as e:
        print(f"❌ Failed to notify backend: {e}")

def main():
    if not DB_URL:
        print("❌ DATABASE_URL missing. Aborting training.")
        return

    df = fetch_data_from_db()
    df = add_physics_features(df)
    
    input_width = 24
    horizon = 72
    X, y, feature_cols = create_sequences(df, input_width, horizon)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
    
    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    print("\nTraining MultiOutput XGBoost...")
    xgb_base = XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.05, n_jobs=-1, random_state=42)
    xgb = MultiOutputRegressor(xgb_base)
    xgb.fit(X_train_s, y_train)
    
    y_pred = xgb.predict(X_test_s)
    metrics = {
        "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
        "mae": float(mean_absolute_error(y_test, y_pred))
    }
    print(f"Validation RMSE: {metrics['rmse']:.2f}")

    manage_r2_artifacts(xgb, scaler, metrics, feature_cols, input_width, horizon)
    trigger_backend_reload()

if __name__ == "__main__":
    main()
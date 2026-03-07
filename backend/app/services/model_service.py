import os
import json
import joblib
import numpy as np
import pandas as pd
import shap
import boto3
from datetime import timedelta
from app.core.config import settings

# Resolve absolute path to backend/app/models
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../models"))

# Crucial: Ensure the local directory exists so boto3 has a place to save the downloaded files
os.makedirs(MODEL_DIR, exist_ok=True)

class ModelService:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.meta = {}
        
        # 1. Fetch from cloud first
        self._download_from_r2()
        # 2. Load into memory
        self._load_artifacts()

    def _download_from_r2(self):
        """Downloads metadata first, then grabs the correct versioned artifacts."""
        print("Initiating connection to Cloudflare R2...")
        try:
            s3_client = boto3.client("s3",
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )
            
            # 1. Always download the metadata first
            meta_key = f"{settings.R2_MODEL_DIR_PREFIX}model_meta.json"
            meta_path = os.path.join(MODEL_DIR, "model_meta.json")
            s3_client.download_file(settings.R2_BUCKET_NAME, meta_key, meta_path)
            
            with open(meta_path, "r") as f:
                temp_meta = json.load(f)
            
            # 2. Get the dynamic filenames
            model_file = temp_meta.get("model_file", "best_model.pkl")
            scaler_file = temp_meta.get("scaler_file", "scaler.pkl")
            
            # 3. Download the specific versions
            for file_name in [model_file, scaler_file]:
                s3_key = f"{settings.R2_MODEL_DIR_PREFIX}{file_name}"
                # Save them locally with the static names so the rest of the code works
                local_static_name = "best_model.pkl" if "model" in file_name else "scaler.pkl"
                local_path = os.path.join(MODEL_DIR, local_static_name)
                
                s3_client.download_file(settings.R2_BUCKET_NAME, s3_key, local_path)
                
            print(f"✅ Downloaded version {temp_meta.get('version', 'unknown')} from R2.")
            
        except Exception as e:
            print(f"❌ Failed to fetch from R2: {e}")

    def reload(self):
        """Public method to trigger a fresh download and memory swap."""
        self._download_from_r2()
        self._load_artifacts()

    def _load_artifacts(self):
        """Loads the serialized model, scaler, and metadata into memory."""
        try:
            self.model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))
            self.scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
            with open(os.path.join(MODEL_DIR, "model_meta.json"), "r") as f:
                self.meta = json.load(f)
            print("✅ Model artifacts loaded into memory successfully.")
        except Exception as e:
            print(f"⚠️ Failed to load model artifacts: {e}")

    def generate_forecast(self, df: pd.DataFrame) -> list:
        """
        Takes preprocessed historical data, formats it for the model, 
        and returns a 72-hour forecasted trajectory.
        """
        if self.model is None or df.empty:
            return []

        input_width = self.meta.get('input_width', 24)
        feature_cols = self.meta.get('feature_cols', [])

        if len(df) < input_width:
            raise ValueError(f"Insufficient data: Need at least {input_width} rows.")

        input_df = df.iloc[-input_width:]
        X_input = input_df[feature_cols].values.flatten().reshape(1, -1)
        X_scaled = self.scaler.transform(X_input)
        
        pred_vector = self.model.predict(X_scaled)
        if pred_vector.ndim > 1:
            pred_vector = pred_vector[0]

        latest_time = pd.to_datetime(input_df.iloc[-1]['timestamp'])
        forecast_data = []
        
        for i, aqi_val in enumerate(pred_vector):
            future_time = latest_time + timedelta(hours=i+1)
            forecast_data.append({
                "timestamp": future_time.isoformat(),
                "forecastAqi": max(0, float(aqi_val)) 
            })

        return forecast_data

    def get_shap_explanations(self, df: pd.DataFrame) -> list:
        """
        Calculates SHAP values for the next immediate hour prediction to explain 
        which features are driving the forecast.
        """
        if self.model is None or df.empty:
            return []

        input_width = self.meta.get('input_width', 24)
        feature_cols = self.meta.get('feature_cols', [])
        
        if len(df) < input_width:
             return []

        input_df = df.iloc[-input_width:]
        X_input = input_df[feature_cols].values.flatten().reshape(1, -1)
        X_scaled = self.scaler.transform(X_input)

        try:
            flat_feature_names = [f"{col} (t-{input_width-i}h)" 
                                  for i in range(input_width) for col in feature_cols]

            xgb_estimator = self.model.estimators_[0]
            
            background_baseline = np.zeros((1, X_scaled.shape[1]))
            explainer = shap.Explainer(xgb_estimator.predict, background_baseline)
            
            shap_explanation = explainer(X_scaled, max_evals=(X_scaled.shape[1] * 2) + 10)
            shap_vals = shap_explanation.values[0]

            importance_df = pd.DataFrame({
                'feature': flat_feature_names,
                'impact': shap_vals,
                'abs_impact': np.abs(shap_vals)
            })
            
            top_features = importance_df.sort_values(by='abs_impact', ascending=True).tail(15)
            
            return top_features[['feature', 'impact']].to_dict(orient='records')
            
        except Exception as e:
            print(f"SHAP explanation failed: {e}")
            return []

# Instantiate the service so it can be imported and reused across routes
model_service = ModelService()
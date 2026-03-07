import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pearls AQI Predictor API"
    ENVIRONMENT: str = "development"
    
    # Database settings
    DATABASE_URL: str

    # Cloudflare R2 Settings
    R2_BUCKET_NAME: str
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_MODEL_DIR_PREFIX: str = "models/"
    
    model_config = SettingsConfigDict(
        env_file=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
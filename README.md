# 🌍 Pearls AQI Predictor

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![XGBoost](https://img.shields.io/badge/Machine_Learning-XGBoost-F37626)
![Deployment](https://img.shields.io/badge/Hosted_on-Vercel_%7C_Hugging_Face-black)

An AI-powered Air Quality Index (AQI) forecasting system specifically designed for Karachi, Pakistan. It fetches real-time meteorological and pollution data, utilizes an XGBoost machine learning model to generate a 72-hour predictive forecast, and provides feature explainability using SHAP values.

**Live Dashboard:** [https://aqi-prediction-system-two.vercel.app/](https://aqi-prediction-system-two.vercel.app/)  
**Live API Docs (Swagger UI):** [https://muakbar9211-karachi-aqi-api.hf.space/docs](https://muakbar9211-karachi-aqi-api.hf.space/docs)

---

## ✨ Key Features
* **Real-Time Data Ingestion:** Automated data pipelines fetching live weather and PM2.5 data from Open-Meteo.
* **72-Hour AI Forecast:** Time-series prediction powered by an XGBoost regressor, auto-updated with fresh data.
* **SHAP Explainability:** Transparent AI that explains *why* the AQI is predicted to change (e.g., wind speed, temperature, PM10 levels).
* **Self-Healing Data Sync:** Timezone-aware (PKT) backfilling algorithms ensure zero missing data gaps in the database even during server downtimes.
* **Hot-Swappable ML Models:** Model artifacts are hosted on Cloudflare R2, allowing the backend to load newly trained models seamlessly without API downtime.



---

## 🏗️ System Architecture & Tech Stack

### Frontend (User Interface)
* **Framework:** React + Vite
* **Hosting:** Vercel
* **Features:** Responsive dashboard, interactive time-series charts, current metrics display.

### Backend (API & Data Processing)
* **Framework:** FastAPI (Python)
* **Hosting:** Hugging Face Spaces (Dockerized)
* **Data Processing:** Pandas, NumPy
* **ORM:** SQLAlchemy

### Machine Learning & Storage
* **Model:** XGBoost Regressor
* **Explainability:** SHAP (SHapley Additive exPlanations)
* **Database:** Supabase (PostgreSQL)
* **Artifact Storage:** Cloudflare R2 (S3-compatible bucket for `.pkl` models and metadata)

### DevOps & Automation
* **CI/CD:** GitHub Actions
* **Data Pipelines:** Automated hourly cron jobs to fetch, transform, and UPSERT data into Supabase.

---

## 🚀 API Endpoints

The backend exposes a RESTful API. Below are the primary public routes:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Health check and environment status. |
| `GET`  | `/api/history` | Returns the current metrics and last 7 days of hourly AQI data. |
| `POST` | `/api/forecast` | Accepts current sequential data and returns the 72-hour AQI forecast. |
| `POST` | `/api/explain` | Generates SHAP values highlighting the impact of features on the prediction. |
| `POST` | `/api/refresh` | Triggers the backend to fetch recent Open-Meteo data and backfill the database. |
| `POST` | `/api/reload-model` | Secure webhook to trigger a hot-swap of the ML model from Cloudflare R2. |

---

## 💻 Local Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js & npm
* A Supabase PostgreSQL database
* A Cloudflare R2 bucket

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name

```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt

```

Create a `.env` file in the `backend/` directory:

```env
ENVIRONMENT=development
PROJECT_NAME="Pearls AQI Predictor API"

# Database (Use Port 5432 for direct connection)
DATABASE_URL=postgresql://user:password@aws-0-region.pooler.supabase.com:5432/postgres

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_MODEL_DIR_PREFIX=model/

# Security
WEBHOOK_SECRET=your_super_secret_key
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

```

Run the FastAPI server locally:

```bash
uvicorn app.main:app --reload --port 8000

```

### 3. Frontend Setup

```bash
cd frontend
npm install

```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000

```

Run the React development server:

```bash
npm run dev

```

---

## 🤖 Automated Workflows (GitHub Actions)

This repository includes two automated GitHub Action workflows located in `.github/workflows/`:

1. **Hourly AQI Data Sync:** Runs automatically to ping the `/api/refresh` endpoint and keep the Supabase database perfectly synced with Open-Meteo.
2. **Model Training Pipeline:** Extracts historical data, retrains the XGBoost model, uploads the new version to Cloudflare R2, and pings the `/api/reload-model` webhook for instant deployment.

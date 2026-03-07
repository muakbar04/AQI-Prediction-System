import axios from 'axios';

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  // Matches backend/app/routes/history.py
  getCurrentAndHistory: async () => {
    const response = await axios.get(`${API_BASE}/api/history`);
    return response.data;
  },
  
  // Matches backend/app/routes/forecast.py
  getForecast: async () => {
    const response = await axios.get(`${API_BASE}/api/forecast`);
    return response.data;
  },

  // Matches backend/app/routes/explain.py
  getExplainability: async () => {
    const response = await axios.get(`${API_BASE}/api/explain`);
    return response.data;
  },

  // Triggers scripts/fetch_features.py via backend
  refreshData: async () => {
    const response = await axios.post(`${API_BASE}/api/refresh`);
    return response.data;
  }
};
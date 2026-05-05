import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3005/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zamtel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('zamtel_token');
      localStorage.removeItem('zamtel_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;

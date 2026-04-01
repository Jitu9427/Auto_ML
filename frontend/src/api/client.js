import axios from 'axios';

// In Docker: VITE_API_URL is empty → use same origin (Nginx proxies /api)
// In local dev: defaults to localhost:8000
const BASE_URL = import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Bearer token automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('ml_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ml_token');
      localStorage.removeItem('ml_user');
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default client;

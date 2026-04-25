import axios from 'axios';

// In Vite dev, default to same-origin `/api` so requests are proxied to the
// backend (see vite.config.ts). Without this, the browser calls localhost:3000
// directly and hits CORS / wrong host when only `npm run dev` is used on :5173.
// Set VITE_API_URL at build time for production or a custom backend URL.
const resolvedBase =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:3000/api');

const api = axios.create({
  baseURL: resolvedBase,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Login POST also returns 403 + ACCOUNT_BLOCKED with a message that includes the block reason.
    // Do not hard-redirect here: that reloads the page and the login form never shows the error.
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_BLOCKED') {
      const isLoginAttempt = error.config?.url?.includes('/auth/login');
      if (!isLoginAttempt) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;


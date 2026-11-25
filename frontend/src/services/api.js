import axios from 'axios';

// Keep localhost and 127.0.0.1 aligned so SameSite cookies work in development.
const baseURL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

// Centralized Axios instance
const api = axios.create({
  baseURL,
  withCredentials: true, // Required for HttpOnly session cookie authentication
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Response interceptor for centralized error extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'A network or server error occurred.';

    if (error.response) {
      const data = error.response.data;
      if (data && data.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          // Pydantic validation error list
          message = data.detail.map((err) => `${err.loc?.slice(-1)[0] || 'field'}: ${err.msg}`).join(', ');
        }
      } else if (data && data.message) {
        message = data.message;
      } else if (error.response.status === 401) {
        message = 'Session expired or authentication required. Please log in.';
      } else if (error.response.status === 403) {
        message = 'Access forbidden: Initial password change required.';
      } else if (error.response.status === 404) {
        message = 'Requested resource not found.';
      } else if (error.response.status === 409) {
        message = 'Record already exists or conflicting reference.';
      }
    } else if (error.request) {
      message = 'Cannot connect to backend server. Please verify FastAPI is running.';
    }

    return Promise.reject({
      status: error.response?.status,
      message,
      originalError: error,
    });
  }
);

export default api;

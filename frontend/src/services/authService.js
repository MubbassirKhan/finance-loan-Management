import api from './api';

export const authService = {
  // POST /api/v1/auth/login
  login: async (username, password) => {
    const response = await api.post('/api/v1/auth/login', { username, password });
    return response.data;
  },

  // POST /api/v1/auth/logout
  logout: async () => {
    const response = await api.post('/api/v1/auth/logout');
    return response.data;
  },

  // GET /api/v1/auth/me
  getCurrentAdmin: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },

  // POST /api/v1/auth/change-password
  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    const response = await api.post('/api/v1/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },
};

export default authService;

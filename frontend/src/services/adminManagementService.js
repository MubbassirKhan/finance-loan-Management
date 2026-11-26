import api from './api.js'

const adminManagementService = {
  getAdmins: async () => {
    const response = await api.get('/api/v1/admin-management/admins')
    return response.data
  },

  createAdmin: async (account) => {
    const response = await api.post('/api/v1/admin-management/admins', account)
    return response.data
  },

  getSessionLogs: async (limit = 200) => {
    const response = await api.get('/api/v1/admin-management/sessions', { params: { limit } })
    return response.data
  },

  clearApplicationData: async (payload) => {
    const response = await api.post('/api/v1/admin-management/clear-database', payload)
    return response.data
  },
}

export default adminManagementService
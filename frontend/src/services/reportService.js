import api from './api'

const reportService = {
  getAnalytics: async ({ year, month = null }) => {
    const params = { year }
    if (month) params.month = month
    const response = await api.get('/api/v1/reports/analytics', { params })
    return response.data
  },
}

export default reportService
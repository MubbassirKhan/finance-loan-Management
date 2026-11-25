import api from './api';

export const policeStationService = {
  // GET /api/v1/police-stations
  getStations: async ({ page = 1, size = 100, search = '', active_only = false } = {}) => {
    const params = { page, size, active_only };
    if (search && search.trim()) params.search = search.trim();

    const response = await api.get('/api/v1/police-stations', { params });
    return response.data;
  },

  // GET /api/v1/police-stations/{ps_id}
  getStationById: async (psId) => {
    const response = await api.get(`/api/v1/police-stations/${psId}`);
    return response.data;
  },

  // POST /api/v1/police-stations
  createStation: async (stationData) => {
    const response = await api.post('/api/v1/police-stations', stationData);
    return response.data;
  },

  // PUT /api/v1/police-stations/{ps_id}
  updateStation: async (psId, stationData) => {
    const response = await api.put(`/api/v1/police-stations/${psId}`, stationData);
    return response.data;
  },

  // PATCH /api/v1/police-stations/{ps_id}/deactivate
  toggleStationStatus: async (psId) => {
    const response = await api.patch(`/api/v1/police-stations/${psId}/deactivate`);
    return response.data;
  },
};

export default policeStationService;

import api from './api';

export const memberService = {
  // GET /api/v1/users
  getMembers: async ({ page = 1, size = 20, search = '', ps_id = '', status = '' } = {}) => {
    const params = { page, size };
    if (search && search.trim()) params.search = search.trim();
    if (ps_id) params.ps_id = ps_id;
    if (status) params.status = status;

    const response = await api.get('/api/v1/users', { params });
    return response.data;
  },

  getAllMembers: async ({ search = '', ps_id = '', status = '' } = {}) => {
    const size = 100;
    const firstPage = await memberService.getMembers({ page: 1, size, search, ps_id, status });
    const items = firstPage.items ?? firstPage.data ?? [];
    const pageCount = Math.ceil((firstPage.total ?? items.length) / size);
    if (pageCount <= 1) return items;

    const remainingPages = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        memberService.getMembers({ page: index + 2, size, search, ps_id, status }),
      ),
    );
    return items.concat(...remainingPages.map((result) => result.items ?? result.data ?? []));
  },

  // GET /api/v1/users/{kgid}
  getMemberByKgid: async (kgid) => {
    const response = await api.get(`/api/v1/users/${encodeURIComponent(kgid)}`);
    return response.data;
  },

  checkKgidAvailability: async (kgid) => {
    const response = await api.get('/api/v1/users/kgid-availability', { params: { kgid } });
    return response.data;
  },

  checkMemberFieldAvailability: async (field, value, excludeKgid = '') => {
    const response = await api.get('/api/v1/users/field-availability', {
      params: { field, value, exclude_kgid: excludeKgid || undefined },
    });
    return response.data;
  },

  // GET /api/v1/users/{kgid}/membership-records
  getMembershipRecords: async (kgid) => {
    const response = await api.get(`/api/v1/users/${encodeURIComponent(kgid)}/membership-records`);
    return response.data;
  },

  // POST /api/v1/users
  createMember: async (memberData) => {
    const response = await api.post('/api/v1/users', memberData);
    return response.data;
  },

  // PUT /api/v1/users/{kgid}
  updateMember: async (kgid, memberData) => {
    const response = await api.put(`/api/v1/users/${encodeURIComponent(kgid)}`, memberData);
    return response.data;
  },

  // PATCH /api/v1/users/{kgid}/status
  updateMemberStatus: async (kgid, status) => {
    const response = await api.patch(`/api/v1/users/${encodeURIComponent(kgid)}/status`, { status });
    return response.data;
  },

  // POST /api/v1/users/{kgid}/documents
  uploadMemberDocuments: async (kgid, files, docType = 'Membership') => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('doc_type', docType);
    const response = await api.post(
      `/api/v1/users/${encodeURIComponent(kgid)}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  // GET /api/v1/users/{kgid}/documents
  getMemberDocuments: async (kgid) => {
    const response = await api.get(`/api/v1/users/${encodeURIComponent(kgid)}/documents`);
    return response.data;
  },

  // GET /api/v1/users/{kgid}/documents/{doc_id}/download
  downloadMemberDocument: async (kgid, docId) => {
    const response = await api.get(
      `/api/v1/users/${encodeURIComponent(kgid)}/documents/${docId}/download`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  // GET /api/v1/users/membership-fees
  getFeeTiers: async () => {
    const response = await api.get('/api/v1/users/membership-fees');
    return response.data;
  },

  // POST /api/v1/users/membership-fees
  createFeeTier: async (feeData) => {
    const response = await api.post('/api/v1/users/membership-fees', feeData);
    return response.data;
  },

  // PUT /api/v1/users/membership-fees/{mf_id}
  updateFeeTier: async (mfId, feeData) => {
    const response = await api.put(`/api/v1/users/membership-fees/${mfId}`, feeData);
    return response.data;
  },

  // PATCH /api/v1/users/membership-fees/{mf_id}/status
  updateFeeTierStatus: async (mfId, isActive) => {
    const response = await api.patch(`/api/v1/users/membership-fees/${mfId}/status`, { is_active: isActive });
    return response.data;
  },
};

export default memberService;

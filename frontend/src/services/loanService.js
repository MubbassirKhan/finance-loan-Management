import api from './api';

export const loanService = {
  // GET /api/v1/loans
  getLoans: async ({ page = 1, size = 20, search = '', ps_id = '', loan_type = '', status = '', kgid = '' } = {}) => {
    const params = { page, size };
    if (search && search.trim()) params.search = search.trim();
    if (ps_id) params.ps_id = ps_id;
    if (loan_type) params.loan_type = loan_type;
    if (status) params.status = status;
    if (kgid) params.kgid = kgid;

    const response = await api.get('/api/v1/loans', { params });
    return response.data;
  },

  // GET /api/v1/loans/{loan_id}
  getLoanById: async (loanId) => {
    const response = await api.get(`/api/v1/loans/${loanId}`);
    return response.data;
  },

  // POST /api/v1/loans
  createLoan: async (loanData) => {
    const response = await api.post('/api/v1/loans', loanData);
    return response.data;
  },

  // PUT /api/v1/loans/{loan_id}
  updateLoan: async (loanId, loanData) => {
    const response = await api.put(`/api/v1/loans/${loanId}`, loanData);
    return response.data;
  },

  // POST /api/v1/loans/{loan_id}/payments
  recordPayment: async (loanId, paymentData) => {
    const response = await api.post(`/api/v1/loans/${loanId}/payments`, paymentData);
    return response.data;
  },

  // GET /api/v1/loans/{loan_id}/payments
  getLoanPayments: async (loanId) => {
    const response = await api.get(`/api/v1/loans/${loanId}/payments`);
    return response.data;
  },

  // GET /api/v1/loans/user/{kgid}/history
  getUserHistory: async (kgid) => {
    const response = await api.get(`/api/v1/loans/user/${encodeURIComponent(kgid)}/history`);
    return response.data;
  },

  // POST /api/v1/loans/{loan_id}/attachment
  uploadAttachment: async (loanId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/v1/loans/${loanId}/attachment`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // GET /api/v1/loans/{loan_id}/attachment/download
  getAttachmentDownloadUrl: (loanId) => {
    const base = api.defaults.baseURL || 'http://127.0.0.1:8000';
    return `${base}/api/v1/loans/${loanId}/attachment/download`;
  },

  // GET /api/v1/loans/{loan_id}/attachment/view
  getAttachmentViewUrl: (loanId) => {
    const base = api.defaults.baseURL || 'http://127.0.0.1:8000';
    return `${base}/api/v1/loans/${loanId}/attachment/view`;
  },
};

export default loanService;

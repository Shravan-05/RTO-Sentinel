import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach mock/real auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rto_token') || 'demo_token';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const dashboardApi = {
  getOverview: () => api.get('/analytics/overview').then(res => res.data.data),
  getYesterday: () => api.get('/analytics/yesterday').then(res => res.data),
  getGeographic: () => api.get('/analytics/geographic').then(res => res.data.data),
  getBacktest: () => api.get('/analytics/backtest').then(res => res.data.data)
};

export const ordersApi = {
  getOrders: (params) => api.get('/orders', { params }).then(res => res.data.data),
  getOrderById: (id) => api.get(`/orders/${id}`).then(res => res.data.data),
  overrideDecision: (id, payload) => api.post(`/orders/${id}/override`, payload).then(res => res.data),
  createTestOrder: (order) => api.post('/orders', order).then(res => res.data)
};

export const whatsappApi = {
  getConversation: (orderId) => api.get(`/whatsapp/${orderId}`).then(res => res.data.data),
  sendMessage: (orderId, workflowType) => api.post(`/whatsapp/${orderId}/send`, { workflowType }).then(res => res.data.data),
  reply: (orderId, reply) => api.post(`/whatsapp/${orderId}/reply`, { reply }).then(res => res.data.data),
  fastForward: (orderId, hours = 24) => api.post(`/whatsapp/${orderId}/fast-forward`, { hours }).then(res => res.data.data),
  resetClock: () => api.post('/whatsapp/clock/reset').then(res => res.data)
};

export const settingsApi = {
  getSettings: () => api.get('/settings').then(res => res.data.data),
  updateSettings: (settings) => api.put('/settings', settings).then(res => res.data)
};

export default api;


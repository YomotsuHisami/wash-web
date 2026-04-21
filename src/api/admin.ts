import { apiRequest } from './client';

export function fetchAdminStatus() {
  return apiRequest<{ isSetup: boolean }>('/api/admin/status');
}

export function verifyAdminToken(token: string) {
  return apiRequest<{ success: boolean }>('/api/admin/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setupAdminPassword(password: string) {
  return apiRequest<{ success: boolean }>('/api/admin/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function loginAdmin(password: string) {
  return apiRequest<{ success: boolean; token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

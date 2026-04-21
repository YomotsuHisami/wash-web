import { apiRequest } from './client';
import { CustomerInfo, UserProfile } from '../models/domain';

export function registerUser(username: string, password: string) {
  return apiRequest<UserProfile>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function loginUser(username: string, password: string) {
  return apiRequest<UserProfile>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchUserProfile(id: string) {
  return apiRequest<UserProfile>(`/api/users/${id}`);
}

export function updateDefaultInfo(id: string, payload: Partial<CustomerInfo>) {
  return apiRequest<UserProfile>(`/api/users/${id}/defaultInfo`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updatePassword(
  id: string,
  oldPassword: string,
  newPassword: string
) {
  return apiRequest<{ success: boolean }>(`/api/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function upgradeMembership(id: string) {
  return apiRequest<UserProfile>(`/api/users/${id}/upgrade`, {
    method: 'POST',
  });
}

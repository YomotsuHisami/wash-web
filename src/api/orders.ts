import { apiRequest } from './client';
import {
  OrderStatus,
  ServerOrder,
  normalizeOrderStatus,
} from '../models/domain';

export function fetchOrderById(orderId: string) {
  return apiRequest<ServerOrder>(`/api/orders/${orderId}`).then(normalizeServerOrder);
}

export function fetchAdminOrders(token: string) {
  return apiRequest<ServerOrder[]>('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((orders) => orders.map(normalizeServerOrder));
}

export function createServerOrder(payload: ServerOrder) {
  return apiRequest<{ success: boolean; order: ServerOrder }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function markOrderPaid(orderId: string) {
  return apiRequest<{ success: boolean; order: ServerOrder }>(`/api/orders/${orderId}/pay`, {
    method: 'POST',
  });
}

export function deleteServerOrder(orderId: string, token?: string) {
  return apiRequest<{ success: boolean }>(`/api/orders/${orderId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function updateServerOrderStatus(
  orderId: string,
  status: OrderStatus,
  token: string
) {
  return apiRequest<{ success: boolean; order: ServerOrder }>(
    `/api/orders/${orderId}/status`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    }
  );
}

function normalizeServerOrder(order: ServerOrder): ServerOrder {
  return {
    ...order,
    imageUrl: normalizeOrderImagePath(order.imageUrl),
    imageUrls: (order.imageUrls || []).map(normalizeOrderImagePath).filter(Boolean) as string[],
    status: normalizeOrderStatus(order.status),
  };
}

function normalizeOrderImagePath(imageUrl?: string) {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
    return imageUrl;
  }
  return `/${imageUrl.replace(/^\/+/, '')}`;
}

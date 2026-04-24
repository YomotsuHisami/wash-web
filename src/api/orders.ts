import { apiRequest } from './client';
import {
  OrderProgressUpdate,
  OrderStatus,
  ORDER_STATUS_FLOW,
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

export function appendServerOrderProgress(
  orderId: string,
  payload: {
    status: OrderStatus;
    note?: string;
    imageUrls?: string[];
  },
  token: string
) {
  return apiRequest<{ success: boolean; order: ServerOrder }>(
    `/api/orders/${orderId}/progress`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }
  );
}

function normalizeServerOrder(order: ServerOrder): ServerOrder {
  return {
    ...order,
    imageUrl: normalizeOrderImagePath(order.imageUrl),
    imageUrls: (order.imageUrls || []).map(normalizeOrderImagePath).filter(Boolean) as string[],
    progressUpdates: normalizeProgressUpdates(order.progressUpdates),
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

function normalizeProgressUpdates(progressUpdates?: OrderProgressUpdate[]) {
  if (!Array.isArray(progressUpdates)) return [];

  return progressUpdates
    .map((update) => ({
      ...update,
      status: normalizeOrderStatus(update.status),
      imageUrls: (update.imageUrls || [])
        .map(normalizeOrderImagePath)
        .filter(Boolean) as string[],
    }))
    .filter((update) => ORDER_STATUS_FLOW.includes(update.status) || update.status === 'cancelled');
}

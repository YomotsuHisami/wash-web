import { apiRequest } from './client';
import { Discount, Shop } from '../models/domain';

export function fetchShops() {
  return apiRequest<Shop[]>('/api/shops');
}

export function fetchDiscounts() {
  return apiRequest<Discount[]>('/api/discounts');
}

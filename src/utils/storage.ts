import { Order, OrderStatus, UserProfile } from '../models/domain';

const STORAGE_KEYS = {
  intro: 'h5app_has_seen_intro',
  currentUser: 'h5app_current_user',
  adminToken: 'h5app_admin_token',
  localOrders: 'kicks_valuer_orders',
} as const;

export function hasSeenIntro() {
  return localStorage.getItem(STORAGE_KEYS.intro) === 'true';
}

export function setIntroSeen() {
  localStorage.setItem(STORAGE_KEYS.intro, 'true');
}

export function getStoredUser(): UserProfile | null {
  const data = localStorage.getItem(STORAGE_KEYS.currentUser);
  return data ? (JSON.parse(data) as UserProfile) : null;
}

export function setStoredUser(user: UserProfile) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

export function getAdminToken() {
  return localStorage.getItem(STORAGE_KEYS.adminToken) || '';
}

export function setAdminToken(token: string) {
  localStorage.setItem(STORAGE_KEYS.adminToken, token);
}

export function clearAdminToken() {
  localStorage.removeItem(STORAGE_KEYS.adminToken);
}

export function getOrders(): Order[] {
  const data = localStorage.getItem(STORAGE_KEYS.localOrders);
  return data ? (JSON.parse(data) as Order[]) : [];
}

export function saveOrder(order: Order): void {
  const orders = getOrders();
  orders.push(order);
  localStorage.setItem(STORAGE_KEYS.localOrders, JSON.stringify(orders));
}

export function updateOrderStatus(orderId: string, status: OrderStatus): void {
  const orders = getOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index !== -1) {
    orders[index].status = status;
    localStorage.setItem(STORAGE_KEYS.localOrders, JSON.stringify(orders));
  }
}

export function deleteOrder(orderId: string): void {
  const orders = getOrders();
  const filteredOrders = orders.filter((order) => order.id !== orderId);
  localStorage.setItem(STORAGE_KEYS.localOrders, JSON.stringify(filteredOrders));
}

export function generateOrderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;
}

export function hasOrderedOnce(userId: string) {
  return localStorage.getItem(`hasOrderedOnce:${userId}`) === '1';
}

export function markOrderedOnce(userId: string) {
  localStorage.setItem(`hasOrderedOnce:${userId}`, '1');
}

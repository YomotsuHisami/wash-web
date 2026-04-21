export interface DamageItem {
  id: string;
  type: string;
  severity: '轻度' | '中度' | '重度';
  surcharge: number;
}

export interface ShoeData {
  brand: string;
  model: string;
  series: string;
  confidence: number;
  material: string;
  careTip: string;
  damages: DamageItem[];
  pricing: {
    baseFee: number;
  };
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  preferredShop: string;
  pickupTime: string;
  notes: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'cancelled';

export interface PricingBreakdown {
  baseFee: number;
  damageTotal: number;
  subtotal: number;
  discountId?: string;
  discountTitle?: string;
  discountRate?: number;
}

export interface Order {
  id: string;
  createdAt: number;
  status: OrderStatus;
  shoeData: ShoeData;
  customerInfo: CustomerInfo;
  totalPrice: number;
}

export type UserGroup = 'normal' | 'vip';

export interface Discount {
  id: string;
  title: string;
  description: string;
  rate: number;
  startTime: string;
  endTime: string;
  imageUrl: string;
  applicableGroup: UserGroup | 'all';
  mode?: 'normal' | 'first_order';
}

export interface Shop {
  id: string;
  name: string;
  address: string;
}

export interface UserProfile {
  id: string;
  username: string;
  group: UserGroup;
  defaultInfo?: Partial<CustomerInfo>;
}

export interface ServerOrder extends Order {
  userName?: string;
  userPhone?: string;
  userAddress?: string;
  preferredShop?: string;
  pickupTime?: string;
  notes?: string;
  price?: number;
  analysisResult?: ShoeData;
  imageUrl?: string;
  imageUrls?: string[];
  pricingBreakdown?: PricingBreakdown;
}

export function normalizeOrderStatus(status: string): OrderStatus {
  if (status === 'pending') {
    return 'pending_payment';
  }

  if (
    status === 'pending_payment' ||
    status === 'paid' ||
    status === 'processing' ||
    status === 'completed' ||
    status === 'cancelled'
  ) {
    return status;
  }

  return 'pending_payment';
}

export function isDiscountActive(discount: Discount, now = Date.now()) {
  const start = discount.startTime ? new Date(discount.startTime).getTime() : null;
  const end = discount.endTime ? new Date(discount.endTime).getTime() : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

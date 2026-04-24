export interface DamageItem {
  id: string;
  type: string;
  severity: '轻度' | '中度' | '重度';
  surcharge: number;
  note?: string;
}

export type ShoeConditionLevel = '轻度' | '中度' | '重度';
export type ServicePreference = 'balanced' | 'value' | 'quality' | 'speed' | 'oxidation';

export interface ShoeMaterialPart {
  part: string;
  material: string;
}

export interface ShoeData {
  shoeType: string;
  brand: string;
  model: string;
  series: string;
  confidence: number;
  materials: ShoeMaterialPart[];
  wearLevel: ShoeConditionLevel;
  conditionSummary: string;
  careTip: string;
  damages: DamageItem[];
  renewalScore: number;
  estimatedTurnaround: string;
  pricing: {
    baseFee: number;
    manualReviewNote?: string;
  };
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes: string;
  servicePreference?: ServicePreference;
}

export interface SavedOrderInfo extends CustomerInfo {
  id: string;
  label: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'pricing_review'
  | 'sent_to_shop'
  | 'cleaning'
  | 'completed_cleaning'
  | 'returning'
  | 'delivered'
  | 'cancelled';

export interface OrderProgressUpdate {
  id: string;
  status: OrderStatus;
  note?: string;
  createdAt: number;
  imageUrls?: string[];
}

export interface PricingBreakdown {
  baseFee: number;
  damageTotal: number;
  serviceFee?: number;
  addonTotal?: number;
  subtotal: number;
  discountAmount?: number;
  selectedPlanId?: string;
  selectedPlanTitle?: string;
  discountId?: string;
  discountTitle?: string;
  discountRate?: number;
  total?: number;
}

export interface ServiceRecommendation {
  id: string;
  strategy: 'recommended' | 'value' | 'premium' | 'oxidation';
  title: string;
  shopId: string;
  shopName: string;
  summary: string;
  reason: string;
  matchScore: number;
  distanceKm: number;
  estimatedTurnaround: string;
  serviceFee: number;
  addonTotal: number;
  prepayPrice: number;
  includedServices: string[];
  valueAdds: string[];
  caution: string;
}

export interface Order {
  id: string;
  createdAt: number;
  status: OrderStatus;
  progressUpdates?: OrderProgressUpdate[];
  shoeData: ShoeData;
  customerInfo: CustomerInfo;
  selectedServicePlan?: ServiceRecommendation;
  alternativePlans?: ServiceRecommendation[];
  totalPrice: number;
}

export type UserGroup = 'normal';

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
  distanceKm?: number;
  qualityScore?: number;
  valueScore?: number;
  speedScore?: number;
  oxidationScore?: number;
  specialtyMaterials?: string[];
  specialtyServices?: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  group: UserGroup;
  defaultInfo?: Partial<CustomerInfo>;
  defaultInfoId?: string;
  orderInfos?: SavedOrderInfo[];
}

export interface ServerOrder extends Order {
  userName?: string;
  userPhone?: string;
  userAddress?: string;
  notes?: string;
  servicePreference?: ServicePreference;
  price?: number;
  analysisResult?: ShoeData;
  imageUrl?: string;
  imageUrls?: string[];
  pricingBreakdown?: PricingBreakdown;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  pricing_review: '进一步确价',
  sent_to_shop: '送到洗鞋店',
  cleaning: '清洗中',
  completed_cleaning: '清洗完成',
  returning: '送回中',
  delivered: '已送达',
  cancelled: '已取消',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending_payment',
  'paid',
  'pricing_review',
  'sent_to_shop',
  'cleaning',
  'completed_cleaning',
  'returning',
  'delivered',
];

export function normalizeOrderStatus(status: string): OrderStatus {
  if (status === 'pending') {
    return 'pending_payment';
  }

  if (status === 'processing') {
    return 'cleaning';
  }

  if (status === 'completed') {
    return 'delivered';
  }

  if (
    status === 'pending_payment' ||
    status === 'paid' ||
    status === 'pricing_review' ||
    status === 'sent_to_shop' ||
    status === 'cleaning' ||
    status === 'completed_cleaning' ||
    status === 'returning' ||
    status === 'delivered' ||
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

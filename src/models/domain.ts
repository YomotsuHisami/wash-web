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
  preferredShop: string;
  pickupTime: string;
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
  | 'processing'
  | 'completed'
  | 'cancelled';

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
  shoeData: ShoeData;
  customerInfo: CustomerInfo;
  selectedServicePlan?: ServiceRecommendation;
  alternativePlans?: ServiceRecommendation[];
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
  preferredShop?: string;
  pickupTime?: string;
  notes?: string;
  servicePreference?: ServicePreference;
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

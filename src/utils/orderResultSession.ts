import {
  CustomerInfo,
  Discount,
  SavedOrderInfo,
  ServicePreference,
  ServiceRecommendation,
  ShoeData,
} from '../models/domain';
import {
  hasRequiredOrderInfo as hasRequiredOrderInfoFromPool,
} from './orderInfoUtils';

const ORDER_RESULT_SNAPSHOT_KEY = 'wash-web:order-result-snapshot';

export interface OrderResultSnapshot {
  confirmedShoeData: ShoeData;
  recommendations: ServiceRecommendation[];
  selectedPlanId: string;
  eligibleDiscounts: Discount[];
  selectedDiscountId: string | null;
  selectedPaymentMethod?: 'alipay' | 'wechat';
  servicePreference: ServicePreference;
  formData: CustomerInfo;
  pricingBaselineInfo?: CustomerInfo;
  selectedOrderInfoId?: string | null;
  orderInfos?: SavedOrderInfo[];
  capturedImages: string[];
}

export interface OrderResultViewModel {
  selectedPlan: ServiceRecommendation | null;
  selectedDiscount: Discount | null;
  autoAppliedDiscount: Discount | null;
  alternativePlans: ServiceRecommendation[];
  storeCoverageCount: number;
  summaryLabel: string;
  finalPrice: number;
  discountAmount: number;
  subtotal: number;
  baseFee: number;
  damageTotal: number;
  serviceFee: number;
  addonTotal: number;
  needsReview: true;
  embeddedMetrics: Array<{ label: string; value: string }>;
  serviceItems: string[];
  materialSupportLabel: string;
  lockedOrderInfoSummary: string;
}

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function saveOrderResultSnapshot(snapshot: OrderResultSnapshot) {
  getStorage()?.setItem(ORDER_RESULT_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getOrderResultSnapshot(): OrderResultSnapshot | null {
  const raw = getStorage()?.getItem(ORDER_RESULT_SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OrderResultSnapshot;
  } catch {
    return null;
  }
}

export function clearOrderResultSnapshot() {
  getStorage()?.removeItem(ORDER_RESULT_SNAPSHOT_KEY);
}

export function hasRequiredOrderInfo(defaultInfo?: Partial<CustomerInfo> | null) {
  return hasRequiredOrderInfoFromPool(defaultInfo);
}

export function getBestDiscount(
  discounts: Discount[],
  subtotal: number,
  preferredDiscountId?: string | null
) {
  if (!discounts.length || !subtotal) return null;

  if (preferredDiscountId) {
    const preferred = discounts.find((discount) => discount.id === preferredDiscountId);
    if (preferred) return preferred;
  }

  return discounts.reduce<Discount | null>((best, current) => {
    if (!best) return current;
    const bestTotal = Math.round(subtotal * (best.rate / 100));
    const currentTotal = Math.round(subtotal * (current.rate / 100));
    return currentTotal < bestTotal ? current : best;
  }, null);
}

export function buildOrderResultViewModel(
  snapshot: OrderResultSnapshot
): OrderResultViewModel {
  const selectedPlan =
    snapshot.recommendations.find((plan) => plan.id === snapshot.selectedPlanId) ||
    snapshot.recommendations[0] ||
    null;
  const baseFee = snapshot.confirmedShoeData.pricing.baseFee;
  const damageTotal = snapshot.confirmedShoeData.damages.reduce(
    (sum, damage) => sum + damage.surcharge,
    0
  );
  const serviceFee = selectedPlan?.serviceFee || 0;
  const addonTotal = selectedPlan?.addonTotal || 0;
  const subtotal = baseFee + damageTotal + serviceFee + addonTotal;
  const autoAppliedDiscount = getBestDiscount(
    snapshot.eligibleDiscounts,
    subtotal,
    snapshot.selectedDiscountId
  );
  const selectedDiscount = autoAppliedDiscount;
  const finalPrice = selectedDiscount
    ? Math.round(subtotal * (selectedDiscount.rate / 100))
    : subtotal;
  const discountAmount = Math.max(subtotal - finalPrice, 0);
  const uniqueShopIds = new Set(
    snapshot.recommendations.map((plan) => plan.shopId || plan.id)
  );
  const storeCoverageCount = uniqueShopIds.size || snapshot.recommendations.length;
  const materialSupportLabel = snapshot.confirmedShoeData.materials
    .slice(0, 2)
    .map((item) => item.material)
    .join(' / ');

  return {
    selectedPlan,
    selectedDiscount,
    autoAppliedDiscount,
    alternativePlans: snapshot.recommendations.filter(
      (plan) => plan.id !== selectedPlan?.id
    ),
    storeCoverageCount,
    materialSupportLabel,
    summaryLabel: `${storeCoverageCount} 家门店可处理 · ${snapshot.confirmedShoeData.wearLevel}鞋况适配`,
    finalPrice,
    discountAmount,
    subtotal,
    baseFee,
    damageTotal,
    serviceFee,
    addonTotal,
    needsReview: true,
    embeddedMetrics: [
      { label: '匹配度', value: `${selectedPlan?.matchScore || 0} / 100` },
      { label: '距离', value: `${selectedPlan?.distanceKm || 0} km` },
      { label: '门店数', value: `${storeCoverageCount} 家` },
      { label: '预计时效', value: selectedPlan?.estimatedTurnaround || '--' },
      { label: '鞋况适配', value: snapshot.confirmedShoeData.wearLevel },
      { label: '材质适配', value: materialSupportLabel || '--' },
    ],
    serviceItems: [
      '平台上门取鞋',
      '材质分级精洗',
      '重点部位护理',
      '人工复核定档',
    ],
    lockedOrderInfoSummary: [
      snapshot.formData.name,
      snapshot.formData.phone,
      snapshot.formData.address,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

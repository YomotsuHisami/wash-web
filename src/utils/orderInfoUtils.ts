import {
  CustomerInfo,
  SavedOrderInfo,
  ServicePreference,
  UserProfile,
} from '../models/domain';

export const emptyCustomerInfo: CustomerInfo = {
  name: '',
  phone: '',
  address: '',
  preferredShop: '',
  pickupTime: '尽快',
  notes: '',
  servicePreference: 'balanced',
};

export function createOrderInfoId() {
  return `order-info-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function buildOrderInfoLabel(
  orderInfo: Partial<CustomerInfo>,
  fallbackIndex = 1
) {
  const base =
    orderInfo.name?.trim() ||
    orderInfo.address?.trim() ||
    orderInfo.preferredShop?.trim() ||
    '';
  return base ? `${base}资料` : `订单资料 ${fallbackIndex}`;
}

export function createSavedOrderInfo(
  source?: Partial<SavedOrderInfo>,
  fallbackIndex = 1
): SavedOrderInfo {
  return {
    ...emptyCustomerInfo,
    ...source,
    id: source?.id || createOrderInfoId(),
    label: source?.label || buildOrderInfoLabel(source || {}, fallbackIndex),
    servicePreference:
      (source?.servicePreference as ServicePreference | undefined) || 'balanced',
  };
}

export function migrateUserProfileOrderInfos(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null;

  const existingInfos = (profile.orderInfos || [])
    .filter(Boolean)
    .map((item, index) => createSavedOrderInfo(item, index + 1));

  const legacyDefault =
    profile.defaultInfo && Object.values(profile.defaultInfo).some(Boolean)
      ? createSavedOrderInfo(
          {
            ...profile.defaultInfo,
            id: profile.defaultInfoId || 'legacy-default-order-info',
            label: '默认订单资料',
          },
          1
        )
      : null;

  const orderInfos =
    existingInfos.length > 0
      ? existingInfos
      : legacyDefault
      ? [legacyDefault]
      : [];

  const defaultInfoId =
    profile.defaultInfoId && orderInfos.some((item) => item.id === profile.defaultInfoId)
      ? profile.defaultInfoId
      : orderInfos[0]?.id;

  const defaultInfo =
    orderInfos.find((item) => item.id === defaultInfoId) || orderInfos[0] || undefined;

  return {
    ...profile,
    orderInfos,
    defaultInfoId,
    defaultInfo,
  };
}

export function getOrderInfos(profile?: UserProfile | null) {
  return migrateUserProfileOrderInfos(profile)?.orderInfos || [];
}

export function getDefaultOrderInfo(profile?: UserProfile | null) {
  const normalized = migrateUserProfileOrderInfos(profile);
  if (!normalized) return null;
  return (
    normalized.orderInfos?.find((item) => item.id === normalized.defaultInfoId) ||
    normalized.orderInfos?.[0] ||
    null
  );
}

export function getSelectedOrderInfo(
  profile?: UserProfile | null,
  selectedOrderInfoId?: string | null
) {
  const normalized = migrateUserProfileOrderInfos(profile);
  if (!normalized) return null;

  return (
    normalized.orderInfos?.find((item) => item.id === selectedOrderInfoId) ||
    getDefaultOrderInfo(normalized)
  );
}

export function toCustomerInfo(
  info?: Partial<CustomerInfo | SavedOrderInfo> | null
): CustomerInfo {
  return {
    ...emptyCustomerInfo,
    ...info,
    servicePreference:
      (info?.servicePreference as ServicePreference | undefined) || 'balanced',
  };
}

export function hasRequiredOrderInfo(
  info?: Partial<CustomerInfo | SavedOrderInfo> | null
) {
  return Boolean(info?.name && info?.phone && info?.address);
}

export function isRepriceSensitiveOrderInfoChange(
  previous?: Partial<CustomerInfo | SavedOrderInfo> | null,
  next?: Partial<CustomerInfo | SavedOrderInfo> | null
) {
  return (
    (previous?.address || '') !== (next?.address || '') ||
    (previous?.preferredShop || '') !== (next?.preferredShop || '') ||
    (previous?.pickupTime || '') !== (next?.pickupTime || '')
  );
}

export function summarizeOrderInfo(info?: Partial<CustomerInfo | SavedOrderInfo> | null) {
  if (!info) return '';
  return [info.name, info.phone, info.address].filter(Boolean).join(' · ');
}

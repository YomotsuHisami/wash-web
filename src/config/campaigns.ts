import { Discount } from '../models/domain';

export const campaignAssets = {
  feature: '/campaigns/home-promo-main.png',
  membership: '/campaigns/membership-promo.png',
  assurance: '/campaigns/assurance-banner.png',
} as const;

export function resolveDiscountImage(
  discount?: Discount | null,
  fallback: string = campaignAssets.feature
) {
  if (discount?.imageUrl) {
    return discount.imageUrl;
  }

  if (discount?.applicableGroup === 'vip') {
    return campaignAssets.membership;
  }

  return fallback;
}

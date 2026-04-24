import { Discount } from '../models/domain';

export const campaignAssets = {
  feature: '/campaigns/home-promo-main.png',
  assurance: '/campaigns/assurance-banner.png',
} as const;

export function resolveDiscountImage(
  discount?: Discount | null,
  fallback: string = campaignAssets.feature
) {
  if (discount?.imageUrl) {
    return discount.imageUrl;
  }

  return fallback;
}

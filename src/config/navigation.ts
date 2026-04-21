import {
  compassOutline,
  personOutline,
  receiptOutline,
} from 'ionicons/icons';

export interface AppTabItem {
  key: string;
  title: string;
  route: string;
  icon: string;
}

export const appTabs: AppTabItem[] = [
  { key: 'home', title: '首页', route: '/app/home', icon: compassOutline },
  { key: 'orders', title: '订单', route: '/app/orders', icon: receiptOutline },
  { key: 'account', title: '我的', route: '/app/account', icon: personOutline },
];

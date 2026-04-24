import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { appTabs } from '../config/navigation';
import HomePage from '../pages/HomePage';
import OrderFlowPage from '../pages/OrderFlowPage';
import OrdersPage from '../pages/OrdersPage';
import AccountPage from '../pages/AccountPage';
import OrderResultPage from '../pages/OrderResultPage';
import OrderInfoPage from '../pages/OrderInfoPage';
import OrderPayPage from '../pages/OrderPayPage';
import OrderDetailPage from '../pages/OrderDetailPage';
import OrderProgressImagesPage from '../pages/OrderProgressImagesPage';

export default function AppTabs() {
  const location = useLocation();
  const hideTabBar = [
    '/app/order/result',
    '/app/order/info',
    '/app/order/pay',
  ].includes(location.pathname);
  const hideOrderPaymentTabBar =
    location.pathname === '/app/order' &&
    new URLSearchParams(location.search).get('resume') === 'payment';

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/app/home" component={HomePage} />
        <Route exact path="/app/order" component={OrderFlowPage} />
        <Route exact path="/app/order/result" component={OrderResultPage} />
        <Route exact path="/app/order/info" component={OrderInfoPage} />
        <Route exact path="/app/order/pay" component={OrderPayPage} />
        <Route exact path="/app/orders" component={OrdersPage} />
        <Route exact path="/app/orders/:orderId" component={OrderDetailPage} />
        <Route exact path="/app/orders/:orderId/progress/:progressId" component={OrderProgressImagesPage} />
        <Route exact path="/app/account" component={AccountPage} />
        <Route exact path="/app" render={() => <Redirect to="/app/home" />} />
      </IonRouterOutlet>
      {!hideTabBar && !hideOrderPaymentTabBar ? (
        <IonTabBar slot="bottom" className="app-tab-bar">
          {appTabs.map((tab) => (
            <IonTabButton key={tab.key} tab={tab.key} href={tab.route}>
              <IonIcon icon={tab.icon} />
              <IonLabel>{tab.title}</IonLabel>
            </IonTabButton>
          ))}
        </IonTabBar>
      ) : null}
    </IonTabs>
  );
}

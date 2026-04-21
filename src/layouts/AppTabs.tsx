import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { Redirect, Route } from 'react-router-dom';
import { appTabs } from '../config/navigation';
import HomePage from '../pages/HomePage';
import OrderFlowPage from '../pages/OrderFlowPage';
import OrdersPage from '../pages/OrdersPage';
import AccountPage from '../pages/AccountPage';

export default function AppTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/app/home" component={HomePage} />
        <Route exact path="/app/order" component={OrderFlowPage} />
        <Route exact path="/app/orders" component={OrdersPage} />
        <Route exact path="/app/account" component={AccountPage} />
        <Route exact path="/app" render={() => <Redirect to="/app/home" />} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="app-tab-bar">
        {appTabs.map((tab) => (
          <IonTabButton key={tab.key} tab={tab.key} href={tab.route}>
            <IonIcon icon={tab.icon} />
            <IonLabel>{tab.title}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}

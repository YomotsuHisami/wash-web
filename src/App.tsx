import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import AppTabs from './layouts/AppTabs';
import LaunchPage from './pages/LaunchPage';
import AdminPage from './pages/AdminPage';

setupIonicReact();

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/" component={LaunchPage} />
          <Route exact path="/intro" render={() => <Redirect to="/app/home" />} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/app" component={AppTabs} />
          <Route render={() => <Redirect to="/" />} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}

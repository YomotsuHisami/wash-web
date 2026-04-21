import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import BrandMark from '../components/common/BrandMark';
import { brandConfig } from '../config/brand';

export default function LaunchPage() {
  const history = useHistory();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      history.replace('/app/home');
    }, 420);

    return () => window.clearTimeout(timer);
  }, [history]);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="launch-screen">
          <div className="launch-orb">
            <BrandMark size={72} />
          </div>
          <p className="page-eyebrow">SNEAKER CARE</p>
          <h1>{brandConfig.name}</h1>
          <p>{brandConfig.tagline}</p>
          <IonSpinner name="crescent" />
        </div>
      </IonContent>
    </IonPage>
  );
}

import { IonCard, IonCardContent, IonIcon } from '@ionic/react';
import { cameraOutline, checkmarkCircle } from 'ionicons/icons';

interface Props {
  title: string;
  tip: string;
  image: string;
  active?: boolean;
  captured?: boolean;
}

export default function CaptureGuideCard({
  title,
  tip,
  image,
  active = false,
  captured = false,
}: Props) {
  return (
    <IonCard className={`surface-card capture-guide${active ? ' is-active' : ''}`}>
      <div className="capture-guide__media">
        <img alt={title} src={image} />
      </div>
      <IonCardContent>
        <div className="capture-guide__title">
          <h3>{title}</h3>
          <IonIcon icon={captured ? checkmarkCircle : cameraOutline} />
        </div>
        <p>{tip}</p>
      </IonCardContent>
    </IonCard>
  );
}

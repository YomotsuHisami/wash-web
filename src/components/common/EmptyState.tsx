import { IonCard, IonCardContent, IonIcon } from '@ionic/react';

interface Props {
  icon: string;
  title: string;
  message: string;
}

export default function EmptyState({ icon, title, message }: Props) {
  return (
    <IonCard className="surface-card empty-card">
      <IonCardContent>
        <div className="empty-state">
          <div className="empty-icon">
            <IonIcon icon={icon} />
          </div>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

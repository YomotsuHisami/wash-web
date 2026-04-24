import { IonButton, IonIcon } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';

interface Props {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  action,
}: Props) {
  return (
    <div className="page-header">
      <div className="page-header__meta">
        {onBack ? (
          <IonButton fill="clear" className="back-button" onClick={onBack}>
            <IonIcon icon={chevronBackOutline} slot="start" />
            返回
          </IonButton>
        ) : null}
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  );
}

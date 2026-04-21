import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
}

export default function AdminFormModal({ isOpen, title, onDismiss, children }: Props) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} breakpoints={[0, 0.85]} initialBreakpoint={0.85}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>关闭</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding modal-content">{children}</IonContent>
    </IonModal>
  );
}

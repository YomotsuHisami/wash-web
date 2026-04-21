import { IonLoading } from '@ionic/react';

interface Props {
  isOpen: boolean;
  message?: string;
}

export default function AppLoadingOverlay({ isOpen, message }: Props) {
  return <IonLoading isOpen={isOpen} message={message || '加载中...'} spinner="crescent" />;
}

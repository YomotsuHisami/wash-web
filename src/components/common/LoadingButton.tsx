import { IonButton, IonSpinner } from '@ionic/react';
import { ComponentProps, ReactNode } from 'react';

interface Props extends Omit<ComponentProps<typeof IonButton>, 'children'> {
  loading?: boolean;
  children: ReactNode;
}

export default function LoadingButton({
  loading = false,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <IonButton disabled={disabled || loading} {...props}>
      {loading ? <IonSpinner name="crescent" slot="start" /> : null}
      {children}
    </IonButton>
  );
}

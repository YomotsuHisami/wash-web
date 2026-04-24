import { IonChip } from '@ionic/react';
import { OrderStatus, ORDER_STATUS_LABELS } from '../../models/domain';

interface Props {
  status: OrderStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <IonChip className={`status-chip status-chip--${status}`}>
      {ORDER_STATUS_LABELS[status]}
    </IonChip>
  );
}

import { IonChip } from '@ionic/react';
import { OrderStatus } from '../../models/domain';

interface Props {
  status: OrderStatus;
}

const statusLabel: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  processing: '洗护中',
  completed: '已完成',
  cancelled: '已取消',
};

export default function StatusBadge({ status }: Props) {
  return (
    <IonChip className={`status-chip status-chip--${status}`}>
      {statusLabel[status]}
    </IonChip>
  );
}

import { IonCard, IonCardContent } from '@ionic/react';
import { Discount } from '../../models/domain';

interface Props {
  baseFee: number;
  damageTotal: number;
  total: number;
  selectedDiscount?: Discount | null;
}

export default function PriceSummaryCard({
  baseFee,
  damageTotal,
  total,
  selectedDiscount,
}: Props) {
  const subtotal = baseFee + damageTotal;

  return (
    <IonCard className="surface-card price-card">
      <IonCardContent>
        <div className="price-row">
          <span>基础清洁</span>
          <strong>¥{baseFee}</strong>
        </div>
        <div className="price-row">
          <span>污损附加</span>
          <strong>¥{damageTotal}</strong>
        </div>
        <div className="price-row">
          <span>小计</span>
          <strong>¥{subtotal}</strong>
        </div>
        {selectedDiscount ? (
          <div className="price-row discount-row">
            <span>{selectedDiscount.title}</span>
            <strong>{(selectedDiscount.rate / 10).toFixed(1).replace(/\.0$/, '')} 折</strong>
          </div>
        ) : null}
        <div className="price-row price-row--total">
          <span>合计</span>
          <strong>¥{total}</strong>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

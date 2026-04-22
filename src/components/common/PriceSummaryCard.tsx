import { IonCard, IonCardContent } from '@ionic/react';
import { Discount } from '../../models/domain';

interface Props {
  baseFee: number;
  damageTotal: number;
  serviceFee?: number;
  addonTotal?: number;
  discountAmount?: number;
  total: number;
  selectedDiscount?: Discount | null;
  totalLabel?: string;
}

export default function PriceSummaryCard({
  baseFee,
  damageTotal,
  serviceFee = 0,
  addonTotal = 0,
  discountAmount = 0,
  total,
  selectedDiscount,
  totalLabel = '合计',
}: Props) {
  const subtotal = baseFee + damageTotal + serviceFee + addonTotal;

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
        {serviceFee > 0 ? (
          <div className="price-row">
            <span>方案服务费</span>
            <strong>¥{serviceFee}</strong>
          </div>
        ) : null}
        {addonTotal > 0 ? (
          <div className="price-row">
            <span>增值服务</span>
            <strong>¥{addonTotal}</strong>
          </div>
        ) : null}
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
        {discountAmount > 0 ? (
          <div className="price-row discount-row">
            <span>优惠减免</span>
            <strong>-¥{discountAmount}</strong>
          </div>
        ) : null}
        <div className="price-row price-row--total">
          <span>{totalLabel}</span>
          <strong>¥{total}</strong>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

import { IonCard, IonCardContent } from '@ionic/react';
import { Discount } from '../../models/domain';

interface Props {
  title?: string;
  body?: string;
  imageUrl?: string;
  discount?: Discount;
  badge?: string;
  onClick?: () => void;
}

export default function PromoCard({
  title,
  body,
  imageUrl,
  discount,
  badge,
  onClick,
}: Props) {
  const cardTitle = discount?.title || title || '';
  const cardBody =
    discount?.description ||
    body ||
    (discount ? `${(discount.rate / 10).toFixed(1).replace(/\.0$/, '')} 折活动` : '');
  const image = discount?.imageUrl || imageUrl;

  return (
    <IonCard className={`surface-card promo-card${onClick ? ' is-clickable' : ''}`} button={!!onClick} onClick={onClick}>
      {image ? (
        <div className="promo-card__media">
          <img alt={cardTitle} src={image} />
        </div>
      ) : null}
      <IonCardContent>
        {badge || discount ? (
          <div className="promo-badge">
            {badge || `${(discount!.rate / 10).toFixed(1).replace(/\.0$/, '')} 折`}
          </div>
        ) : null}
        <h3>{cardTitle}</h3>
        <p>{cardBody}</p>
      </IonCardContent>
    </IonCard>
  );
}

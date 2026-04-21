import { IonCard, IonCardContent } from '@ionic/react';
import type { CSSProperties } from 'react';

interface Props {
  title: string;
  body: string;
  imageUrl?: string;
  badge?: string;
  meta?: string;
  onClick?: () => void;
  mediaRatio?: string;
  dense?: boolean;
}

export default function CompactPromoTile({
  title,
  body,
  imageUrl,
  badge,
  meta,
  onClick,
  mediaRatio,
  dense,
}: Props) {
  return (
    <IonCard
      button={!!onClick}
      className={`surface-card compact-promo-tile${onClick ? ' is-clickable' : ''}${dense ? ' is-dense' : ''}`}
      onClick={onClick}
      style={mediaRatio ? ({ '--tile-ratio': mediaRatio } as CSSProperties) : undefined}
    >
      <IonCardContent className="compact-promo-tile__content">
        {imageUrl ? (
          <div className="compact-promo-tile__thumb">
            <img alt={title} src={imageUrl} />
          </div>
        ) : null}
        <div className="compact-promo-tile__body">
          {badge ? <div className="promo-badge">{badge}</div> : null}
          <h3>{title}</h3>
          <p>{body}</p>
          {meta ? <span className="compact-promo-tile__meta">{meta}</span> : null}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

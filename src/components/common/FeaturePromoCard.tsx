import { IonButton, IonCard, IonCardContent } from '@ionic/react';
import type { CSSProperties } from 'react';

interface Props {
  title: string;
  body: string;
  imageUrl: string;
  eyebrow?: string;
  badge?: string;
  ctaLabel?: string;
  imageAlt?: string;
  onClick?: () => void;
  mediaRatio?: string;
  dense?: boolean;
}

export default function FeaturePromoCard({
  title,
  body,
  imageUrl,
  eyebrow,
  badge,
  ctaLabel,
  imageAlt,
  onClick,
  mediaRatio,
  dense,
}: Props) {
  return (
    <IonCard
      button={!!onClick}
      className={`surface-card feature-promo-card${onClick ? ' is-clickable' : ''}${dense ? ' is-dense' : ''}`}
      onClick={onClick}
      style={mediaRatio ? ({ '--feature-ratio': mediaRatio } as CSSProperties) : undefined}
    >
      <div className="feature-promo-card__media">
        <img alt={imageAlt || title} src={imageUrl} />
      </div>
      <div className="feature-promo-card__overlay" />
      <IonCardContent className="feature-promo-card__content">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        {badge ? <div className="promo-badge">{badge}</div> : null}
        <h3>{title}</h3>
        <p>{body}</p>
        {ctaLabel ? (
          <IonButton color="light" fill="solid" shape="round" size="small">
            {ctaLabel}
          </IonButton>
        ) : null}
      </IonCardContent>
    </IonCard>
  );
}

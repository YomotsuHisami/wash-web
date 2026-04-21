import { IonCard, IonCardContent, IonSkeletonText } from '@ionic/react';

interface Props {
  lines?: number;
  repeat?: number;
}

export default function CardSkeleton({ lines = 3, repeat = 1 }: Props) {
  return (
    <>
      {Array.from({ length: repeat }).map((_, index) => (
        <IonCard className="surface-card" key={index}>
          <IonCardContent>
            {Array.from({ length: lines }).map((__, lineIndex) => (
              <IonSkeletonText
                animated
                key={lineIndex}
                style={{
                  width: lineIndex === 0 ? '62%' : lineIndex === lines - 1 ? '84%' : '100%',
                  height: lineIndex === 0 ? '18px' : '14px',
                  marginBottom: '12px',
                }}
              />
            ))}
          </IonCardContent>
        </IonCard>
      ))}
    </>
  );
}

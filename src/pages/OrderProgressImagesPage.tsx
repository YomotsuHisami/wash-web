import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { fetchOrderById } from '../api/orders';
import { ServerOrder } from '../models/domain';

export default function OrderProgressImagesPage() {
  const history = useHistory();
  const { orderId, progressId } = useParams<{ orderId: string; progressId: string }>();
  const [order, setOrder] = useState<ServerOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    fetchOrderById(orderId)
      .then((nextOrder) => {
        if (mounted) {
          setOrder(nextOrder);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '订单图片加载失败。');
        }
      });

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const previewImage = useMemo(() => {
    const updates = Array.isArray(order?.progressUpdates) ? order.progressUpdates : [];
    const progress = updates.find((item) => item.id === progressId);
    return progress?.imageUrls?.[0] || '';
  }, [order?.progressUpdates, progressId]);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="order-progress-viewer">
        <div className="order-progress-viewer__shell">
          <IonButton
            className="order-progress-viewer__back"
            fill="clear"
            onClick={() => history.goBack()}
          >
            <IonIcon icon={arrowBackOutline} slot="start" />
            返回
          </IonButton>

          {previewImage ? (
            <img alt="订单状态图片" className="order-progress-viewer__image" src={previewImage} />
          ) : (
            <div className="order-progress-viewer__empty">
              <p>{error || '当前阶段暂无可查看图片。'}</p>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

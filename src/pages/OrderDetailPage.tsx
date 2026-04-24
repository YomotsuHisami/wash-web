import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import { arrowBackOutline, chevronForwardOutline, imageOutline, storefrontOutline } from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { fetchOrderById } from '../api/orders';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import {
  Order,
  OrderProgressUpdate,
  ORDER_STATUS_LABELS,
  ServerOrder,
  normalizeOrderStatus,
} from '../models/domain';
import { getOrders } from '../utils/storage';

type ResolvedOrder = (Order | ServerOrder) & {
  progressUpdates?: OrderProgressUpdate[];
  imageUrl?: string;
  imageUrls?: string[];
  userName?: string;
  userPhone?: string;
  userAddress?: string;
  price?: number;
};

export default function OrderDetailPage() {
  const history = useHistory();
  const { orderId } = useParams<{ orderId: string }>();
  const flowchartRef = useRef<HTMLDivElement | null>(null);
  const currentNodeRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<ResolvedOrder | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const localOrder =
          [...getOrders()].find((item) => item.id === orderId) || null;

        try {
          const serverOrder = await fetchOrderById(orderId);
          if (mounted) {
            setOrder(serverOrder);
            setError('');
          }
        } catch {
          if (mounted && localOrder) {
            setOrder({
              ...localOrder,
              progressUpdates: buildFallbackProgress(localOrder),
            });
          } else if (mounted) {
            setError('未找到该订单。');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const progressUpdates = useMemo(() => {
    if (!order) return [];
    const updates =
      Array.isArray(order.progressUpdates) && order.progressUpdates.length > 0
        ? order.progressUpdates
        : buildFallbackProgress(order);
    return [...updates].sort((a, b) => a.createdAt - b.createdAt);
  }, [order]);

  const detailFlowStatuses = [
    'pending_payment',
    'paid',
    'pricing_review',
    'sent_to_shop',
    'cleaning',
    'completed_cleaning',
  ] as const;
  const flowLabels = {
    pending_payment: '未支付',
    paid: ORDER_STATUS_LABELS.paid,
    pricing_review: ORDER_STATUS_LABELS.pricing_review,
    sent_to_shop: ORDER_STATUS_LABELS.sent_to_shop,
    cleaning: ORDER_STATUS_LABELS.cleaning,
    completed_cleaning: ORDER_STATUS_LABELS.completed_cleaning,
  } as const;
  const currentNormalizedStatus = normalizeOrderStatus(order?.status || 'pending_payment');
  const terminalStatuses = new Set(['completed_cleaning', 'returning', 'delivered']);
  const resolvedFlowStatus = detailFlowStatuses.includes(currentNormalizedStatus as typeof detailFlowStatuses[number])
    ? (currentNormalizedStatus as typeof detailFlowStatuses[number])
    : terminalStatuses.has(currentNormalizedStatus)
    ? 'completed_cleaning'
    : 'pending_payment';
  const currentFlowIndex = Math.max(0, detailFlowStatuses.indexOf(resolvedFlowStatus));
  const reachedTerminal = terminalStatuses.has(currentNormalizedStatus);
  const flowWindowSize = 4;
  const flowWindowStart = Math.max(
    0,
    Math.min(
      currentFlowIndex - 1,
      Math.max(0, detailFlowStatuses.length - flowWindowSize)
    )
  );
  const visibleFlowStatuses = detailFlowStatuses.slice(
    flowWindowStart,
    flowWindowStart + flowWindowSize
  );
  const hasFlowBefore = flowWindowStart > 0;
  const hasFlowAfter = flowWindowStart + flowWindowSize < detailFlowStatuses.length;

  useEffect(() => {
    const container = flowchartRef.current;
    const node = currentNodeRef.current;
    if (!container || !node) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetLeft =
      container.scrollLeft +
      (nodeRect.left - containerRect.left) -
      (container.clientWidth / 2 - node.clientWidth / 2);

    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, [currentFlowIndex, flowWindowStart]);

  if (loading) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="device-shell result-loading">
            <IonSpinner name="crescent" />
            <p className="muted">正在加载订单详情...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!order) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="device-shell stack-section">
            <PageHeader title="订单详情" eyebrow="ORDER DETAIL" onBack={() => history.goBack()} />
            <IonCard className="surface-card">
              <IonCardContent>
                <p className="form-message">{error || '订单不存在。'}</p>
              </IonCardContent>
            </IonCard>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const shoeData =
    'analysisResult' in order && order.analysisResult
      ? order.analysisResult
      : order.shoeData;
  const contactName = order.userName || order.customerInfo?.name;
  const contactPhone = order.userPhone || order.customerInfo?.phone;
  const contactAddress = order.userAddress || order.customerInfo?.address;
  const finalPrice = order.price || order.totalPrice;
  const orderMeta = `${new Date(order.createdAt).toLocaleString('zh-CN')} · 订单号 ${order.id}`;

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="device-shell stack-section">
          <PageHeader eyebrow="ORDER DETAIL" title="订单详情" onBack={() => history.goBack()} />

          <IonCard className="surface-card order-detail-hero">
            <IonCardContent className="stack-section">
              <p className="order-detail-hero__meta">{orderMeta}</p>
              <div className="order-detail-hero__center">
                <StatusBadge status={normalizeOrderStatus(order.status)} />
                <h2>{shoeData?.brand} {shoeData?.model}</h2>
                <div className="order-detail-hero__price">
                  <span>订单金额</span>
                  <strong>¥{finalPrice}</strong>
                </div>
              </div>
              <div className="order-detail-hero__steps">
                <div className="order-detail-flowchart" ref={flowchartRef}>
                  {hasFlowBefore ? <span className="order-detail-flowchart__edge">...</span> : null}
                  {visibleFlowStatuses.map((status, index) => {
                    const absoluteIndex = flowWindowStart + index;
                    const isPast = absoluteIndex < currentFlowIndex;
                    const isCurrent = absoluteIndex === currentFlowIndex;

                    return (
                      <div className="order-detail-flowchart__item" key={status}>
                        <div
                          className={`order-detail-flowchart__node${
                            isCurrent ? ' is-current' : isPast ? ' is-past' : ''
                          }`}
                          ref={isCurrent ? currentNodeRef : null}
                        >
                          <span />
                          <strong>{flowLabels[status]}</strong>
                          <em
                            className={`order-detail-flowchart__statusbar${
                              isPast || (reachedTerminal && isCurrent) ? ' is-complete' : ''
                            }`}
                          />
                        </div>
                        {index < visibleFlowStatuses.length - 1 ? (
                          <div
                            className={`order-detail-flowchart__connector${
                              absoluteIndex < currentFlowIndex ? ' is-active' : ''
                            }`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {hasFlowAfter ? <span className="order-detail-flowchart__edge">...</span> : null}
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard className="surface-card order-detail-card order-detail-card--summary">
            <IonCardContent className="stack-section">
              <div className="order-detail-summary-strip">
                <div>
                  <span>联系人</span>
                  <strong>{contactName} · {contactPhone}</strong>
                </div>
                <div>
                  <span>门店</span>
                  <strong>{order.selectedServicePlan?.shopName || '系统分配门店'}</strong>
                </div>
                <div>
                  <span>预计耗时</span>
                  <strong>{shoeData?.estimatedTurnaround || '2-3天'}</strong>
                </div>
              </div>
              <p className="order-detail-address">{contactAddress || '未填写地址'}</p>
            </IonCardContent>
          </IonCard>

          <IonCard className="surface-card order-detail-card">
            <IonCardContent className="stack-section">
              <div className="order-detail-card__head">
                <h3>订单进度</h3>
              </div>
              <div className="order-timeline">
                {progressUpdates.map((update, index) => (
                  <div className="order-timeline__item" key={update.id}>
                    <div className={`order-timeline__dot${index === progressUpdates.length - 1 ? ' is-current' : ''}`} />
                    <div className="order-timeline__body">
                      <div className="order-timeline__top">
                        <div>
                          <strong>{ORDER_STATUS_LABELS[update.status]}</strong>
                          <p>{new Date(update.createdAt).toLocaleString('zh-CN')}</p>
                        </div>
                        {Array.isArray(update.imageUrls) && update.imageUrls.length > 0 ? (
                          <IonButton
                            fill="clear"
                            onClick={() => history.push(`/app/orders/${order.id}/progress/${update.id}`)}
                          >
                            <IonIcon icon={imageOutline} slot="start" />
                            查看图片
                          </IonButton>
                        ) : null}
                      </div>
                      {update.note ? <p className="order-timeline__note">{update.note}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </IonCardContent>
          </IonCard>

          {order.selectedServicePlan ? (
            <IonCard className="surface-card order-detail-card order-detail-card--summary">
              <IonCardContent className="order-detail-service-inline">
                <IonIcon icon={storefrontOutline} />
                <div>
                  <strong>{order.selectedServicePlan.shopName}</strong>
                  <p>{order.selectedServicePlan.title}</p>
                </div>
              </IonCardContent>
            </IonCard>
          ) : null}
        </div>
      </IonContent>
    </IonPage>
  );
}

function buildFallbackProgress(order: Pick<Order, 'status' | 'createdAt'>): OrderProgressUpdate[] {
  return [
    {
      id: `fallback-${order.status}`,
      status: normalizeOrderStatus(order.status),
      note: '',
      createdAt: Number(order.createdAt) || Date.now(),
      imageUrls: [],
    },
  ];
}

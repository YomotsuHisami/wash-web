import {
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
} from '@ionic/react';
import { receiptOutline, searchOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useIonViewWillEnter } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { fetchOrderById } from '../api/orders';
import EmptyState from '../components/common/EmptyState';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import {
  Order,
  OrderProgressUpdate,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ServerOrder,
  normalizeOrderStatus,
} from '../models/domain';
import { getOrders } from '../utils/storage';

const FILTERS: Array<{ label: string; value: 'all' | OrderStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending_payment' },
  { label: '已支付', value: 'paid' },
  { label: '进一步确价', value: 'pricing_review' },
  { label: '送到洗鞋店', value: 'sent_to_shop' },
  { label: '清洗中', value: 'cleaning' },
  { label: '清洗完成', value: 'completed_cleaning' },
  { label: '送回中', value: 'returning' },
  { label: '已送达', value: 'delivered' },
];

export default function OrdersPage() {
  const history = useHistory();
  const [view, setView] = useState<'local' | 'search'>('local');
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [searchId, setSearchId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [serverOrder, setServerOrder] = useState<ServerOrder | null>(null);

  useIonViewWillEnter(() => {
    let mounted = true;

    const loadOrders = async () => {
      const baseOrders = [...getOrders()]
        .map((order) => ({ ...order, status: normalizeOrderStatus(order.status) }))
        .sort((a, b) => b.createdAt - a.createdAt);

      const syncedOrders = await Promise.all(
        baseOrders.map(async (order) => {
          try {
            const serverOrder = await fetchOrderById(order.id);
            return {
              ...order,
              status: normalizeOrderStatus(serverOrder.status),
              progressUpdates: serverOrder.progressUpdates,
              selectedServicePlan: serverOrder.selectedServicePlan || order.selectedServicePlan,
              totalPrice: serverOrder.price || serverOrder.totalPrice || order.totalPrice,
            };
          } catch {
            return order;
          }
        })
      );

      if (mounted) {
        setLocalOrders(syncedOrders);
      }
    };

    loadOrders();

    return () => {
      mounted = false;
    };
  });

  const handleSearch = async () => {
    if (!searchId.trim()) {
      setSearchError('请输入订单号后再查询。');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setServerOrder(null);

    try {
      const nextOrder = await fetchOrderById(searchId.trim());
      setServerOrder(nextOrder);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '查询失败，请稍后再试。');
    } finally {
      setSearchLoading(false);
    }
  };

  const filteredOrders =
    filter === 'all' ? localOrders : localOrders.filter((order) => order.status === filter);

  const getProgressWithImages = (order?: Pick<Order | ServerOrder, 'progressUpdates' | 'status'> | null) => {
    const updates = Array.isArray(order?.progressUpdates) ? [...order.progressUpdates] : [];
    const currentStatus = order?.status ? normalizeOrderStatus(order.status) : null;
    return updates
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(
        (item): item is OrderProgressUpdate =>
          (!!currentStatus && item.status === currentStatus) &&
          Array.isArray(item.imageUrls) &&
          item.imageUrls.length > 0
      ) || null;
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="device-shell">
          <PageHeader
            eyebrow="ORDERS"
            title="订单中心"
          />

          <IonSegment
            className="capsule-segment"
            value={view}
            onIonChange={(event) => setView(event.detail.value as 'local' | 'search')}
          >
            <IonSegmentButton value="local">
              <IonLabel>我的订单</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="search">
              <IonLabel>查订单</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {view === 'local' ? (
            <section style={{ marginTop: '16px' }} className="stack-section">
              <div className="chip-scroll">
                {FILTERS.map((item) => (
                  <IonChip
                    className="choice-chip"
                    color={filter === item.value ? 'primary' : undefined}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </IonChip>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={receiptOutline}
                  message="当前设备还没有符合筛选条件的订单。"
                  title="订单还空着"
                />
              ) : (
                <div className="stack-section compact-order-list">
                  {filteredOrders.map((order) => {
                    const progressWithImages = getProgressWithImages(order);

                    return (
                    <IonCard
                      button
                      className="surface-card compact-order-card compact-order-card--clickable"
                      key={order.id}
                      onClick={() => history.push(`/app/orders/${order.id}`)}
                    >
                      <IonCardContent className="compact-order-card__content">
                        <div className="compact-order-card__meta-row">
                          <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                          <span>订单号 {order.id}</span>
                        </div>
                        <div className="compact-order-card__focus">
                          <div
                            className={`compact-order-card__status-action${progressWithImages ? ' is-linkable' : ''}`}
                            onClick={(event) => {
                              if (!progressWithImages) return;
                              event.stopPropagation();
                              history.push(`/app/orders/${order.id}/progress/${progressWithImages.id}`);
                            }}
                            role={progressWithImages ? 'button' : undefined}
                            tabIndex={progressWithImages ? 0 : undefined}
                            onKeyDown={(event) => {
                              if (!progressWithImages) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                history.push(`/app/orders/${order.id}/progress/${progressWithImages.id}`);
                              }
                            }}
                          >
                            <div className={`status-chip status-chip--${order.status} compact-order-card__status-chip`}>
                              <span>{ORDER_STATUS_LABELS[order.status]}</span>
                              {progressWithImages ? <strong>查看图片</strong> : null}
                            </div>
                          </div>
                          <h3>{order.shoeData.brand} {order.shoeData.model}</h3>
                          <strong>¥{order.totalPrice}</strong>
                        </div>
                        <div className="compact-order-card__summary">
                          <div>
                            <span>{order.selectedServicePlan?.shopName || '系统分配门店'}</span>
                            <strong>{order.selectedServicePlan?.title || '未选择方案'}</strong>
                          </div>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  )})}
                </div>
              )}
            </section>
          ) : (
            <section style={{ marginTop: '16px' }} className="stack-section">
              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <IonItem className="field-item">
                    <IonLabel position="stacked">订单号</IonLabel>
                    <IonInput
                      value={searchId}
                      placeholder="输入订单号查询"
                      onIonInput={(event) => setSearchId(event.detail.value || '')}
                    />
                  </IonItem>
                  <LoadingButton expand="block" loading={searchLoading} onClick={handleSearch} shape="round">
                    <IonIcon icon={searchOutline} slot="start" />
                    查询服务器订单
                  </LoadingButton>
                  {searchError ? (
                    <IonText color="danger">
                      <p className="form-message">{searchError}</p>
                    </IonText>
                  ) : null}
                </IonCardContent>
              </IonCard>

              {serverOrder ? (
                <IonCard
                  button
                  className="surface-card compact-order-card compact-order-card--server compact-order-card--clickable"
                  onClick={() => history.push(`/app/orders/${serverOrder.id}`)}
                >
                  <IonCardContent className="compact-order-card__content">
                    <div className="compact-order-card__meta-row">
                      <span>SERVER ORDER</span>
                      <span>订单号 {serverOrder.id}</span>
                    </div>
                    <div className="compact-order-card__focus">
                      <div
                        className={`compact-order-card__status-action${getProgressWithImages(serverOrder) ? ' is-linkable' : ''}`}
                        onClick={(event) => {
                          const progressWithImages = getProgressWithImages(serverOrder);
                          if (!progressWithImages) return;
                          event.stopPropagation();
                          history.push(`/app/orders/${serverOrder.id}/progress/${progressWithImages.id}`);
                        }}
                        role={getProgressWithImages(serverOrder) ? 'button' : undefined}
                        tabIndex={getProgressWithImages(serverOrder) ? 0 : undefined}
                        onKeyDown={(event) => {
                          const progressWithImages = getProgressWithImages(serverOrder);
                          if (!progressWithImages) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            history.push(`/app/orders/${serverOrder.id}/progress/${progressWithImages.id}`);
                          }
                        }}
                      >
                        <div className={`status-chip status-chip--${normalizeOrderStatus(serverOrder.status)} compact-order-card__status-chip`}>
                          <span>{ORDER_STATUS_LABELS[normalizeOrderStatus(serverOrder.status)]}</span>
                          {getProgressWithImages(serverOrder) ? <strong>查看图片</strong> : null}
                        </div>
                      </div>
                      <h3>
                        {(serverOrder.analysisResult || serverOrder.shoeData)?.brand} {(serverOrder.analysisResult || serverOrder.shoeData)?.model}
                      </h3>
                      <strong>¥{serverOrder.price || serverOrder.totalPrice}</strong>
                    </div>
                    <div className="compact-order-card__summary">
                      <div>
                        <span>{serverOrder.selectedServicePlan?.shopName || '系统分配门店'}</span>
                        <strong>{serverOrder.selectedServicePlan?.title || '未选择方案'}</strong>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              ) : null}
            </section>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

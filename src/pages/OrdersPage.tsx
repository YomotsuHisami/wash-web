import {
  IonButton,
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
import { fetchOrderById } from '../api/orders';
import EmptyState from '../components/common/EmptyState';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import {
  Order,
  OrderStatus,
  ServerOrder,
  normalizeOrderStatus,
} from '../models/domain';
import { getOrders } from '../utils/storage';

const FILTERS: Array<{ label: string; value: 'all' | OrderStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending_payment' },
  { label: '已支付', value: 'paid' },
  { label: '洗护中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];

export default function OrdersPage() {
  const [view, setView] = useState<'local' | 'search'>('local');
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [searchId, setSearchId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [serverOrder, setServerOrder] = useState<ServerOrder | null>(null);

  useIonViewWillEnter(() => {
    const nextOrders = [...getOrders()]
      .map((order) => ({ ...order, status: normalizeOrderStatus(order.status) }))
      .sort((a, b) => b.createdAt - a.createdAt);
    setLocalOrders(nextOrders);
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

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="device-shell">
          <PageHeader
            eyebrow="ORDERS"
            title="订单中心"
            subtitle="本机订单和服务器查单都放在这里，查进度不用来回找页面。"
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
                <div className="stack-section">
                  {filteredOrders.map((order) => (
                    <IonCard className="surface-card" key={order.id}>
                      <IonCardContent className="stack-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <p className="page-eyebrow" style={{ marginBottom: 6 }}>
                              {new Date(order.createdAt).toLocaleString('zh-CN')}
                            </p>
                            <h3 style={{ margin: 0 }}>{order.shoeData.brand} {order.shoeData.model}</h3>
                            <p className="muted">订单号 {order.id}</p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="preview-grid">
                          <div>
                            <strong>取件信息</strong>
                            <p className="muted" style={{ marginTop: 6 }}>
                              {order.customerInfo.name} · {order.customerInfo.phone}
                              <br />
                              {order.customerInfo.address}
                            </p>
                          </div>
                          <div>
                            <strong>金额</strong>
                            <p className="muted" style={{ marginTop: 6 }}>
                              ¥{order.totalPrice} · {order.customerInfo.preferredShop || '未指定店铺'}
                            </p>
                          </div>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  ))}
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
                <IonCard className="surface-card">
                  <IonCardContent className="stack-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <p className="page-eyebrow" style={{ marginBottom: 6 }}>
                          SERVER ORDER
                        </p>
                        <h3 style={{ margin: 0 }}>
                          {(serverOrder.analysisResult || serverOrder.shoeData)?.brand} {(serverOrder.analysisResult || serverOrder.shoeData)?.model}
                        </h3>
                        <p className="muted">订单号 {serverOrder.id}</p>
                      </div>
                      <StatusBadge status={normalizeOrderStatus(serverOrder.status)} />
                    </div>
                    {serverOrder.imageUrl ? (
                      <div className="preview-frame">
                        <img alt="订单鞋图" src={serverOrder.imageUrl} />
                      </div>
                    ) : null}
                    <p className="muted">
                      {serverOrder.userName || serverOrder.customerInfo?.name} · {serverOrder.userPhone || serverOrder.customerInfo?.phone}
                      <br />
                      {serverOrder.userAddress || serverOrder.customerInfo?.address}
                    </p>
                    <strong>¥{serverOrder.price || serverOrder.totalPrice}</strong>
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

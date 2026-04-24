import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { arrowBackOutline, chevronForwardOutline, createOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchShops } from '../api/catalog';
import { fetchUserProfile, updateOrderInfos } from '../api/users';
import OrderInfoManager from '../components/account/OrderInfoManager';
import {
  SavedOrderInfo,
  Shop,
  UserProfile,
} from '../models/domain';
import {
  clearOrderResultSnapshot,
  getOrderResultSnapshot,
  OrderResultSnapshot,
  saveOrderResultSnapshot,
} from '../utils/orderResultSession';
import {
  getDefaultOrderInfo,
  getOrderInfos,
  getSelectedOrderInfo,
  hasRequiredOrderInfo,
  isRepriceSensitiveOrderInfoChange,
  migrateUserProfileOrderInfos,
  summarizeOrderInfo,
  toCustomerInfo,
} from '../utils/orderInfoUtils';
import { getStoredUser, setStoredUser } from '../utils/storage';

export default function OrderInfoPage() {
  const history = useHistory();
  const [snapshot, setSnapshot] = useState<OrderResultSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedOrderInfoId, setSelectedOrderInfoId] = useState('');
  const [formData, setFormData] = useState(toCustomerInfo());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const nextSnapshot = getOrderResultSnapshot();
        if (!nextSnapshot) {
          history.replace('/app/order');
          return;
        }

        const storedUser = getStoredUser();
        let profile: UserProfile | null = null;
        let nextShops: Shop[] = [];

        if (storedUser?.id) {
          const [p, shops] = await Promise.all([
            fetchUserProfile(storedUser.id).then(migrateUserProfileOrderInfos),
            fetchShops(),
          ]);
          profile = p;
          nextShops = shops;
        } else {
          nextShops = await fetchShops();
        }

        if (!mounted) return;

        const selectedOrderInfo = profile
          ? getSelectedOrderInfo(profile, nextSnapshot.selectedOrderInfoId) ||
            getDefaultOrderInfo(profile)
          : null;

        setSnapshot(nextSnapshot);
        setCurrentUser(profile);
        setShops(nextShops);
        setSelectedOrderInfoId(selectedOrderInfo?.id || '');
        setFormData(toCustomerInfo(selectedOrderInfo || nextSnapshot.formData));
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '订单信息加载失败。');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [history]);

  const currentOrderInfos = getOrderInfos(currentUser);
  const selectedOrderInfo = getSelectedOrderInfo(currentUser, selectedOrderInfoId);
  const baselineInfo = snapshot?.pricingBaselineInfo || snapshot?.formData || null;
  const needsReprice = isRepriceSensitiveOrderInfoChange(baselineInfo, formData);

  const syncSnapshot = (nextFormData: typeof formData, nextSelectedOrderInfoId: string) => {
    if (!snapshot) return;
    const nextSnapshot: OrderResultSnapshot = {
      ...snapshot,
      formData: nextFormData,
      selectedOrderInfoId: nextSelectedOrderInfoId,
      orderInfos: getOrderInfos(currentUser),
    };
    setSnapshot(nextSnapshot);
    saveOrderResultSnapshot(nextSnapshot);
  };

  const handleOrderInfosChange = async (
    nextOrderInfos: SavedOrderInfo[],
    nextDefaultInfoId?: string | null,
    nextSelectedOrderInfoId?: string | null
  ) => {
    if (!currentUser) return;

    setSaving(true);
    setError('');

    try {
      const profile = await updateOrderInfos(currentUser.id, {
        orderInfos: nextOrderInfos,
        defaultInfoId: nextDefaultInfoId || nextOrderInfos[0]?.id || '',
      }).then(migrateUserProfileOrderInfos);

      setCurrentUser(profile);
      setStoredUser(profile);

      const nextSelected =
        getSelectedOrderInfo(profile, nextSelectedOrderInfoId || nextDefaultInfoId) ||
        getDefaultOrderInfo(profile);

      const nextFormData = toCustomerInfo(nextSelected);
      setSelectedOrderInfoId(nextSelected?.id || '');
      setFormData(nextFormData);
      syncSnapshot(nextFormData, nextSelected?.id || '');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '订单资料保存失败。');
    } finally {
      setSaving(false);
    }
  };

  const handleOrderInfoSave = async ({
    orderInfo,
    mode,
    setAsDefault,
  }: {
    orderInfo: SavedOrderInfo;
    mode: 'create' | 'edit';
    setAsDefault: boolean;
  }) => {
    const nextOrderInfos =
      mode === 'create'
        ? [...currentOrderInfos, orderInfo]
        : currentOrderInfos.map((item) => (item.id === orderInfo.id ? orderInfo : item));
    const nextDefaultInfoId =
      setAsDefault || !currentUser?.defaultInfoId ? orderInfo.id : currentUser?.defaultInfoId;
    await handleOrderInfosChange(nextOrderInfos, nextDefaultInfoId, orderInfo.id);
  };

  const handleSetDefaultOrderInfo = async (id: string) => {
    await handleOrderInfosChange(currentOrderInfos, id, id);
  };

  const handleSelectOrderInfo = (id: string) => {
    setSelectedOrderInfoId(id);
    const nextSelected = getSelectedOrderInfo(currentUser, id);
    const nextFormData = toCustomerInfo(nextSelected);
    setFormData(nextFormData);
    syncSnapshot(nextFormData, id);
  };

  const handleBackToResult = () => {
    if (snapshot) saveOrderResultSnapshot(snapshot);
    history.push('/app/order/result');
  };

  const handleProceed = () => {
    if (!snapshot) return;

    if (!hasRequiredOrderInfo(formData)) {
      setError('请先补齐姓名、电话和地址。');
      return;
    }

    const nextSnapshot: OrderResultSnapshot = {
      ...snapshot,
      formData,
      selectedOrderInfoId,
      orderInfos: currentOrderInfos,
    };

    saveOrderResultSnapshot(nextSnapshot);

    if (needsReprice) {
      history.push('/app/order?resume=report');
      return;
    }

    history.push('/app/order?resume=payment');
  };

  if (loading || !snapshot) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="device-shell result-loading">
            <IonSpinner name="crescent" />
            <p className="muted">正在加载订单信息...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="order-result-page">
      <IonContent fullscreen>
        <div className="device-shell device-shell--result payment-step-shell">
          <section className="result-top-inline">
            <IonButton fill="clear" size="small" onClick={handleBackToResult}>
              <IonIcon icon={arrowBackOutline} slot="start" />
              返回方案页
            </IonButton>
          </section>

          <IonCard className="surface-card payment-panel payment-panel--order">
            <IonCardContent className="stack-section">
              <div className="payment-panel__head">
                <div>
                  <div className="soft-badge">
                    <IonIcon icon={createOutline} />
                    订单信息
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    这里单独负责切换、新增和编辑订单资料。改动地址后，需要重新生成推荐方案。
                  </p>
                </div>
              </div>
              <OrderInfoManager
                defaultInfoId={currentUser?.defaultInfoId}
                onSave={handleOrderInfoSave}
                onSelect={handleSelectOrderInfo}
                onSetDefault={handleSetDefaultOrderInfo}
                orderInfos={currentOrderInfos}
                saveButtonLabel="保存并应用"
                saving={saving}
                selectedOrderInfoId={selectedOrderInfoId}
                subtitle="当前订单会使用这里选中的资料。"
                title="订单资料"
              />
              <div className="payment-order-summary">
                <div>
                  <span>当前资料</span>
                  <strong>{summarizeOrderInfo(formData) || '请选择订单资料'}</strong>
                </div>
                <div>
                  <span>当前方案</span>
                  <strong>
                    {snapshot.recommendations.find((item) => item.id === snapshot.selectedPlanId)?.title || '--'}
                  </strong>
                </div>
              </div>
              {needsReprice ? (
                <div className="payment-warning">
                  <strong>订单信息已变化</strong>
                  <p>当前资料会影响距离或服务范围，请先返回结果页重新生成推荐方案。</p>
                </div>
              ) : null}
              {error ? <p className="form-message">{error}</p> : null}
            </IonCardContent>
          </IonCard>

          <div className="payment-action-dock">
            <div className="payment-action-dock__inner">
              <div className="payment-action-dock__price">
                <strong>{selectedOrderInfo?.label || '订单资料'}</strong>
                <span>{needsReprice ? '需先回结果页重算' : '继续进入支付选择'}</span>
              </div>
              <IonButton shape="round" onClick={handleProceed}>
                {needsReprice ? '返回结果页重算' : '去支付'}
                <IonIcon icon={chevronForwardOutline} slot="end" />
              </IonButton>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { createServerOrder, markOrderPaid } from '../api/orders';
import { fetchUserProfile } from '../api/users';
import LoadingButton from '../components/common/LoadingButton';
import PriceSummaryCard from '../components/common/PriceSummaryCard';
import { Order, ServerOrder, UserProfile } from '../models/domain';
import {
  buildOrderResultViewModel,
  clearOrderResultSnapshot,
  getOrderResultSnapshot,
  OrderResultSnapshot,
  saveOrderResultSnapshot,
} from '../utils/orderResultSession';
import {
  getSelectedOrderInfo,
  hasRequiredOrderInfo,
  migrateUserProfileOrderInfos,
  toCustomerInfo,
} from '../utils/orderInfoUtils';
import {
  generateOrderId,
  getStoredUser,
  markOrderedOnce,
  saveOrder,
} from '../utils/storage';

export default function OrderPayPage() {
  const history = useHistory();
  const [snapshot, setSnapshot] = useState<OrderResultSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
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
        if (!storedUser?.id) {
          history.replace('/app/account');
          return;
        }

        const profile = await fetchUserProfile(storedUser.id).then(migrateUserProfileOrderInfos);
        if (!mounted) return;

        setSnapshot(nextSnapshot);
        setCurrentUser(profile);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '支付信息加载失败。');
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

  const viewModel = useMemo(
    () => (snapshot ? buildOrderResultViewModel(snapshot) : null),
    [snapshot]
  );
  const selectedPlan = viewModel?.selectedPlan || null;
  const selectedOrderInfo = getSelectedOrderInfo(currentUser, snapshot?.selectedOrderInfoId);
  const paymentMethod = snapshot?.selectedPaymentMethod || 'alipay';

  const handleBack = () => {
    if (snapshot) saveOrderResultSnapshot(snapshot);
    history.push('/app/order?resume=payment');
  };

  const handleConfirmPaid = async () => {
    if (!snapshot || !currentUser || !selectedPlan || !viewModel) return;

    const lockedOrderInfo = toCustomerInfo(selectedOrderInfo || snapshot.formData);
    if (!hasRequiredOrderInfo(lockedOrderInfo)) {
      setError('订单信息不完整，请先返回订单信息页补全。');
      return;
    }

    setPaying(true);
    setError('');

    const id = generateOrderId();
    const order: Order = {
      id,
      createdAt: Date.now(),
      status: 'paid',
      shoeData: snapshot.confirmedShoeData,
      customerInfo: lockedOrderInfo,
      selectedServicePlan: selectedPlan,
      alternativePlans: snapshot.recommendations.filter((plan) => plan.id !== selectedPlan.id),
      totalPrice: viewModel.finalPrice,
    };

    const serverOrder: ServerOrder = {
      ...order,
      status: 'pending_payment',
      userName: lockedOrderInfo.name,
      userPhone: lockedOrderInfo.phone,
      userAddress: lockedOrderInfo.address,
      preferredShop: lockedOrderInfo.preferredShop,
      pickupTime: lockedOrderInfo.pickupTime,
      notes: lockedOrderInfo.notes,
      servicePreference: lockedOrderInfo.servicePreference,
      price: viewModel.finalPrice,
      analysisResult: snapshot.confirmedShoeData,
      imageUrl: snapshot.capturedImages[0] || undefined,
      imageUrls: snapshot.capturedImages,
      pricingBreakdown: {
        baseFee: viewModel.baseFee,
        damageTotal: viewModel.damageTotal,
        serviceFee: viewModel.serviceFee,
        addonTotal: viewModel.addonTotal,
        subtotal: viewModel.subtotal,
        discountAmount: viewModel.discountAmount,
        selectedPlanId: selectedPlan.id,
        selectedPlanTitle: selectedPlan.title,
        discountId: snapshot.selectedDiscountId || undefined,
        discountTitle: viewModel.selectedDiscount?.title,
        discountRate: viewModel.selectedDiscount?.rate,
        total: viewModel.finalPrice,
      },
    };

    try {
      saveOrder(order);
      await createServerOrder(serverOrder);
      await markOrderPaid(id);
      markOrderedOnce(currentUser.id);
      clearOrderResultSnapshot();
      history.replace('/app/orders');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '支付确认失败，请稍后再试。');
    } finally {
      setPaying(false);
    }
  };

  if (loading || !snapshot || !viewModel || !selectedPlan) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="device-shell result-loading">
            <IonSpinner name="crescent" />
            <p className="muted">正在加载扫码支付...</p>
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
            <IonButton fill="clear" size="small" onClick={handleBack}>
              <IonIcon icon={arrowBackOutline} slot="start" />
              返回支付选择
            </IonButton>
          </section>

          <IonCard className="surface-card payment-panel payment-panel--method">
            <IonCardContent className="stack-section">
              <div className="payment-panel__head">
                <div>
                  <div className="soft-badge">
                    <IonIcon icon={checkmarkCircleOutline} />
                    扫码支付
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    当前支付方式：{paymentMethod === 'alipay' ? '支付宝' : '微信支付'}。本轮仍统一使用扫码承载。
                  </p>
                </div>
              </div>
              <PriceSummaryCard
                addonTotal={viewModel.addonTotal}
                baseFee={viewModel.baseFee}
                damageTotal={viewModel.damageTotal}
                discountAmount={viewModel.discountAmount}
                selectedDiscount={viewModel.selectedDiscount}
                serviceFee={viewModel.serviceFee}
                total={viewModel.finalPrice}
                totalLabel="当前应付"
              />
              <div className="payment-qr-panel">
                <div className="payment-qr-panel__copy">
                  <strong>{selectedPlan.title}</strong>
                  <p>
                    {lockedOrderInfoText(selectedOrderInfo || snapshot.formData)} · {selectedPlan.shopName}
                  </p>
                </div>
                <div className="preview-frame payment-qr-frame">
                  <img alt="订单支付二维码" src="/qr.jpg" />
                </div>
              </div>
              {error ? <p className="form-message">{error}</p> : null}
            </IonCardContent>
          </IonCard>

          <div className="payment-action-dock">
            <div className="payment-action-dock__inner">
              <div className="payment-action-dock__price">
                <strong>¥{viewModel.finalPrice}</strong>
                <span>{selectedPlan.title}</span>
              </div>
              <LoadingButton loading={paying} onClick={handleConfirmPaid} shape="round">
                我已完成支付
              </LoadingButton>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

function lockedOrderInfoText(info: Partial<OrderResultSnapshot['formData']> | undefined) {
  return [info?.name, info?.phone, info?.address].filter(Boolean).join(' · ');
}

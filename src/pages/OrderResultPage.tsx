import { IonButton, IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/react';
import {
  arrowBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import PriceSummaryCard from '../components/common/PriceSummaryCard';
import {
  buildOrderResultViewModel,
  getOrderResultSnapshot,
  OrderResultSnapshot,
  saveOrderResultSnapshot,
} from '../utils/orderResultSession';

export default function OrderResultPage() {
  const history = useHistory();
  const detailSectionRef = useRef<HTMLDivElement | null>(null);
  const planSectionRef = useRef<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<OrderResultSnapshot | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  useEffect(() => {
    const nextSnapshot = getOrderResultSnapshot();
    if (!nextSnapshot) {
      history.replace('/app/order');
      return;
    }

    setSnapshot(nextSnapshot);
    setSelectedPlanId(nextSnapshot.selectedPlanId);
  }, [history]);

  const resolvedSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return {
      ...snapshot,
      selectedPlanId,
    } satisfies OrderResultSnapshot;
  }, [selectedPlanId, snapshot]);

  const viewModel = useMemo(
    () => (resolvedSnapshot ? buildOrderResultViewModel(resolvedSnapshot) : null),
    [resolvedSnapshot]
  );

  useEffect(() => {
    if (!resolvedSnapshot) return;
    saveOrderResultSnapshot(resolvedSnapshot);
  }, [resolvedSnapshot]);

  const revealSection = (section: 'details' | 'plans') => {
    if (section === 'details') {
      setShowDetails((prev) => {
        const next = !prev;
        if (next) {
          window.setTimeout(() => {
            detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
        return next;
      });
      return;
    }

    setShowPlanPicker((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          planSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
      return next;
    });
  };

  const handleReturnToReport = () => {
    if (resolvedSnapshot) {
      saveOrderResultSnapshot(resolvedSnapshot);
    }
    history.push('/app/order?resume=report');
  };

  const handleProceedToPayment = () => {
    if (resolvedSnapshot) {
      saveOrderResultSnapshot(resolvedSnapshot);
    }
    history.push('/app/order/info');
  };

  if (!resolvedSnapshot || !viewModel || !viewModel.selectedPlan) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="device-shell device-shell--result result-loading">
            <IonSpinner name="crescent" />
            <p className="muted">正在加载推荐结果...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="order-result-page">
      <IonContent className="order-result-content" fullscreen>
        <div className="device-shell device-shell--result">
          <section className="result-top-inline">
            <IonButton fill="clear" size="small" onClick={handleReturnToReport}>
              <IonIcon icon={arrowBackOutline} slot="start" />
              返回识别结果
            </IonButton>
          </section>

          <section className="result-panel result-panel--summary">
            <div className="result-summary-top">
              <div className="result-status-badge">最推荐方案</div>
              <strong className="result-price">预估 ¥{viewModel.finalPrice}</strong>
            </div>
            <h2 className="result-plan-title">{viewModel.selectedPlan.title}</h2>

            <div className="result-embedded-card result-embedded-card--tight">
              <div className="result-section-head">
                <h3>推荐依据</h3>
              </div>
              <div className="result-metric-grid result-metric-grid--embedded">
                {viewModel.embeddedMetrics.map((item) => (
                  <div className="result-metric result-metric--compact" key={item.label}>
                    <span className="result-metric__label">{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="result-panel">
            <div className="result-section-head">
              <h3>服务内容</h3>
            </div>
            <div className="result-token-row result-token-row--service">
              {viewModel.serviceItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section className="result-panel result-panel--disclosure" ref={detailSectionRef}>
            <button
              className="result-inline-toggle"
              onClick={() => revealSection('details')}
              type="button"
            >
              <span>查看识别明细</span>
              <IonIcon icon={showDetails ? chevronUpOutline : chevronDownOutline} />
            </button>
            {showDetails ? (
              <div className="result-disclosure-body">
                <div className="result-detail-list">
                  <div className="result-detail-row">
                    <span>鞋型</span>
                    <strong>{resolvedSnapshot.confirmedShoeData.shoeType}</strong>
                  </div>
                  <div className="result-detail-row">
                    <span>品牌 / 型号</span>
                    <strong>
                      {resolvedSnapshot.confirmedShoeData.brand} /{' '}
                      {resolvedSnapshot.confirmedShoeData.model}
                    </strong>
                  </div>
                  <div className="result-detail-row">
                    <span>焕新指数</span>
                    <strong>{resolvedSnapshot.confirmedShoeData.renewalScore} / 100</strong>
                  </div>
                  <div className="result-detail-row">
                    <span>处理建议</span>
                    <strong>{resolvedSnapshot.confirmedShoeData.careTip}</strong>
                  </div>
                </div>
                <div className="result-token-row result-token-row--chips">
                  {resolvedSnapshot.confirmedShoeData.materials.map((item) => (
                    <span key={`${item.part}-${item.material}`}>
                      {item.part} · {item.material}
                    </span>
                  ))}
                </div>
                <div className="result-note-list">
                  {resolvedSnapshot.confirmedShoeData.damages.map((damage) => (
                    <div className="result-note-item" key={damage.id}>
                      <span className="result-note-item__dot" />
                      <p>
                        {damage.type} · {damage.severity} · +¥{damage.surcharge}
                        {damage.note ? ` · ${damage.note}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
                <PriceSummaryCard
                  addonTotal={viewModel.addonTotal}
                  baseFee={viewModel.baseFee}
                  damageTotal={viewModel.damageTotal}
                  discountAmount={viewModel.discountAmount}
                  selectedDiscount={viewModel.autoAppliedDiscount}
                  serviceFee={viewModel.serviceFee}
                  total={viewModel.finalPrice}
                  totalLabel="预估金额"
                />
              </div>
            ) : null}
          </section>

          <section className="result-panel result-panel--disclosure" ref={planSectionRef}>
            <button
              className="result-inline-toggle"
              onClick={() => revealSection('plans')}
              type="button"
            >
              <span>更换方案</span>
              <IonIcon icon={showPlanPicker ? chevronUpOutline : chevronDownOutline} />
            </button>
            {showPlanPicker ? (
              <div className="result-disclosure-body">
                <div className="result-plan-list">
                  {resolvedSnapshot.recommendations.map((plan) => (
                    <button
                      className={`result-plan-option${
                        plan.id === viewModel.selectedPlan?.id ? ' is-active' : ''
                      }`}
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setShowPlanPicker(false);
                      }}
                      type="button"
                    >
                      <div className="result-plan-option__copy">
                        <strong>{plan.title}</strong>
                        <span>{plan.shopName}</span>
                        <p>
                          匹配度 {plan.matchScore} / 100 · {plan.distanceKm} km ·{' '}
                          {plan.estimatedTurnaround}
                        </p>
                      </div>
                      <div className="result-plan-option__side">
                        <strong>¥{plan.prepayPrice}</strong>
                        <span>{plan.id === viewModel.selectedPlan?.id ? '当前方案' : '切换'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </IonContent>

      <div className="result-action-dock">
        <div className="result-action-dock__inner">
          <div className="result-footer__primary result-footer__primary--compact">
            <div className="result-footer__price">
              <strong>预估 ¥{viewModel.finalPrice}</strong>
              <span>{viewModel.lockedOrderInfoSummary}</span>
            </div>
            <IonButton shape="round" onClick={handleProceedToPayment}>
              确认订单信息
              <IonIcon icon={chevronForwardOutline} slot="end" />
            </IonButton>
          </div>
        </div>
      </div>
    </IonPage>
  );
}

import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonText,
} from '@ionic/react';
import { arrowBackOutline, shieldCheckmarkOutline, starOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchDiscounts } from '../api/catalog';
import { upgradeMembership } from '../api/users';
import AppLoadingOverlay from '../components/common/AppLoadingOverlay';
import CompactPromoTile from '../components/common/CompactPromoTile';
import FeaturePromoCard from '../components/common/FeaturePromoCard';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import { brandConfig, membershipPrice } from '../config/brand';
import { campaignAssets, resolveDiscountImage } from '../config/campaigns';
import { Discount, UserProfile, isDiscountActive } from '../models/domain';
import { getStoredUser, setStoredUser } from '../utils/storage';

export default function MembershipPage() {
  const history = useHistory();
  const [step, setStep] = useState<'intro' | 'payment' | 'success'>('intro');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const nextDiscounts = await fetchDiscounts();
        if (mounted) {
          setDiscounts(nextDiscounts.filter(isDiscountActive));
          setCurrentUser(getStoredUser());
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
  }, []);

  const vipPromo =
    discounts.find((discount) => discount.applicableGroup === 'vip') || null;

  const handleStart = () => {
    if (!currentUser) {
      setMessage('请先在“我的”里登录账户，再购买会员。');
      return;
    }
    if (currentUser.group === 'vip') {
      setMessage('你已经是会员了，可以直接去下单使用会员优惠。');
      return;
    }
    setMessage('');
    setStep('payment');
  };

  const handleUpgrade = async () => {
    if (!currentUser) return;

    setUpgrading(true);
    setMessage('');

    try {
      const updated = await upgradeMembership(currentUser.id);
      setStoredUser(updated);
      setCurrentUser(updated);
      setStep('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '升级失败，请稍后再试。');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <AppLoadingOverlay isOpen={loading} message="正在加载会员信息..." />
        <div className="device-shell">
          <PageHeader
            eyebrow="MEMBERSHIP"
            title={brandConfig.membershipName}
            subtitle={brandConfig.membershipTagline}
            onBack={() => history.goBack()}
          />

          {step === 'intro' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    一次开通，长期可用
                  </div>
                  <h2 style={{ margin: 0 }}>会员价 ¥{membershipPrice}</h2>
                  <p>开通后下单会优先匹配会员折扣，后续活动也会一起归到会员身份里。</p>
                  <div className="info-list">
                    {brandConfig.serviceHighlights.map((item) => (
                      <div className="feature-item" key={item}>
                        <strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                  {message ? (
                    <IonText color="danger">
                      <p className="form-message">{message}</p>
                    </IonText>
                  ) : null}
                  <LoadingButton expand="block" loading={false} onClick={handleStart} shape="round">
                    立即购买会员
                  </LoadingButton>
                </IonCardContent>
              </IonCard>

              <FeaturePromoCard
                badge={vipPromo ? '会员权益' : '会员说明'}
                body={
                  vipPromo
                    ? `${vipPromo.description || '开通后下单可直接使用会员折扣。'} 支付完成后，会员身份会立刻生效。`
                    : '开通会员后，下单页会优先匹配会员折扣，后续活动也会更集中地展示在你的账户里。'
                }
                ctaLabel={currentUser?.group === 'vip' ? '回到下单' : '立即开通'}
                eyebrow="MEMBER BENEFITS"
                imageUrl={resolveDiscountImage(vipPromo, campaignAssets.membership)}
                onClick={() => (currentUser?.group === 'vip' ? history.replace('/app/order') : handleStart())}
                title={vipPromo?.title || `${brandConfig.membershipName} 已准备好`}
              />
              <CompactPromoTile
                badge="服务说明"
                body="会员身份会写入当前账户，后续登录同一账号时，会员权益会继续保留。"
                imageUrl={campaignAssets.assurance}
                meta="支付完成后即时生效"
                title="权益与订单状态同步保留"
              />
            </section>
          ) : null}

          {step === 'payment' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={starOutline} />
                    会员支付
                  </div>
                  <h2 style={{ margin: 0 }}>扫码完成会员支付</h2>
                  <p>确认付款后，会员身份会立即写入当前账户，回到下单页就能直接使用。</p>
                  <div className="preview-frame" style={{ aspectRatio: '1 / 1' }}>
                    <img alt="会员支付二维码" src="/qr.jpg" />
                  </div>
                  <strong style={{ fontSize: '1.8rem' }}>¥{membershipPrice}</strong>
                  {message ? (
                    <IonText color="danger">
                      <p className="form-message">{message}</p>
                    </IonText>
                  ) : null}
                  <div className="inline-actions">
                    <IonButton fill="outline" shape="round" onClick={() => setStep('intro')}>
                      <IonIcon icon={arrowBackOutline} slot="start" />
                      返回
                    </IonButton>
                    <LoadingButton loading={upgrading} onClick={handleUpgrade} shape="round">
                      我已完成支付
                    </LoadingButton>
                  </div>
                </IonCardContent>
              </IonCard>
            </section>
          ) : null}

          {step === 'success' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    开通成功
                  </div>
                  <h2 style={{ margin: 0 }}>会员已生效</h2>
                  <p>接下来下单时，系统会优先显示你当前可用的会员优惠和会员活动。</p>
                  <div className="inline-actions">
                    <IonButton shape="round" onClick={() => history.replace('/app/account')}>
                      回到我的
                    </IonButton>
                    <IonButton fill="outline" shape="round" onClick={() => history.replace('/app/order')}>
                      去下单
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            </section>
          ) : null}
        </div>
      </IonContent>
    </IonPage>
  );
}

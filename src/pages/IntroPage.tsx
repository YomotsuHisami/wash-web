import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/react';
import { arrowForwardOutline, sparklesOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchDiscounts } from '../api/catalog';
import BrandMark from '../components/common/BrandMark';
import CardSkeleton from '../components/common/CardSkeleton';
import CompactPromoTile from '../components/common/CompactPromoTile';
import FeaturePromoCard from '../components/common/FeaturePromoCard';
import LoadingButton from '../components/common/LoadingButton';
import { brandConfig } from '../config/brand';
import { campaignAssets, resolveDiscountImage } from '../config/campaigns';
import { Discount, isDiscountActive } from '../models/domain';
import { setIntroSeen } from '../utils/storage';

export default function IntroPage() {
  const history = useHistory();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const nextDiscounts = await fetchDiscounts();
        if (mounted) {
          setDiscounts(nextDiscounts.filter(isDiscountActive));
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

  const handleEnter = async () => {
    setEntering(true);
    setIntroSeen();
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    history.replace('/app/home');
  };

  const featuredDiscount = discounts[0] || null;

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="device-shell">
          <section className="hero-card surface-card">
            <div className="soft-badge">
              <IonIcon icon={sparklesOutline} />
              新客可先看活动再决定
            </div>
            <BrandMark size={58} withWordmark subtitle="SNEAKER CARE STUDIO" />
            <h1>{brandConfig.introTitle}</h1>
            <p>{brandConfig.introBody}</p>

            <div className="feature-list">
              {brandConfig.introFeatures.map((feature) => (
                <div className="feature-item" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              ))}
            </div>

            <div className="hero-actions">
              <LoadingButton expand="block" loading={entering} onClick={handleEnter} shape="round">
                进入应用
                <IonIcon icon={arrowForwardOutline} slot="end" />
              </LoadingButton>
            </div>
          </section>

          <section className="banner-frame" style={{ marginTop: '18px' }}>
            <img alt="服务保障" src={campaignAssets.assurance} />
            <div className="banner-copy">
              <div className="soft-badge">服务保障</div>
              <h2 style={{ marginBottom: 6 }}>先看价格拆分，再决定是否安排取件</h2>
              <p style={{ color: 'rgba(255, 253, 248, 0.84)' }}>
                鞋款识别、门店选择和订单进度都会沿着同一条路径往下走，手机上也更顺手。
              </p>
            </div>
          </section>

          <section style={{ marginTop: '18px' }} className="stack-section">
            <div className="page-header" style={{ marginBottom: 0 }}>
              <div className="page-header__meta">
                <p className="page-eyebrow">ACTIVE PROMOS</p>
                <h2 style={{ margin: 0 }}>当前活动</h2>
                <p className="page-subtitle">折扣会直接影响下单金额，先把能用的活动看清楚。</p>
              </div>
            </div>

            {loading ? (
              <CardSkeleton repeat={2} lines={3} />
            ) : discounts.length > 0 ? (
              <div className="stack-section">
                <FeaturePromoCard
                  badge="当前主推"
                  body={
                    featuredDiscount?.description ||
                    '先拍照估价，再决定是否下单，活动金额会在下单页直接抵扣。'
                  }
                  ctaLabel="进入首页"
                  eyebrow="TODAY"
                  imageUrl={resolveDiscountImage(featuredDiscount, campaignAssets.feature)}
                  onClick={handleEnter}
                  title={featuredDiscount?.title || '今天适合先看活动再下单'}
                />
                <div className="promo-grid">
                  {discounts.slice(1, 3).map((discount) => (
                    <CompactPromoTile
                      badge="可直接使用"
                      body={discount.description || '进入下单页后可直接选择。'}
                      imageUrl={resolveDiscountImage(discount, campaignAssets.membership)}
                      key={discount.id}
                      meta={discount.applicableGroup === 'vip' ? '会员专享' : '所有可用用户'}
                      title={discount.title}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <IonButton fill="clear" disabled>
                当前暂无活动，先进入首页拍照估价
              </IonButton>
            )}
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
}

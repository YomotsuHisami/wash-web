import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/react';
import { arrowForwardOutline, sparklesOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { motion } from 'framer-motion';
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
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero-card surface-card"
          >
            <div className="soft-badge">
              <IonIcon icon={sparklesOutline} />
              AI 视觉识别，专业洗护
            </div>
            <BrandMark size={58} withWordmark subtitle="SNEAKER CARE STUDIO" />
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {brandConfig.introTitle}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {brandConfig.introBody}
            </motion.p>

            <div className="feature-list">
              {brandConfig.introFeatures.map((feature, i) => (
                <motion.div 
                  className="feature-item" 
                  key={feature.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </motion.div>
              ))}
            </div>

            <motion.div 
              className="hero-actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <LoadingButton expand="block" loading={entering} onClick={handleEnter} shape="round">
                开始体验
                <IonIcon icon={arrowForwardOutline} slot="end" />
              </LoadingButton>
            </motion.div>
          </motion.section>

          <motion.section 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="banner-frame" 
            style={{ marginTop: '18px' }}
          >
            <img alt="服务保障" src={campaignAssets.assurance} />
            <div className="banner-copy">
              <div className="soft-badge">服务保障</div>
              <h2 style={{ marginBottom: 6 }}>透明价格，专业洗护</h2>
              <p style={{ color: 'rgba(255, 253, 248, 0.84)' }}>
                基于 AI 的视觉识别技术，为您提供最精准的鞋况分析与清洗建议。
              </p>
            </div>
          </motion.section>

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
                      imageUrl={resolveDiscountImage(discount, campaignAssets.assurance)}
                      key={discount.id}
                      meta="所有用户可用"
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

import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/react';
import {
  arrowForwardOutline,
  chevronForwardOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useIonViewWillEnter } from '@ionic/react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import BrandMark from '../components/common/BrandMark';
import CardSkeleton from '../components/common/CardSkeleton';
import StatusBadge from '../components/common/StatusBadge';
import { brandConfig } from '../config/brand';
import { campaignAssets, resolveDiscountImage } from '../config/campaigns';
import { Discount, Order, Shop, UserProfile, isDiscountActive } from '../models/domain';
import { getOrders, getStoredUser } from '../utils/storage';

export default function HomePage() {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const promoScrollerRef = useRef<HTMLDivElement | null>(null);

  const refreshLocal = () => {
    const localOrders = [...getOrders()].sort((a, b) => b.createdAt - a.createdAt);
    setLatestOrder(localOrders[0] || null);
    setCurrentUser(getStoredUser());
  };

  useIonViewWillEnter(() => {
    refreshLocal();
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [nextDiscounts, nextShops] = await Promise.all([
          fetchDiscounts(),
          fetchShops(),
        ]);

        if (mounted) {
          setDiscounts(nextDiscounts.filter(isDiscountActive));
          setShops(nextShops);
          refreshLocal();
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

  const promoSlides = useMemo(() => {
    const discountSlides = discounts.slice(0, 3).map((discount, index) => ({
      id: discount.id,
      title: discount.title,
      body:
        discount.description ||
        (index === 0
          ? '专业 AI 视觉识别，先拍照看鞋况，再决定是否下单。'
          : '进入下单页后即可直接选择优惠。'),
      imageUrl: resolveDiscountImage(
        discount,
        index === 0 ? campaignAssets.feature : campaignAssets.assurance
      ),
      route: '/app/order',
      cta: '立即体验',
    }));

    if (discountSlides.length >= 2) {
      return discountSlides;
    }

    return [
      ...discountSlides,
      {
        id: 'assurance-slide',
        title: '安心洗护保障',
        body: '全程透明洗护，每一双鞋都由专业技师手工精洗，确保洗护质量。',
        imageUrl: campaignAssets.assurance,
        route: '/app/home',
        cta: '了解详情',
      },
      {
        id: 'first-order-slide',
        title: 'AI 拍照估价',
        body: '仅需三张照片，系统即刻识别鞋型、材质及污损程度，预估清洗费用。',
        imageUrl: campaignAssets.feature,
        route: '/app/order',
        cta: '开始拍照',
      },
    ].slice(0, 3);
  }, [discounts]);

  useEffect(() => {
    setActivePromoIndex((prev) => Math.min(prev, Math.max(promoSlides.length - 1, 0)));
  }, [promoSlides.length]);

  const handlePromoScroll = () => {
    const scroller = promoScrollerRef.current;
    if (!scroller) return;
    const nextIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setActivePromoIndex(nextIndex);
  };

  const scrollToPromo = (index: number) => {
    const scroller = promoScrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      left: scroller.clientWidth * index,
      behavior: 'smooth',
    });
    setActivePromoIndex(index);
  };

  const heroTitleLines = ['拍照估价', '下单取件', '进度随时查看'];

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="home-screen">
          <section className="home-hero">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="home-hero__inner device-shell device-shell--home"
            >
              <div className="home-hero__topline">
                <BrandMark size={58} withWordmark subtitle="XI SONG" />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="home-hero__tagline"
                >
                  {brandConfig.tagline}
                </motion.div>
              </div>

              <section className="home-pass-card">
                <div className="home-pass-card__copy">
                  <h1 className="home-pass-title" aria-label={brandConfig.heroTitle}>
                    {heroTitleLines.map((line, i) => (
                      <motion.span 
                        key={line}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                      >
                        {line}
                      </motion.span>
                    ))}
                  </h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    {currentUser
                      ? `欢迎回来，${currentUser.username}。今天想为您的爱鞋做一次专业洗护吗？`
                      : brandConfig.heroBody}
                  </motion.p>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="hero-actions"
                  >
                    <IonButton
                      className="hero-actions__primary"
                      expand="block"
                      shape="round"
                      onClick={() => history.push('/app/order')}
                    >
                      立即拍照估价
                      <IonIcon icon={arrowForwardOutline} slot="end" />
                    </IonButton>
                  </motion.div>
                </div>
              </section>
            </motion.div>
          </section>

          <div className="home-sheet-wrap">
            <section className="home-sheet">
              <div className="home-sheet__inner">
                <div className="home-sheet__block">
                  <div className="home-sheet__heading">
                    <p className="page-eyebrow">FEATURED OFFERS</p>
                    <h2>今日活动</h2>
                  </div>

                  {loading ? (
                    <CardSkeleton repeat={1} lines={3} />
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      className="promo-carousel"
                    >
                      <div
                        className="promo-carousel__track"
                        onScroll={handlePromoScroll}
                        ref={promoScrollerRef}
                      >
                        {promoSlides.map((slide, idx) => (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="promo-slide"
                            key={slide.id}
                            onClick={() => history.push(slide.route)}
                            type="button"
                          >
                            <div className="promo-slide__media">
                              <img alt={slide.title} src={slide.imageUrl} />
                            </div>
                            <div className="promo-slide__overlay" />
                            <div className="promo-slide__content">
                              <h3>{slide.title}</h3>
                              <span className="promo-slide__cta">
                                {slide.cta}
                                <IonIcon icon={chevronForwardOutline} />
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      <div className="promo-carousel__dots promo-carousel__dots--overlay">
                        {promoSlides.map((dotSlide, index) => (
                          <button
                            aria-label={`查看${dotSlide.title}`}
                            className={`promo-carousel__dot${index === activePromoIndex ? ' is-active' : ''}`}
                            key={dotSlide.id}
                            onClick={() => scrollToPromo(index)}
                            type="button"
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

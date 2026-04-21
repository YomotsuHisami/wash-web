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
          ? '先拍照看鞋况，再决定是否下单。'
          : '进入下单页后即可直接选择。'),
      imageUrl: resolveDiscountImage(
        discount,
        index === 0 ? campaignAssets.feature : campaignAssets.membership
      ),
      route: discount.applicableGroup === 'vip' ? '/membership' : '/app/order',
      cta: discount.applicableGroup === 'vip' ? '开通会员' : '立即查看',
    }));

    if (discountSlides.length >= 2) {
      return discountSlides;
    }

    return [
      ...discountSlides,
      {
        id: 'member-slide',
        title: brandConfig.membershipName,
        body:
          currentUser?.group === 'vip'
            ? '会员权益已生效，下单时会优先匹配会员折扣。'
            : '开通后可直接使用会员折扣，后续活动也会优先开放。',
        imageUrl: campaignAssets.membership,
        route: '/membership',
        cta: currentUser?.group === 'vip' ? '查看权益' : '立即开通',
      },
      {
        id: 'first-order-slide',
        title: '首单拍照估价',
        body: '先拍三张鞋图，系统会先给出鞋况和费用拆分，再决定要不要继续下单。',
        imageUrl: campaignAssets.feature,
        route: '/app/order',
        cta: '开始拍照',
      },
    ].slice(0, 3);
  }, [discounts, currentUser]);

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
            <div className="home-hero__inner device-shell device-shell--home">
              <div className="home-hero__topline">
                <BrandMark size={58} withWordmark subtitle="XI SONG" />
                <div className="home-hero__tagline">{brandConfig.tagline}</div>
              </div>

              <section className="home-pass-card">
                <div className="home-pass-card__copy">
                  <h1 className="home-pass-title" aria-label={brandConfig.heroTitle}>
                    {heroTitleLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h1>
                  <p>
                    {currentUser
                      ? `欢迎回来，${currentUser.username}。看看今天有什么活动吧。`
                      : brandConfig.heroBody}
                  </p>
                  {currentUser?.group === 'vip' ? (
                    <div className="home-pass-card__meta">
                      <span>
                        <IonIcon icon={shieldCheckmarkOutline} />
                        会员身份已生效
                      </span>
                    </div>
                  ) : null}
                  <div className="hero-actions">
                    <IonButton
                      className="hero-actions__primary"
                      expand="block"
                      shape="round"
                      onClick={() => history.push('/app/order')}
                    >
                      拍照估价
                      <IonIcon icon={arrowForwardOutline} slot="end" />
                    </IonButton>
                    <IonButton
                      className="hero-actions__secondary"
                      fill="outline"
                      shape="round"
                      onClick={() => history.push('/membership')}
                    >
                      会员权益
                    </IonButton>
                  </div>
                </div>
              </section>
            </div>
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
                    <div className="promo-carousel">
                      <div
                        className="promo-carousel__track"
                        onScroll={handlePromoScroll}
                        ref={promoScrollerRef}
                      >
                        {promoSlides.map((slide) => (
                          <button
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
                          </button>
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
                    </div>
                  )}
                </div>

                <div className="home-sheet__block">
                  <div className="home-sheet__heading">
                    <p className="page-eyebrow">SERVICE STATUS</p>
                    <h2>服务动态</h2>
                  </div>

                  <div className="home-stats-row">
                    <div className="home-stat-tile">
                      <strong>{discounts.length || 0}</strong>
                      <span>当前活动</span>
                    </div>
                    <div className="home-stat-tile">
                      <strong>{shops.length || 0}</strong>
                      <span>合作门店</span>
                    </div>
                    <div className="home-stat-tile">
                      <strong>{latestOrder ? '1' : '0'}</strong>
                      <span>最近订单</span>
                    </div>
                  </div>

                  <div className="latest-order-card">
                    <div className="latest-order-card__top">
                      <div>
                        <h3>{latestOrder ? '最近订单' : '还没有最近订单'}</h3>
                      </div>
                      {latestOrder ? <StatusBadge status={latestOrder.status} /> : null}
                    </div>

                    {latestOrder ? (
                      <div className="latest-order-card__body">
                        <div>
                          <strong>
                            {latestOrder.shoeData.brand} {latestOrder.shoeData.model}
                          </strong>
                          <p className="muted">订单号 {latestOrder.id}</p>
                          <p className="muted">
                            取件人 {latestOrder.customerInfo.name} · {latestOrder.customerInfo.phone}
                          </p>
                        </div>
                        <IonButton fill="clear" onClick={() => history.push('/app/orders')}>
                          查看订单
                        </IonButton>
                      </div>
                    ) : (
                      <div className="latest-order-card__body">
                        <div>
                          <strong>先拍三张鞋图，再生成第一张订单</strong>
                          <p className="muted">订单生成后，这里会直接显示最近一单的状态和取件信息。</p>
                        </div>
                        <IonButton fill="clear" onClick={() => history.push('/app/order')}>
                          现在拍照
                        </IonButton>
                      </div>
                    )}
                  </div>
                </div>

                <div className="home-sheet__block home-sheet__block--assurance">
                  <div className="home-sheet__heading">
                    <p className="page-eyebrow">ASSURANCE TECH</p>
                    <h2>安心保技术</h2>
                  </div>

                  <button
                    className="assurance-banner"
                    onClick={() => history.push('/app/orders')}
                    type="button"
                  >
                    <img alt="安心保" src={campaignAssets.assurance} />
                    <div className="assurance-banner__overlay" />
                    <div className="assurance-banner__copy">
                      <div className="soft-badge">技术能力</div>
                      <h3>鞋况确认、取件安排、进度查看</h3>
                    </div>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

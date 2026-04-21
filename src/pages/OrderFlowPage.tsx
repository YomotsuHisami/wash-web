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
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
} from '@ionic/react';
import {
  arrowBackOutline,
  arrowForwardOutline,
  cameraOutline,
  checkmarkCircleOutline,
  createOutline,
  refreshOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import { createServerOrder, deleteServerOrder, markOrderPaid } from '../api/orders';
import { fetchUserProfile } from '../api/users';
import AppLoadingOverlay from '../components/common/AppLoadingOverlay';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import PriceSummaryCard from '../components/common/PriceSummaryCard';
import StickyActionBar from '../components/common/StickyActionBar';
import CaptureGuideCard from '../components/order/CaptureGuideCard';
import { mockShoes } from '../data/mockData';
import {
  CustomerInfo,
  Discount,
  Order,
  ServerOrder,
  ShoeData,
  Shop,
  UserProfile,
  isDiscountActive,
} from '../models/domain';
import {
  deleteOrder,
  generateOrderId,
  getStoredUser,
  hasOrderedOnce,
  markOrderedOnce,
  saveOrder,
  updateOrderStatus,
} from '../utils/storage';

type FlowStep = 'capture' | 'review' | 'analyzing' | 'report' | 'form' | 'payment' | 'success';
type CaptureStep = 0 | 1 | 2;

const CAPTURE_GUIDES = [
  {
    title: '鞋头正面',
    tip: '把整只鞋放进画面中央，让鞋头正对镜头，方便判断材质和整体轮廓。',
    image: '/shoe1.jpg',
  },
  {
    title: '鞋身侧面',
    tip: '完整拍到鞋帮、中底和侧面线条，系统会更容易识别型号和结构。',
    image: '/shoe2.jpg',
  },
  {
    title: '鞋底与重点污损',
    tip: '把磨损、污渍和鞋底纹路拍清楚，价格拆分会更直观。',
    image: '/shoe3.jpg',
  },
] as const;

const emptyForm: CustomerInfo = {
  name: '',
  phone: '',
  address: '',
  preferredShop: '',
  pickupTime: '尽快',
  notes: '',
};

export default function OrderFlowPage() {
  const history = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<FlowStep>('capture');
  const [captureStep, setCaptureStep] = useState<CaptureStep>(0);
  const [capturedImages, setCapturedImages] = useState<Array<string | null>>([null, null, null]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [result, setResult] = useState<ShoeData | null>(null);
  const [editableBrand, setEditableBrand] = useState('');
  const [editableModel, setEditableModel] = useState('');
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerInfo>(emptyForm);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [returningLoading, setReturningLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const storedUser = getStoredUser();
        const [nextShops, nextDiscounts] = await Promise.all([fetchShops(), fetchDiscounts()]);
        let profile: UserProfile | null = null;

        if (storedUser?.id) {
          try {
            profile = await fetchUserProfile(storedUser.id);
          } catch {
            profile = storedUser;
          }
        }

        if (!mounted) return;

        setCurrentUser(profile);
        setShops(nextShops);
        setDiscounts(nextDiscounts.filter(isDiscountActive));
        setFormData((prev) => ({
          ...prev,
          preferredShop: profile?.defaultInfo?.preferredShop || nextShops[0]?.name || '',
          pickupTime: profile?.defaultInfo?.pickupTime || prev.pickupTime,
          name: profile?.defaultInfo?.name || '',
          phone: profile?.defaultInfo?.phone || '',
          address: profile?.defaultInfo?.address || '',
          notes: profile?.defaultInfo?.notes || '',
        }));
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

  const eligibleDiscounts = useMemo(() => {
    if (!currentUser) return [];

    return discounts.filter((discount) => {
      const groupMatches =
        discount.applicableGroup === 'all' || discount.applicableGroup === currentUser.group;
      if (!groupMatches) return false;
      if ((discount.mode || 'normal') !== 'first_order') return true;
      return !hasOrderedOnce(currentUser.id);
    });
  }, [currentUser, discounts]);

  const selectedDiscount =
    eligibleDiscounts.find((discount) => discount.id === selectedDiscountId) || null;

  const getBaseFee = () => result?.pricing.baseFee || 0;
  const getDamageTotal = () =>
    result ? result.damages.reduce((sum, damage) => sum + damage.surcharge, 0) : 0;
  const getSubtotal = () => getBaseFee() + getDamageTotal();
  const getFinalPrice = () => {
    const subtotal = getSubtotal();
    if (!selectedDiscount || !subtotal) return subtotal;
    return Math.round(subtotal * (selectedDiscount.rate / 100));
  };

  const compressImageToDataUrl = (
    file: File,
    options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
  ): Promise<string> => {
    const { maxWidth = 1280, maxHeight = 1280, quality = 0.72 } = options;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('加载图片失败'));
        image.onload = () => {
          let { width, height } = image;
          const scale = Math.min(maxWidth / width, maxHeight / height, 1);
          width = Math.round(width * scale);
          height = Math.round(height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error('无法处理图片'));
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setActionError('');

    try {
      const compressed = await compressImageToDataUrl(file);
      setCapturedImages((prev) => {
        const next = [...prev];
        next[captureStep] = compressed;
        return next;
      });

      if (captureStep < 2) {
        setCaptureStep((prev) => (prev + 1) as CaptureStep);
      } else {
        setStep('review');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '图片处理失败，请重试。');
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyze = () => {
    if (capturedImages.some((image) => !image)) {
      setActionError('请先补齐三张图片。');
      return;
    }

    setActionError('');
    setStep('analyzing');

    window.setTimeout(() => {
      const mock = mockShoes[Math.floor(Math.random() * mockShoes.length)];
      setResult(mock);
      setEditableBrand(mock.brand);
      setEditableModel(mock.model);
      setStep('report');
    }, 2200);
  };

  const resetFlow = () => {
    setStep('capture');
    setCaptureStep(0);
    setCapturedImages([null, null, null]);
    setResult(null);
    setEditableBrand('');
    setEditableModel('');
    setSelectedDiscountId(null);
    setActionError('');
    setOrderId('');
  };

  const handleSubmitOrder = async () => {
    if (!result) return;
    if (!formData.name || !formData.phone || !formData.address) {
      setActionError('请补齐姓名、电话和地址。');
      setStep('form');
      return;
    }

    setSubmitLoading(true);
    setActionError('');

    const id = generateOrderId();
    const finalPrice = getFinalPrice();
    const finalizedShoeData: ShoeData = {
      ...result,
      brand: editableBrand || result.brand,
      model: editableModel || result.model,
      series: editableModel || result.series,
    };

    const order: Order = {
      id,
      createdAt: Date.now(),
      status: 'pending_payment',
      shoeData: finalizedShoeData,
      customerInfo: formData,
      totalPrice: finalPrice,
    };

    const serverOrder: ServerOrder = {
      ...order,
      userName: formData.name,
      userPhone: formData.phone,
      userAddress: formData.address,
      preferredShop: formData.preferredShop,
      pickupTime: formData.pickupTime,
      notes: formData.notes,
      price: finalPrice,
      analysisResult: finalizedShoeData,
      imageUrl: capturedImages[0] || undefined,
      imageUrls: capturedImages.filter(Boolean) as string[],
      pricingBreakdown: {
        baseFee: getBaseFee(),
        damageTotal: getDamageTotal(),
        subtotal: getSubtotal(),
        discountId: selectedDiscount?.id,
        discountTitle: selectedDiscount?.title,
        discountRate: selectedDiscount?.rate,
      },
    };

    try {
      saveOrder(order);
      setOrderId(id);
      await createServerOrder(serverOrder);
      setStep('payment');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '订单提交失败，请稍后重试。');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!orderId) return;

    setPaymentLoading(true);
    setActionError('');

    try {
      updateOrderStatus(orderId, 'paid');
      await markOrderPaid(orderId);
      if (currentUser) {
        markOrderedOnce(currentUser.id);
      }
      setStep('success');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '支付状态同步失败，请稍后再试。');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleReturnToForm = async () => {
    if (!orderId) {
      setStep('form');
      return;
    }

    setReturningLoading(true);
    setActionError('');

    try {
      deleteOrder(orderId);
      await deleteServerOrder(orderId);
      setOrderId('');
      setStep('form');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '返回修改失败，请稍后再试。');
    } finally {
      setReturningLoading(false);
    }
  };

  const currentGuide = CAPTURE_GUIDES[captureStep];

  return (
    <IonPage>
      <IonContent fullscreen>
        <AppLoadingOverlay
          isOpen={processingImage || submitLoading || paymentLoading || returningLoading}
          message={
            processingImage
              ? '正在处理图片...'
              : submitLoading
              ? '正在提交订单...'
              : paymentLoading
              ? '正在同步支付状态...'
              : returningLoading
              ? '正在返回修改...'
              : '加载中...'
          }
        />
        <div className="device-shell">
          <PageHeader
            eyebrow="NEW ORDER"
            title="拍照估价"
            subtitle="先拍三张图看鞋况，再决定要不要继续下单和安排取件。"
            onBack={() => history.goBack()}
          />

          {loading ? (
            <IonCard className="surface-card">
              <IonCardContent className="stack-section">
                <IonSpinner name="crescent" />
                <p className="muted">正在准备门店、活动和用户资料...</p>
              </IonCardContent>
            </IonCard>
          ) : null}

          {actionError ? (
            <IonText color="danger">
              <p className="form-message" style={{ marginBottom: 16 }}>
                {actionError}
              </p>
            </IonText>
          ) : null}

          {!loading && step === 'capture' ? (
            <section className="stack-section">
              <IonProgressBar value={(captureStep + 1) / 3} />
                <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={cameraOutline} />
                    第 {captureStep + 1} / 3 张
                  </div>
                  <h2 style={{ margin: 0 }}>{currentGuide.title}</h2>
                  <p>{currentGuide.tip}</p>
                  <CaptureGuideCard
                    active
                    captured={!!capturedImages[captureStep]}
                    image={currentGuide.image}
                    tip={currentGuide.tip}
                    title={currentGuide.title}
                  />
                  <input
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCapture}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    type="file"
                  />
                  <LoadingButton expand="block" loading={processingImage} onClick={() => fileInputRef.current?.click()} shape="round">
                    <IonIcon icon={cameraOutline} slot="start" />
                    拍摄这一张
                  </LoadingButton>
                  {capturedImages.every(Boolean) ? (
                    <IonButton fill="outline" shape="round" onClick={() => setStep('review')}>
                      已拍完，查看确认
                    </IonButton>
                  ) : null}
                </IonCardContent>
              </IonCard>
            </section>
          ) : null}

          {!loading && step === 'review' ? (
            <section className="stack-section">
              <div className="preview-grid">
                {CAPTURE_GUIDES.map((guide, index) => (
                  <IonCard className="surface-card" key={guide.title}>
                    <IonCardContent className="stack-section">
                      <div className="preview-frame">
                        {capturedImages[index] ? (
                          <img alt={guide.title} src={capturedImages[index] || undefined} />
                        ) : null}
                      </div>
                      <div>
                        <h3 style={{ margin: 0 }}>{guide.title}</h3>
                        <p className="muted">{guide.tip}</p>
                      </div>
                      <IonButton
                        fill="outline"
                        shape="round"
                        onClick={() => {
                          setCaptureStep(index as CaptureStep);
                          setStep('capture');
                        }}
                      >
                        <IonIcon icon={refreshOutline} slot="start" />
                        重拍这张
                      </IonButton>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>

              <StickyActionBar>
                <LoadingButton expand="block" loading={false} onClick={handleAnalyze} shape="round">
                  <IonIcon icon={sparklesOutline} slot="start" />
                  开始识别与估价
                </LoadingButton>
                <IonButton fill="outline" shape="round" onClick={resetFlow}>
                  全部重拍
                </IonButton>
              </StickyActionBar>
            </section>
          ) : null}

          {!loading && step === 'analyzing' ? (
            <IonCard className="surface-card hero-card">
              <IonCardContent className="stack-section" style={{ textAlign: 'center' }}>
                <IonSpinner name="crescent" />
                  <h2 style={{ margin: 0 }}>正在识别鞋款与污损</h2>
                <p>我们会把三张图整理成一份更清晰的价格报告，请稍候。</p>
              </IonCardContent>
            </IonCard>
          ) : null}

          {!loading && (step === 'report' || step === 'form') && result ? (
            <section className="stack-section">
              <div className="preview-grid">
                {capturedImages.map((image, index) => (
                  <div className="preview-frame" key={index}>
                    {image ? <img alt={`拍摄图 ${index + 1}`} src={image} /> : null}
                  </div>
                ))}
              </div>

              <IonCard className="surface-card">
                <IonCardContent className="report-grid">
                  <IonItem className="field-item">
                    <IonLabel position="stacked">品牌</IonLabel>
                    <IonInput value={editableBrand} onIonInput={(e) => setEditableBrand(e.detail.value || '')} />
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">型号</IonLabel>
                    <IonInput value={editableModel} onIonInput={(e) => setEditableModel(e.detail.value || '')} />
                  </IonItem>
                  <div className="feature-item">
                    <strong>识别置信度</strong>
                    <p>{result.confidence}%</p>
                  </div>
                  <div className="feature-item">
                    <strong>材质与处理建议</strong>
                    <p>{result.material}</p>
                    <p>{result.careTip}</p>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <h3 style={{ margin: 0 }}>污损拆分</h3>
                  {result.damages.map((damage) => (
                    <div className="feature-item" key={damage.id}>
                      <strong>{damage.type}</strong>
                      <p>
                        {damage.severity} · +¥{damage.surcharge}
                      </p>
                    </div>
                  ))}
                </IonCardContent>
              </IonCard>

              {eligibleDiscounts.length > 0 ? (
                <div className="chip-scroll">
                  {eligibleDiscounts.map((discount) => (
                    <IonChip
                      className="choice-chip"
                      color={selectedDiscountId === discount.id ? 'primary' : undefined}
                      key={discount.id}
                      onClick={() =>
                        setSelectedDiscountId((prev) => (prev === discount.id ? null : discount.id))
                      }
                    >
                      {discount.title}
                    </IonChip>
                  ))}
                </div>
              ) : null}

              <PriceSummaryCard
                baseFee={getBaseFee()}
                damageTotal={getDamageTotal()}
                selectedDiscount={selectedDiscount}
                total={getFinalPrice()}
              />

              {step === 'report' ? (
                <StickyActionBar>
                  <IonButton expand="block" shape="round" onClick={() => setStep('form')}>
                    填写订单资料
                    <IonIcon icon={arrowForwardOutline} slot="end" />
                  </IonButton>
                </StickyActionBar>
              ) : null}
            </section>
          ) : null}

          {!loading && step === 'form' ? (
            <section className="stack-section">
              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <IonItem className="field-item">
                    <IonLabel position="stacked">姓名</IonLabel>
                    <IonInput
                      value={formData.name}
                      onIonInput={(e) => setFormData((prev) => ({ ...prev, name: e.detail.value || '' }))}
                    />
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">电话</IonLabel>
                    <IonInput
                      value={formData.phone}
                      onIonInput={(e) => setFormData((prev) => ({ ...prev, phone: e.detail.value || '' }))}
                    />
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">取件地址</IonLabel>
                    <IonInput
                      value={formData.address}
                      onIonInput={(e) => setFormData((prev) => ({ ...prev, address: e.detail.value || '' }))}
                    />
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">门店</IonLabel>
                    <IonSelect
                      value={formData.preferredShop}
                      onIonChange={(e) =>
                        setFormData((prev) => ({ ...prev, preferredShop: e.detail.value || '' }))
                      }
                    >
                      {shops.map((shop) => (
                        <IonSelectOption key={shop.id} value={shop.name}>
                          {shop.name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">取件时间</IonLabel>
                    <IonSelect
                      value={formData.pickupTime}
                      onIonChange={(e) =>
                        setFormData((prev) => ({ ...prev, pickupTime: e.detail.value || '尽快' }))
                      }
                    >
                      <IonSelectOption value="尽快">尽快</IonSelectOption>
                      <IonSelectOption value="今天下午">今天下午</IonSelectOption>
                      <IonSelectOption value="明天上午">明天上午</IonSelectOption>
                      <IonSelectOption value="周末">周末</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem className="field-item">
                    <IonLabel position="stacked">备注</IonLabel>
                    <IonTextarea
                      autoGrow
                      value={formData.notes}
                      onIonInput={(e) => setFormData((prev) => ({ ...prev, notes: e.detail.value || '' }))}
                    />
                  </IonItem>
                </IonCardContent>
              </IonCard>

              <StickyActionBar>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <p className="muted" style={{ margin: 0 }}>
                      应付金额
                    </p>
                    <strong style={{ fontSize: '1.5rem' }}>¥{getFinalPrice()}</strong>
                  </div>
                  <IonButton fill="clear" onClick={() => setStep('report')}>
                    <IonIcon icon={arrowBackOutline} slot="start" />
                    返回报告
                  </IonButton>
                </div>
                <LoadingButton expand="block" loading={submitLoading} onClick={handleSubmitOrder} shape="round">
                  确认并进入支付
                </LoadingButton>
              </StickyActionBar>
            </section>
          ) : null}

          {!loading && step === 'payment' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={checkmarkCircleOutline} />
                    订单支付
                  </div>
                  <h2 style={{ margin: 0 }}>扫码完成支付</h2>
                  <p>支付完成后，订单状态会立即更新到订单中心，后续进度也会继续显示在里面。</p>
                  <div className="preview-frame" style={{ aspectRatio: '1 / 1' }}>
                    <img alt="订单支付二维码" src="/qr.jpg" />
                  </div>
                  <strong style={{ fontSize: '2rem' }}>¥{getFinalPrice()}</strong>
                  <div className="inline-actions">
                    <IonButton fill="outline" shape="round" onClick={handleReturnToForm}>
                      <IonIcon icon={createOutline} slot="start" />
                      返回修改
                    </IonButton>
                    <LoadingButton loading={paymentLoading} onClick={handlePaymentSuccess} shape="round">
                      我已完成支付
                    </LoadingButton>
                  </div>
                </IonCardContent>
              </IonCard>
            </section>
          ) : null}

          {!loading && step === 'success' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={checkmarkCircleOutline} />
                    支付成功
                  </div>
                  <h2 style={{ margin: 0 }}>订单已提交</h2>
                  <p>
                    订单号 {orderId}
                    <br />
                    取件时间 {formData.pickupTime} · 取件地址 {formData.address}
                  </p>
                  <div className="inline-actions">
                    <IonButton shape="round" onClick={() => history.replace('/app/orders')}>
                      查看订单
                    </IonButton>
                    <IonButton fill="outline" shape="round" onClick={resetFlow}>
                      再下一单
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

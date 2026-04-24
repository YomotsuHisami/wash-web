import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import {
  arrowBackOutline,
  arrowForwardOutline,
  cameraOutline,
  checkmarkCircleOutline,
  createOutline,
  refreshOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { analyzeShoeImages } from '../api/analysis';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import { createServerOrder, markOrderPaid } from '../api/orders';
import { fetchUserProfile } from '../api/users';
import AppLoadingOverlay from '../components/common/AppLoadingOverlay';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import PriceSummaryCard from '../components/common/PriceSummaryCard';
import StickyActionBar from '../components/common/StickyActionBar';
import CaptureGuideCard from '../components/order/CaptureGuideCard';
import {
  CustomerInfo,
  Discount,
  Order,
  ServerOrder,
  ServicePreference,
  ServiceRecommendation,
  ShoeConditionLevel,
  ShoeData,
  Shop,
  UserProfile,
  isDiscountActive,
} from '../models/domain';
import {
  clearOrderResultSnapshot,
  getBestDiscount,
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
import {
  generateOrderId,
  getStoredUser,
  hasOrderedOnce,
  markOrderedOnce,
  saveOrder,
} from '../utils/storage';

type FlowStep =
  | 'capture'
  | 'analyzing'
  | 'report'
  | 'payment'
  | 'success';
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

const DEFAULT_RECOMMENDATION_SHOPS: Shop[] = [
  {
    id: 'fallback-1',
    name: '城北球鞋护理工坊',
    address: '北苑路 18 号',
    distanceKm: 2.6,
    qualityScore: 86,
    valueScore: 84,
    speedScore: 91,
    oxidationScore: 72,
    specialtyMaterials: ['网布拼接', '合成革', '橡胶大底'],
    specialtyServices: ['当日快洗', '基础精洗', '鞋底护理'],
  },
  {
    id: 'fallback-2',
    name: '南苑焕新实验室',
    address: '南苑路 66 号',
    distanceKm: 1.8,
    qualityScore: 90,
    valueScore: 76,
    speedScore: 78,
    oxidationScore: 92,
    specialtyMaterials: ['头层牛皮', '麂皮', '漆皮涂层'],
    specialtyServices: ['深度精洗', '去氧化', '皮面养护'],
  },
  {
    id: 'fallback-3',
    name: '东苑轻奢快洗站',
    address: '东苑路 21 号',
    distanceKm: 3.4,
    qualityScore: 82,
    valueScore: 93,
    speedScore: 86,
    oxidationScore: 74,
    specialtyMaterials: ['Primeknit 编织', '网布拼接', 'Boost 发泡'],
    specialtyServices: ['轻奢快洗', '中底提亮', '高性价比套餐'],
  },
];

const PREFERENCE_OPTIONS: Array<{
  value: ServicePreference;
  label: string;
  hint: string;
}> = [
  { value: 'balanced', label: '均衡推荐', hint: '综合适配度、距离与体验' },
  { value: 'value', label: '价格更实惠', hint: '优先控制预付金额' },
  { value: 'quality', label: '品质更好', hint: '更看重洗护稳定性' },
  { value: 'oxidation', label: '去氧化优先', hint: '更关注发黄与氧化' },
];

const WEAR_OPTIONS: ShoeConditionLevel[] = ['轻度', '中度', '重度'];

const emptyForm: CustomerInfo = {
  name: '',
  phone: '',
  address: '',
  notes: '',
  servicePreference: 'balanced',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeServicePreference(
  value?: ServicePreference | string | null
): ServicePreference {
  return PREFERENCE_OPTIONS.some((item) => item.value === value)
    ? (value as ServicePreference)
    : 'balanced';
}

function getWearWeight(level: ShoeConditionLevel) {
  if (level === '轻度') return 1;
  if (level === '重度') return 3;
  return 2;
}

function getShopProfile(shop: Shop, index: number) {
  const fallback = DEFAULT_RECOMMENDATION_SHOPS[index % DEFAULT_RECOMMENDATION_SHOPS.length];

  return {
    ...fallback,
    ...shop,
    distanceKm: shop.distanceKm ?? fallback.distanceKm ?? 2.5,
    qualityScore: shop.qualityScore ?? fallback.qualityScore ?? 82,
    valueScore: shop.valueScore ?? fallback.valueScore ?? 82,
    speedScore: shop.speedScore ?? fallback.speedScore ?? 82,
    oxidationScore: shop.oxidationScore ?? fallback.oxidationScore ?? 82,
    specialtyMaterials: shop.specialtyMaterials ?? fallback.specialtyMaterials ?? [],
    specialtyServices: shop.specialtyServices ?? fallback.specialtyServices ?? [],
  };
}

function materialMatchScore(shop: Shop, shoeData: ShoeData) {
  const specialties = shop.specialtyMaterials || [];
  return shoeData.materials.reduce((sum, item) => {
    const matched = specialties.some(
      (specialty) => item.material.includes(specialty) || specialty.includes(item.material)
    );
    return sum + (matched ? 6 : 1);
  }, 0);
}

function needsOxidationCare(shoeData: ShoeData) {
  return shoeData.damages.some(
    (damage) =>
      damage.type.includes('氧化') ||
      damage.type.includes('发黄') ||
      damage.note?.includes('发黄')
  );
}

function prefersLuxuryCare(shoeData: ShoeData) {
  return shoeData.materials.some(
    (item) =>
      item.material.includes('麂皮') ||
      item.material.includes('头层牛皮') ||
      item.material.includes('反毛') ||
      item.material.includes('漆皮')
  );
}

function createConditionSummary(shoeData: ShoeData) {
  const topDamages = shoeData.damages.slice(0, 2).map((damage) => damage.type).join('、');
  const materials = shoeData.materials.slice(0, 2).map((item) => item.material).join(' + ');
  return `${shoeData.wearLevel}磨损，主要关注 ${topDamages || '表面清洁'}，建议按 ${materials} 分区处理。`;
}

function buildRecommendations(
  shoeData: ShoeData,
  sourceShops: Shop[],
  preference: ServicePreference
) {
  const shops = sourceShops.length > 0 ? sourceShops : DEFAULT_RECOMMENDATION_SHOPS;
  const baseFee = shoeData.pricing.baseFee;
  const damageTotal = shoeData.damages.reduce((sum, damage) => sum + damage.surcharge, 0);
  const wearWeight = getWearWeight(shoeData.wearLevel);
  const hasOxidation = needsOxidationCare(shoeData);
  const luxuryCare = prefersLuxuryCare(shoeData);
  const usedShopIds = new Set<string>();

  const preferenceWeight = (shop: ReturnType<typeof getShopProfile>) => {
    if (preference === 'value') return shop.valueScore * 0.18;
    if (preference === 'quality') return shop.qualityScore * 0.2;
    if (preference === 'speed') return shop.speedScore * 0.18;
    if (preference === 'oxidation') return shop.oxidationScore * 0.18;
    return (shop.qualityScore + shop.valueScore + shop.speedScore) * 0.05;
  };

  const strategyConfigs: Array<{
    strategy: ServiceRecommendation['strategy'];
    title: string;
    summary: string;
    score: (shop: ReturnType<typeof getShopProfile>) => number;
    addonTotal: (shop: ReturnType<typeof getShopProfile>) => number;
    serviceFee: (shop: ReturnType<typeof getShopProfile>) => number;
    includes: (shop: ReturnType<typeof getShopProfile>) => string[];
    valueAdds: (shop: ReturnType<typeof getShopProfile>) => string[];
    turnAroundDelta: number;
  }> = [
    {
      strategy: 'recommended',
      title: '最推荐方案',
      summary: '综合鞋况、门店适配度、偏好与距离做平衡推荐。',
      score: (shop) =>
        shop.qualityScore * 0.3 +
        shop.valueScore * 0.18 +
        shop.speedScore * 0.14 +
        shop.oxidationScore * (hasOxidation ? 0.14 : 0.08) +
        materialMatchScore(shop, shoeData) +
        preferenceWeight(shop) +
        clamp(14 - shop.distanceKm * 2, 3, 14),
      addonTotal: () => (hasOxidation ? 8 : luxuryCare ? 6 : 4),
      serviceFee: (shop) =>
        Math.round(14 + wearWeight * 4 + (shop.qualityScore - 80) * 0.15),
      includes: () => ['平台上门取鞋', 'AI + 人工双重复核', '分区深度清洁'],
      valueAdds: () => (hasOxidation ? ['轻度去氧化', '鞋底提亮'] : ['局部养护', '异味处理']),
      turnAroundDelta: 0,
    },
    {
      strategy: 'value',
      title: '价格更实惠',
      summary: '优先控制预付金额，适合先确认大致意向。',
      score: (shop) =>
        shop.valueScore * 0.42 +
        shop.speedScore * 0.16 +
        shop.qualityScore * 0.12 +
        materialMatchScore(shop, shoeData) * 0.7 +
        clamp(15 - shop.distanceKm * 2.2, 2, 15),
      addonTotal: () => (hasOxidation ? 4 : 0),
      serviceFee: () => Math.round(6 + wearWeight * 2),
      includes: () => ['平台上门取鞋', '标准精洗', '基础污渍处理'],
      valueAdds: () => ['价格更低', '适合先锁定订单'],
      turnAroundDelta: -1,
    },
    {
      strategy: 'premium',
      title: '品质更好',
      summary: '更重视材质匹配与洗护稳定性，适合高价值鞋款。',
      score: (shop) =>
        shop.qualityScore * 0.45 +
        shop.oxidationScore * (hasOxidation ? 0.18 : 0.08) +
        materialMatchScore(shop, shoeData) * 1.25 +
        (luxuryCare ? 12 : 0) +
        preferenceWeight(shop) +
        clamp(13 - shop.distanceKm * 1.8, 2, 13),
      addonTotal: () => (luxuryCare ? 16 : 10),
      serviceFee: (shop) =>
        Math.round(24 + wearWeight * 5 + (shop.qualityScore - 80) * 0.18),
      includes: () => ['平台上门取鞋', '材质分级精洗', '重点部位护理', '人工复核定档'],
      valueAdds: () => ['高端材质优先排单', '更稳妥的养护处理'],
      turnAroundDelta: 1,
    },
    {
      strategy: 'oxidation',
      title: hasOxidation ? '去氧化增强方案' : '加值养护方案',
      summary: hasOxidation
        ? '针对发黄与氧化做更强处理。'
        : '在基础清洁外增加更明显的焕新处理。',
      score: (shop) =>
        shop.oxidationScore * (hasOxidation ? 0.46 : 0.18) +
        shop.qualityScore * 0.18 +
        materialMatchScore(shop, shoeData) +
        ((shop.specialtyServices || []).some(
          (item) => item.includes('去氧化') || item.includes('提亮')
        )
          ? 10
          : 2) +
        preferenceWeight(shop) +
        clamp(12 - shop.distanceKm * 2, 2, 12),
      addonTotal: () => (hasOxidation ? 18 + wearWeight * 2 : 8 + wearWeight * 2),
      serviceFee: (shop) =>
        Math.round((hasOxidation ? 18 : 12) + wearWeight * 4 + (shop.oxidationScore - 75) * 0.12),
      includes: () =>
        hasOxidation
          ? ['平台上门取鞋', '去氧化处理', '边缘提亮', '人工复核定档']
          : ['平台上门取鞋', '重点养护', '局部提亮'],
      valueAdds: () =>
        hasOxidation ? ['更适合发黄边缘', '适合白底与中底提亮'] : ['焕新感更明显', '适合礼品级整理'],
      turnAroundDelta: 1,
    },
  ];

  return strategyConfigs.map((config) => {
    const ranked = shops
      .map((shop, index) => {
        const profile = getShopProfile(shop, index);
        return { profile, score: config.score(profile) };
      })
      .sort((left, right) => right.score - left.score);

    const picked =
      ranked.find((candidate) => !usedShopIds.has(candidate.profile.id)) || ranked[0];

    usedShopIds.add(picked.profile.id);

    const serviceFee = config.serviceFee(picked.profile);
    const addonTotal = config.addonTotal(picked.profile);
    const prepayPrice = baseFee + damageTotal + serviceFee + addonTotal;
    const turnaroundMin = clamp(2 + wearWeight + config.turnAroundDelta - (picked.profile.speedScore >= 88 ? 1 : 0), 1, 7);
    const turnaroundMax = clamp(turnaroundMin + (config.strategy === 'premium' || config.strategy === 'oxidation' ? 2 : 1), turnaroundMin, 8);
    const materialFocus = shoeData.materials
      .slice(0, 2)
      .map((item) => item.material)
      .join(' / ');

    return {
      id: `${config.strategy}-${picked.profile.id}`,
      strategy: config.strategy,
      title: config.title,
      shopId: picked.profile.id,
      shopName: picked.profile.name,
      summary: `${picked.profile.name} 更适合处理 ${materialFocus}，当前方案更贴合 ${shoeData.wearLevel} 鞋况。`,
      reason:
        preference === 'balanced'
          ? `综合门店能力、距离 ${picked.profile.distanceKm}km 与当前鞋况后，匹配度最高。`
          : `结合你的“${PREFERENCE_OPTIONS.find((item) => item.value === preference)?.label}”偏好，${picked.profile.name} 当前排序更靠前。`,
      matchScore: Math.round(clamp(picked.score, 68, 98)),
      distanceKm: Number(picked.profile.distanceKm.toFixed(1)),
      estimatedTurnaround: `${turnaroundMin}-${turnaroundMax}天`,
      serviceFee,
      addonTotal,
      prepayPrice,
      includedServices: config.includes(picked.profile),
      valueAdds: config.valueAdds(picked.profile),
      caution:
        shoeData.pricing.manualReviewNote ||
        '平台方上门取鞋后，会结合人工与 AI 做进一步复核定价，多退少补。',
    } satisfies ServiceRecommendation;
  });
}

export default function OrderFlowPage() {
  const history = useHistory();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeStep = useMemo(
    () => new URLSearchParams(location.search).get('resume'),
    [location.search]
  );
  const [loading, setLoading] = useState(true);
  const [resumeHandled, setResumeHandled] = useState(!resumeStep);
  const [step, setStep] = useState<FlowStep>('capture');
  const [captureStep, setCaptureStep] = useState<CaptureStep>(0);
  const [capturedImages, setCapturedImages] = useState<Array<string | null>>([null, null, null]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [result, setResult] = useState<ShoeData | null>(null);
  const [editableShoeType, setEditableShoeType] = useState('');
  const [editableBrand, setEditableBrand] = useState('');
  const [editableModel, setEditableModel] = useState('');
  const [editableUpperMaterial, setEditableUpperMaterial] = useState('');
  const [editableDetailMaterial, setEditableDetailMaterial] = useState('');
  const [editableWearLevel, setEditableWearLevel] = useState<ShoeConditionLevel>('中度');
  const [servicePreference, setServicePreference] = useState<ServicePreference>('balanced');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [selectedOrderInfoId, setSelectedOrderInfoId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'alipay' | 'wechat'>(
    'alipay'
  );
  const [activeReportImageIndex, setActiveReportImageIndex] = useState(0);
  const [formData, setFormData] = useState<CustomerInfo>(emptyForm);
  const [processingImage, setProcessingImage] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [paymentBaselineInfo, setPaymentBaselineInfo] = useState<CustomerInfo | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0.06);

  const getBoundOrderInfo = (
    baseInfo?: Partial<CustomerInfo> | null
  ): CustomerInfo => ({
    ...toCustomerInfo(baseInfo),
    servicePreference:
      (baseInfo?.servicePreference as ServicePreference | undefined) || servicePreference,
  });

  const restoreFromSnapshot = (
    snapshot: OrderResultSnapshot,
    nextStep: Extract<FlowStep, 'report' | 'payment'>
  ) => {
    const fallbackOrderInfo = getSelectedOrderInfo(
      currentUser,
      snapshot.selectedOrderInfoId || undefined
    );
    const boundInfo = getBoundOrderInfo({
      ...snapshot.formData,
      ...(fallbackOrderInfo || {}),
    });

    const nextImages: Array<string | null> = [null, null, null];
    snapshot.capturedImages.slice(0, 3).forEach((image, index) => {
      nextImages[index] = image;
    });

    setCapturedImages(nextImages);
    setCaptureStep(0);
    setActiveReportImageIndex(0);
    setResult(snapshot.confirmedShoeData);
    setEditableShoeType(snapshot.confirmedShoeData.shoeType);
    setEditableBrand(snapshot.confirmedShoeData.brand);
    setEditableModel(snapshot.confirmedShoeData.model);
    setEditableUpperMaterial(snapshot.confirmedShoeData.materials[0]?.material || '');
    setEditableDetailMaterial(snapshot.confirmedShoeData.materials[1]?.material || '');
    setEditableWearLevel(snapshot.confirmedShoeData.wearLevel);
    setServicePreference(
      normalizeServicePreference(
        (boundInfo.servicePreference as ServicePreference | undefined) ||
          snapshot.servicePreference
      )
    );
    setSelectedPlanId(snapshot.selectedPlanId);
    setSelectedDiscountId(snapshot.selectedDiscountId);
    setSelectedPaymentMethod(snapshot.selectedPaymentMethod || 'alipay');
    setSelectedOrderInfoId(snapshot.selectedOrderInfoId || '');
    setFormData(boundInfo);
    setPaymentBaselineInfo(
      nextStep === 'payment'
        ? snapshot.pricingBaselineInfo || snapshot.formData || boundInfo
        : null
    );
    setActionError('');
    setStep(nextStep);
  };

  const buildResultSnapshot = (): OrderResultSnapshot | null => {
    if (!confirmedShoeData || !recommendations.length) return null;

    const selectedOrderInfo = getSelectedOrderInfo(currentUser, selectedOrderInfoId);
    const boundInfo = getBoundOrderInfo(selectedOrderInfo || formData);
    const subtotal =
      confirmedShoeData.pricing.baseFee +
      confirmedShoeData.damages.reduce((sum, damage) => sum + damage.surcharge, 0) +
      (selectedPlan?.serviceFee || 0) +
      (selectedPlan?.addonTotal || 0);
    const appliedDiscount = getBestDiscount(
      eligibleDiscounts,
      subtotal,
      selectedDiscountId
    );

    return {
      confirmedShoeData,
      recommendations,
      selectedPlanId: selectedPlanId || recommendations[0]?.id || '',
      eligibleDiscounts,
      selectedDiscountId: appliedDiscount?.id || null,
      selectedPaymentMethod,
      servicePreference:
        (boundInfo.servicePreference as ServicePreference | undefined) || servicePreference,
      formData: boundInfo,
      pricingBaselineInfo: paymentBaselineInfo || boundInfo,
      selectedOrderInfoId,
      orderInfos: getOrderInfos(currentUser),
      capturedImages: capturedImages.filter(Boolean) as string[],
    };
  };

  const persistResultSnapshot = () => {
    const snapshot = buildResultSnapshot();
    if (!snapshot) return false;
    saveOrderResultSnapshot(snapshot);
    return true;
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const storedUser = getStoredUser();
        const [nextShops, nextDiscounts] = await Promise.all([fetchShops(), fetchDiscounts()]);
        let profile: UserProfile | null = null;

        if (storedUser?.id) {
          try {
            profile = migrateUserProfileOrderInfos(await fetchUserProfile(storedUser.id));
          } catch {
            profile = migrateUserProfileOrderInfos(storedUser);
          }
        }

        if (!mounted) return;

        const initialPreference = normalizeServicePreference(
          getDefaultOrderInfo(profile)?.servicePreference as ServicePreference | undefined
        );
        const defaultOrderInfo = getDefaultOrderInfo(profile);

        setCurrentUser(profile);
        setSelectedOrderInfoId(defaultOrderInfo?.id || '');
        setShops(nextShops);
        setDiscounts(nextDiscounts.filter(isDiscountActive));
        setServicePreference(initialPreference);
        setFormData((prev) => ({
          ...prev,
          name: defaultOrderInfo?.name || '',
          phone: defaultOrderInfo?.phone || '',
          address: defaultOrderInfo?.address || '',
          notes: defaultOrderInfo?.notes || '',
          servicePreference: initialPreference,
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

  useEffect(() => {
    setResumeHandled(!resumeStep);
  }, [resumeStep]);

  useEffect(() => {
    if (loading || resumeHandled) return;

    const targetStep =
      resumeStep === 'payment'
        ? 'payment'
        : resumeStep === 'report'
        ? 'report'
        : null;

    if (!targetStep) {
      setResumeHandled(true);
      return;
    }

    const snapshot = getOrderResultSnapshot();

    if (!snapshot) {
      setActionError('推荐结果已失效，请重新生成方案。');
      history.replace('/app/order');
      setResumeHandled(true);
      return;
    }

    restoreFromSnapshot(snapshot, targetStep);
    history.replace('/app/order');
    setResumeHandled(true);
  }, [history, loading, resumeHandled, resumeStep]);

  const eligibleDiscounts = useMemo(() => {
    if (!currentUser) return [];

    return discounts.filter((discount) => {
      if ((discount.mode || 'normal') !== 'first_order') return true;
      return !hasOrderedOnce(currentUser.id);
    });
  }, [currentUser, discounts]);

  const confirmedShoeData = useMemo(() => {
    if (!result) return null;

    return {
      ...result,
      shoeType: editableShoeType || result.shoeType,
      brand: editableBrand || result.brand,
      model: editableModel || result.model,
      series: editableModel || result.series,
      wearLevel: editableWearLevel,
      materials: result.materials.map((item, index) =>
        index === 0
          ? { ...item, material: editableUpperMaterial || item.material }
          : index === 1
          ? { ...item, material: editableDetailMaterial || item.material }
          : item
      ),
      conditionSummary: createConditionSummary({
        ...result,
        wearLevel: editableWearLevel,
        materials: result.materials.map((item, index) =>
          index === 0
            ? { ...item, material: editableUpperMaterial || item.material }
            : index === 1
            ? { ...item, material: editableDetailMaterial || item.material }
            : item
        ),
      }),
    } satisfies ShoeData;
  }, [
    editableBrand,
    editableDetailMaterial,
    editableModel,
    editableShoeType,
    editableUpperMaterial,
    editableWearLevel,
    result,
  ]);

  const recommendations = useMemo(() => {
    if (!confirmedShoeData) return [];
    return buildRecommendations(confirmedShoeData, shops, servicePreference);
  }, [confirmedShoeData, servicePreference, shops]);

  useEffect(() => {
    if (!recommendations.length) {
      setSelectedPlanId('');
      return;
    }

    setSelectedPlanId((prev) =>
      recommendations.some((plan) => plan.id === prev) ? prev : recommendations[0].id
    );
  }, [recommendations]);

  useEffect(() => {
    if (step !== 'analyzing') {
      setAnalysisProgress(0.06);
      return;
    }

    setAnalysisProgress(0.08);
    const start = Date.now();
    const duration = 10000;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const nextValue = Math.min(0.92, 0.08 + (elapsed / duration) * 0.84);
      setAnalysisProgress(nextValue);
    }, 180);

    return () => window.clearInterval(timer);
  }, [step]);

  const selectedPlan =
    recommendations.find((plan) => plan.id === selectedPlanId) || recommendations[0] || null;

  const getBaseFee = () => confirmedShoeData?.pricing.baseFee || 0;
  const getDamageTotal = () =>
    confirmedShoeData
      ? confirmedShoeData.damages.reduce((sum, damage) => sum + damage.surcharge, 0)
      : 0;
  const getPlanSubtotal = () =>
    getBaseFee() +
    getDamageTotal() +
    (selectedPlan?.serviceFee || 0) +
    (selectedPlan?.addonTotal || 0);
  const selectedDiscount = getBestDiscount(
    eligibleDiscounts,
    getPlanSubtotal(),
    selectedDiscountId
  );
  const getDiscountAmount = () => {
    const subtotal = getPlanSubtotal();
    if (!selectedDiscount || !subtotal) return 0;
    const discounted = Math.round(subtotal * (selectedDiscount.rate / 100));
    return Math.max(subtotal - discounted, 0);
  };
  const getFinalPrice = () => {
    const subtotal = getPlanSubtotal();
    if (!selectedDiscount || !subtotal) return subtotal;
    return Math.round(subtotal * (selectedDiscount.rate / 100));
  };
  const paymentNeedsReprice = isRepriceSensitiveOrderInfoChange(
    paymentBaselineInfo,
    formData
  );

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

  const startAnalysis = async () => {
    const images = capturedImages.filter(Boolean) as string[];
    if (images.length === 0) {
      setActionError('请先上传鞋子图片后再识别。');
      return;
    }

    setActionError('');
    setStep('analyzing');
    setAnalysisProgress(0.08);

    try {
      const response = await analyzeShoeImages(images);
      const analyzed = response.result;
      setAnalysisProgress(1);
      setActiveReportImageIndex(0);
      setResult(analyzed);
      setEditableShoeType(analyzed.shoeType);
      setEditableBrand(analyzed.brand);
      setEditableModel(analyzed.model);
      setEditableUpperMaterial(analyzed.materials[0]?.material || '');
      setEditableDetailMaterial(analyzed.materials[1]?.material || '');
      setEditableWearLevel(analyzed.wearLevel);
      setStep('report');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '识别失败，请稍后重试。');
      setStep('capture');
    }
  };

  const handleCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setActionError('');

    try {
      const compressed = await compressImageToDataUrl(file);
      const nextImages = [...capturedImages];
      nextImages[captureStep] = compressed;
      setCapturedImages(nextImages);

      if (captureStep < 2) {
        setCaptureStep((prev) => (prev + 1) as CaptureStep);
      } else {
        startAnalysis();
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

  const resetFlow = () => {
    setStep('capture');
    setCaptureStep(0);
    setCapturedImages([null, null, null]);
    setActiveReportImageIndex(0);
    setResult(null);
    setEditableShoeType('');
    setEditableBrand('');
    setEditableModel('');
    setEditableUpperMaterial('');
    setEditableDetailMaterial('');
    setEditableWearLevel('中度');
    setSelectedPlanId('');
    setSelectedDiscountId(null);
    setSelectedPaymentMethod('alipay');
    setPaymentBaselineInfo(null);
    setActionError('');
    setOrderId('');
    clearOrderResultSnapshot();
  };

  const redirectToAccountForOrderInfo = () => {
    history.push(
      `/app/account?returnTo=${encodeURIComponent('/app/order?resume=report')}`
    );
  };

  const handleOpenRecommendationResult = () => {
    if (!persistResultSnapshot()) {
      setActionError('请先完成识别确认，再生成推荐方案。');
      return;
    }

    const boundInfo = getBoundOrderInfo(
      getSelectedOrderInfo(currentUser, selectedOrderInfoId) || formData
    );

    setFormData(boundInfo);
    history.push('/app/order/result');
  };

  const handleBackToResultPage = () => {
    if (!persistResultSnapshot()) {
      setActionError('推荐结果已失效，请重新生成方案。');
      return;
    }

    history.push('/app/order/result');
  };

  const handleReturnForReprice = () => {
    const snapshot = buildResultSnapshot();
    if (snapshot) {
      saveOrderResultSnapshot({
        ...snapshot,
        formData,
        selectedOrderInfoId,
      });
    }
    history.push('/app/order?resume=report');
  };

  const handlePaymentSuccess = async () => {
    if (!confirmedShoeData || !selectedPlan) {
      setActionError('订单数据不完整，请重新生成方案。');
      return;
    }

    if (paymentNeedsReprice) {
      setActionError('订单信息已变化，请先返回结果页重新生成推荐方案。');
      return;
    }

    const lockedOrderInfo = getBoundOrderInfo(
      getSelectedOrderInfo(currentUser, selectedOrderInfoId) || formData
    );

    if (!hasRequiredOrderInfo(lockedOrderInfo)) {
      setActionError('订单资料不完整，请先补全取件信息。');
      return;
    }

    setPaymentLoading(true);
    setActionError('');

    const id = generateOrderId();
    const finalPrice = getFinalPrice();
    const order: Order = {
      id,
      createdAt: Date.now(),
      status: 'paid',
      shoeData: confirmedShoeData,
      customerInfo: {
        ...lockedOrderInfo,
        servicePreference,
      },
      selectedServicePlan: selectedPlan,
      alternativePlans: recommendations.filter((plan) => plan.id !== selectedPlan.id),
      totalPrice: finalPrice,
    };

    const serverOrder: ServerOrder = {
      ...order,
      status: 'pending_payment',
      userName: lockedOrderInfo.name,
      userPhone: lockedOrderInfo.phone,
      userAddress: lockedOrderInfo.address,
      notes: lockedOrderInfo.notes,
      servicePreference,
      price: finalPrice,
      analysisResult: confirmedShoeData,
      imageUrl: capturedImages[0] || undefined,
      imageUrls: capturedImages.filter(Boolean) as string[],
      pricingBreakdown: {
        baseFee: getBaseFee(),
        damageTotal: getDamageTotal(),
        serviceFee: selectedPlan.serviceFee,
        addonTotal: selectedPlan.addonTotal,
        subtotal: getPlanSubtotal(),
        discountAmount: getDiscountAmount(),
        selectedPlanId: selectedPlan.id,
        selectedPlanTitle: selectedPlan.title,
        discountId: selectedDiscount?.id,
        discountTitle: selectedDiscount?.title,
        discountRate: selectedDiscount?.rate,
        total: finalPrice,
      },
    };

    try {
      saveOrder(order);
      await createServerOrder(serverOrder);
      await markOrderPaid(id);
      if (currentUser?.id) {
        markOrderedOnce(currentUser.id);
      }
      setOrderId(id);
      setFormData(lockedOrderInfo);
      clearOrderResultSnapshot();
      setStep('success');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '支付状态同步失败，请稍后再试。');
    } finally {
      setPaymentLoading(false);
    }
  };

  const currentGuide = CAPTURE_GUIDES[captureStep];
  const activeReportImage = capturedImages[activeReportImageIndex] || capturedImages[0] || null;
  const activeReportGuide = CAPTURE_GUIDES[activeReportImageIndex] || CAPTURE_GUIDES[0];

  return (
    <IonPage>
      <IonContent fullscreen>
        <AppLoadingOverlay
          isOpen={processingImage || paymentLoading}
          message={
            processingImage
              ? '正在处理图片...'
              : paymentLoading
              ? '正在提交支付结果...'
              : '加载中...'
          }
        />
        <div className="device-shell">
          <PageHeader
            onBack={() => history.goBack()}
          />

          {loading || !resumeHandled ? (
            <IonCard className="surface-card">
              <IonCardContent className="stack-section">
                <IonSpinner name="crescent" />
                <p className="muted">
                  {loading ? '正在准备门店、活动和用户资料...' : '正在恢复推荐结果...'}
                </p>
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

          {!loading && resumeHandled && step === 'capture' ? (
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
                  <LoadingButton
                    expand="block"
                    loading={processingImage}
                    onClick={() => fileInputRef.current?.click()}
                    shape="round"
                  >
                    <IonIcon icon={cameraOutline} slot="start" />
                    拍摄这一张
                  </LoadingButton>
                </IonCardContent>
              </IonCard>
            </section>
          ) : null}

          {!loading && resumeHandled && step === 'analyzing' ? (
            <IonCard className="surface-card hero-card">
              <IonCardContent className="stack-section" style={{ textAlign: 'center' }}>
                <IonSpinner name="crescent" />
                <h2 style={{ margin: 0 }}>正在识别鞋型、材质与磨损情况</h2>
                <IonProgressBar value={analysisProgress} />
                <p className="muted" style={{ margin: 0 }}>
                  识别进度 {Math.max(1, Math.round(analysisProgress * 100))}%
                </p>
                <p>系统会先生成可修改的识别结果，再根据你的偏好推荐洗护方案。</p>
              </IonCardContent>
            </IonCard>
          ) : null}

          {!loading && resumeHandled && step === 'report' && confirmedShoeData ? (
            <section className="stack-section report-step-shell">
              <IonCard className="surface-card report-media-card">
                <IonCardContent className="stack-section">
                  <div className="report-card-head">
                    <h3 style={{ margin: 0 }}>拍摄图</h3>
                  </div>
                  <div className="preview-frame report-media-main">
                    {activeReportImage ? (
                      <img alt={activeReportGuide.title} src={activeReportImage} />
                    ) : null}
                  </div>
                  <div className="report-media-toolbar">
                    <div>
                      <strong>{activeReportGuide.title}</strong>
                      <p className="muted">当前识别使用这张图片</p>
                    </div>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => {
                        setCaptureStep(activeReportImageIndex as CaptureStep);
                        setStep('capture');
                      }}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      重拍
                    </IonButton>
                  </div>
                  <div className="report-thumbnail-row">
                    {capturedImages.map((image, index) => (
                      <button
                        className={`report-thumbnail${
                          index === activeReportImageIndex ? ' is-active' : ''
                        }`}
                        key={CAPTURE_GUIDES[index].title}
                        onClick={() => setActiveReportImageIndex(index)}
                        type="button"
                      >
                        <div className="report-thumbnail__frame">
                          {image ? (
                            <img alt={CAPTURE_GUIDES[index].title} src={image || undefined} />
                          ) : null}
                        </div>
                        <span>{CAPTURE_GUIDES[index].title}</span>
                      </button>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <div className="report-card-head">
                    <div className="soft-badge">
                      <IonIcon icon={createOutline} />
                      可修改信息
                    </div>
                  </div>
                  <div className="report-edit-layout">
                    <div className="report-edit-grid">
                      <label className="report-edit-field">
                        <span>鞋子类型</span>
                        <IonInput
                          value={editableShoeType}
                          onIonInput={(e) => setEditableShoeType(e.detail.value || '')}
                        />
                      </label>
                      <label className="report-edit-field">
                        <span>品牌</span>
                        <IonInput
                          value={editableBrand}
                          onIonInput={(e) => setEditableBrand(e.detail.value || '')}
                        />
                      </label>
                      <label className="report-edit-field report-edit-field--wide">
                        <span>型号</span>
                        <IonInput
                          value={editableModel}
                          onIonInput={(e) => setEditableModel(e.detail.value || '')}
                        />
                      </label>
                    </div>
                    <div className="report-edit-grid">
                      <label className="report-edit-field">
                        <span>磨损情况</span>
                        <IonSelect
                          interface="popover"
                          value={editableWearLevel}
                          onIonChange={(e) =>
                            setEditableWearLevel(e.detail.value as ShoeConditionLevel)
                          }
                        >
                          {WEAR_OPTIONS.map((item) => (
                            <IonSelectOption key={item} value={item}>
                              {item}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </label>
                      <label className="report-edit-field">
                        <span>{confirmedShoeData.materials[0]?.part || '鞋面'}材质</span>
                        <IonInput
                          value={editableUpperMaterial}
                          onIonInput={(e) => setEditableUpperMaterial(e.detail.value || '')}
                        />
                      </label>
                      <label className="report-edit-field report-edit-field--wide">
                        <span>{confirmedShoeData.materials[1]?.part || '关键部位'}材质</span>
                        <IonInput
                          value={editableDetailMaterial}
                          onIonInput={(e) => setEditableDetailMaterial(e.detail.value || '')}
                        />
                      </label>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <div className="report-card-head">
                    <div className="soft-badge">
                      <IonIcon icon={shieldCheckmarkOutline} />
                      识别参考
                    </div>
                  </div>
                  <div className="report-score-grid">
                    <div className="report-score-card">
                      <div className="report-score-card__top">
                        <span>识别置信度</span>
                        <strong>{confirmedShoeData.confidence}%</strong>
                      </div>
                      <IonProgressBar value={confirmedShoeData.confidence / 100} />
                    </div>
                    <div className="report-score-card">
                      <div className="report-score-card__top">
                        <span>焕新指数</span>
                        <strong>{confirmedShoeData.renewalScore} / 100</strong>
                      </div>
                      <IonProgressBar value={confirmedShoeData.renewalScore / 100} />
                    </div>
                  </div>
                  <div className="report-reference-grid">
                    <div className="report-reference-tile">
                      <span>预计耗时</span>
                      <strong>{confirmedShoeData.estimatedTurnaround}</strong>
                    </div>
                    <div className="report-reference-tile report-reference-tile--wide">
                      <span>处理建议</span>
                      <strong>{confirmedShoeData.careTip}</strong>
                    </div>
                    <div className="report-reference-summary">
                      <span>综合鞋况说明</span>
                      <p>{confirmedShoeData.conditionSummary}</p>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent className="stack-section">
                  <div className="report-card-head">
                    <div>
                      <h3 style={{ margin: 0 }}>推荐设置</h3>
                      <p className="muted" style={{ margin: '6px 0 0' }}>
                        选择系统更偏向的方案方向，门店会随推荐方案自动确定。
                      </p>
                    </div>
                  </div>
                  <IonSegment
                    className="report-segment"
                    scrollable
                    value={servicePreference}
                    onIonChange={(e) => {
                      const nextPreference = e.detail.value as ServicePreference;
                      setServicePreference(nextPreference);
                      setFormData((prev) => ({
                        ...prev,
                        servicePreference: nextPreference,
                      }));
                    }}
                  >
                    {PREFERENCE_OPTIONS.map((option) => (
                      <IonSegmentButton key={option.value} value={option.value}>
                        <IonLabel>{option.label}</IonLabel>
                      </IonSegmentButton>
                    ))}
                  </IonSegment>
                  <p className="muted report-segment-hint">
                    当前偏好：{
                      PREFERENCE_OPTIONS.find((option) => option.value === servicePreference)
                        ?.hint
                    }
                  </p>
                </IonCardContent>
              </IonCard>

              <StickyActionBar>
                <IonButton expand="block" shape="round" onClick={handleOpenRecommendationResult}>
                  查看推荐结果
                  <IonIcon icon={arrowForwardOutline} slot="end" />
                </IonButton>
              </StickyActionBar>
            </section>
          ) : null}

          {!loading && resumeHandled && step === 'payment' ? (
            <section className="stack-section payment-step-shell">
              <IonCard className="surface-card payment-panel payment-panel--discount">
                <IonCardContent className="stack-section">
                  <div className="payment-panel__head">
                    <div>
                      <div className="soft-badge">
                        <IonIcon icon={checkmarkCircleOutline} />
                        优惠选择
                      </div>
                      <p className="muted" style={{ margin: '8px 0 0' }}>
                        默认已采用当前最优优惠，你也可以在这里改选。
                      </p>
                    </div>
                  </div>
                  <div className="discount-ticket-list">
                    {eligibleDiscounts.map((discount) => (
                      <button
                        className={`discount-ticket${
                          selectedDiscountId === discount.id ? ' is-selected' : ''
                        }`}
                        key={discount.id}
                        onClick={() => setSelectedDiscountId(discount.id)}
                        type="button"
                      >
                        <div className="discount-ticket__copy">
                          <strong>{discount.title}</strong>
                          <p>{discount.description}</p>
                        </div>
                        <div className="discount-ticket__meta">
                          <span>{discount.rate} 折</span>
                          <em>{selectedDiscountId === discount.id ? '当前使用' : '可切换'}</em>
                        </div>
                      </button>
                    ))}
                    {!eligibleDiscounts.length ? (
                      <div className="discount-ticket discount-ticket--empty">
                        <strong>当前暂无可用优惠</strong>
                        <p>本次支付将按预估原价结算。</p>
                      </div>
                    ) : null}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card payment-panel payment-panel--method">
                <IonCardContent className="stack-section">
                  <div className="payment-panel__head">
                    <div>
                      <div className="soft-badge">
                        <IonIcon icon={checkmarkCircleOutline} />
                        支付方式
                      </div>
                      <p className="muted" style={{ margin: '8px 0 0' }}>
                        先选择支付方式，下一步会进入独立扫码支付页。
                      </p>
                    </div>
                  </div>
                  <div className="payment-method-grid">
                    <button
                      className={`payment-method-card${
                        selectedPaymentMethod === 'alipay' ? ' is-selected' : ''
                      }`}
                      onClick={() => setSelectedPaymentMethod('alipay')}
                      type="button"
                    >
                      <span className="payment-method-card__badge">Alipay</span>
                      <strong>支付宝</strong>
                      <p>适合手机扫码快速支付</p>
                    </button>
                    <button
                      className={`payment-method-card${
                        selectedPaymentMethod === 'wechat' ? ' is-selected' : ''
                      }`}
                      onClick={() => setSelectedPaymentMethod('wechat')}
                      type="button"
                    >
                      <span className="payment-method-card__badge">WeChat</span>
                      <strong>微信支付</strong>
                      <p>进入扫码页后统一承载，后续可单独接通</p>
                    </button>
                  </div>
                  <div className="payment-order-summary">
                    <div>
                      <span>订单信息</span>
                      <strong>{summarizeOrderInfo(formData) || '未确认订单信息'}</strong>
                    </div>
                    <div>
                      <span>当前方案</span>
                      <strong>
                        {selectedPlan?.title || '--'} · {selectedPlan?.shopName || '--'}
                      </strong>
                    </div>
                  </div>
                  {paymentNeedsReprice ? (
                    <div className="payment-warning">
                      <strong>订单信息已变化</strong>
                      <p>当前资料会影响服务距离或覆盖范围，请先返回结果页重新生成推荐方案后再支付。</p>
                    </div>
                  ) : null}
                </IonCardContent>
              </IonCard>

              <div className="payment-action-dock">
                <div className="payment-action-dock__inner">
                  <div className="payment-action-dock__price">
                    <strong>¥{getFinalPrice()}</strong>
                    <span>
                      {paymentNeedsReprice
                        ? '订单资料已变更，需先重算'
                        : `${selectedPlan?.title || '--'} · ${selectedPlan?.estimatedTurnaround || '--'}`}
                    </span>
                  </div>
                  <LoadingButton
                    loading={paymentLoading}
                    onClick={
                      paymentNeedsReprice
                        ? handleReturnForReprice
                        : () => {
                            const snapshot = buildResultSnapshot();
                            if (snapshot) {
                              saveOrderResultSnapshot(snapshot);
                            }
                            history.push('/app/order/pay');
                          }
                    }
                    shape="round"
                  >
                    {paymentNeedsReprice ? '返回结果页重算' : '去扫码支付'}
                  </LoadingButton>
                </div>
              </div>
            </section>
          ) : null}

          {!loading && resumeHandled && step === 'success' ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={checkmarkCircleOutline} />
                    支付成功
                  </div>
                  <h2 style={{ margin: 0 }}>订单已提交，等待上门取鞋</h2>
                  <p>
                    订单号 {orderId}
                    <br />
                    {selectedPlan?.shopName || '推荐门店'} · {selectedPlan?.title || '已锁定方案'}
                    <br />
                    取件地址 {formData.address}
                  </p>
                  <div className="feature-item">
                    <strong>后续流程</strong>
                    <p>平台先上门取鞋，再结合人工与 AI 双重确价并匹配最优洗鞋店，多退少补。</p>
                  </div>
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

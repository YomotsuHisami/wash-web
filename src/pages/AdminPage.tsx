import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
} from '@ionic/react';
import {
  addOutline,
  closeOutline,
  createOutline,
  eyeOutline,
  lockClosedOutline,
  logOutOutline,
  trashOutline,
} from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchAdminStatus, loginAdmin, setupAdminPassword, verifyAdminToken } from '../api/admin';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import {
  deleteServerOrder,
  appendServerOrderProgress,
  fetchAdminOrders,
} from '../api/orders';
import { apiRequest } from '../api/client';
import AdminFormModal from '../components/admin/AdminFormModal';
import CardSkeleton from '../components/common/CardSkeleton';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import {
  Discount,
  OrderStatus,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  ServerOrder,
  Shop,
  normalizeOrderStatus,
} from '../models/domain';
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '../utils/storage';

type AdminTab = 'orders' | 'shops' | 'discounts';

const emptyShop = { id: '', name: '', address: '' };
const emptyDiscount: Partial<Discount> = {
  title: '',
  description: '',
  rate: 80,
  startTime: '',
  endTime: '',
  imageUrl: '',
  applicableGroup: 'all',
  mode: 'normal',
};
const PROGRESS_STATUS_OPTIONS = ORDER_STATUS_FLOW.filter((status) => status !== 'pending_payment');

export default function AdminPage() {
  const history = useHistory();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setTokenState] = useState(getAdminToken());
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<ServerOrder[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [mutatingOrderId, setMutatingOrderId] = useState('');
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [shopDraft, setShopDraft] = useState(emptyShop);
  const [discountDraft, setDiscountDraft] = useState<Partial<Discount>>(emptyDiscount);
  const [shopSaving, setShopSaving] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [progressDraft, setProgressDraft] = useState<{
    orderId: string;
    status: OrderStatus;
    note: string;
    imageUrls: string[];
  }>({
    orderId: '',
    status: 'paid',
    note: '',
    imageUrls: [],
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const status = await fetchAdminStatus();
        if (!mounted) return;
        setIsSetup(status.isSetup);

        if (token) {
          try {
            await verifyAdminToken(token);
            if (mounted) {
              setIsAuthenticated(true);
            }
          } catch {
            clearAdminToken();
            setTokenState('');
          }
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    refreshOrders();
    refreshShops();
    refreshDiscounts();
  }, [isAuthenticated, token]);

  const refreshOrders = async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const nextOrders = await fetchAdminOrders(token);
      setOrders(nextOrders.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)));
    } finally {
      setOrdersLoading(false);
    }
  };

  const refreshShops = async () => {
    setShopsLoading(true);
    try {
      setShops(await fetchShops());
    } finally {
      setShopsLoading(false);
    }
  };

  const refreshDiscounts = async () => {
    setDiscountsLoading(true);
    try {
      setDiscounts(await fetchDiscounts());
    } finally {
      setDiscountsLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!password) {
      setAuthError('请输入密码。');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      if (isSetup) {
        const response = await loginAdmin(password);
        setAdminToken(response.token);
        setTokenState(response.token);
        setIsAuthenticated(true);
      } else {
        await setupAdminPassword(password);
        setIsSetup(true);
        setAuthError('密码设置成功，请使用它登录。');
      }
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后再试。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setTokenState('');
    setIsAuthenticated(false);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!token) return;
    setMutatingOrderId(orderId);
    try {
      await deleteServerOrder(orderId, token);
      await refreshOrders();
    } finally {
      setMutatingOrderId('');
    }
  };

  const saveShop = async () => {
    if (!token || !shopDraft.name.trim()) return;
    setShopSaving(true);
    try {
      if (shopDraft.id) {
        await apiRequest(`/api/shops/${shopDraft.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: shopDraft.name, address: shopDraft.address }),
        });
      } else {
        await apiRequest('/api/shops', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: shopDraft.name, address: shopDraft.address }),
        });
      }
      setShopModalOpen(false);
      setShopDraft(emptyShop);
      await refreshShops();
    } finally {
      setShopSaving(false);
    }
  };

  const deleteShop = async (shopId: string) => {
    if (!token) return;
    setShopSaving(true);
    try {
      await apiRequest(`/api/shops/${shopId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshShops();
    } finally {
      setShopSaving(false);
    }
  };

  const saveDiscount = async () => {
    if (!token || !discountDraft.title || !discountDraft.rate) return;
    setDiscountSaving(true);
    try {
      if (discountDraft.id) {
        await apiRequest(`/api/discounts/${discountDraft.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(discountDraft),
        });
      } else {
        await apiRequest('/api/discounts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(discountDraft),
        });
      }
      setDiscountModalOpen(false);
      setDiscountDraft(emptyDiscount);
      await refreshDiscounts();
    } finally {
      setDiscountSaving(false);
    }
  };

  const deleteDiscount = async (discountId: string) => {
    if (!token) return;
    setDiscountSaving(true);
    try {
      await apiRequest(`/api/discounts/${discountId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshDiscounts();
    } finally {
      setDiscountSaving(false);
    }
  };

  const openPreview = (images: string[]) => {
    if (images.length === 0) return;
    setPreviewImages(images);
  };

  const closePreview = () => setPreviewImages([]);

  const getOrderImages = (order: ServerOrder) =>
    [...(order.imageUrls || []), order.imageUrl]
      .filter((value, index, list): value is string => typeof value === 'string' && list.indexOf(value) === index);

  const openProgressModal = (order: ServerOrder) => {
    setProgressError('');
    setProgressDraft({
      orderId: order.id,
      status: normalizeOrderStatus(order.status),
      note: '',
      imageUrls: [],
    });
    setProgressModalOpen(true);
  };

  const handleProgressImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProgressError('');
    try {
      const nextImages = await Promise.all(
        Array.from(files)
          .slice(0, 4)
          .map((file) => compressImageToDataUrl(file))
      );

      setProgressDraft((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...nextImages].slice(0, 4),
      }));
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : '阶段图片处理失败。');
    }
  };

  const saveOrderProgress = async () => {
    if (!token || !progressDraft.orderId) return;
    setProgressError('');
    setProgressSaving(true);
    setMutatingOrderId(progressDraft.orderId);
    try {
      await appendServerOrderProgress(
        progressDraft.orderId,
        {
          status: progressDraft.status,
          note: progressDraft.note,
          imageUrls: progressDraft.imageUrls,
        },
        token
      );
      setProgressModalOpen(false);
      setProgressDraft({
        orderId: '',
        status: 'paid',
        note: '',
        imageUrls: [],
      });
      await refreshOrders();
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : '保存进度失败，请稍后再试。');
    } finally {
      setProgressSaving(false);
      setMutatingOrderId('');
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="device-shell">
          <PageHeader
            eyebrow="ADMIN"
            title="管理后台"
            subtitle="订单、店铺和活动都集中在这里，手机上也能直接处理。"
            onBack={() => history.goBack()}
            action={
              isAuthenticated ? (
                <IonButton fill="clear" onClick={handleLogout}>
                  <IonIcon icon={logOutOutline} slot="start" />
                  退出
                </IonButton>
              ) : null
            }
          />

          {checking ? (
            <CardSkeleton repeat={2} lines={4} />
          ) : !isAuthenticated ? (
            <IonCard className="surface-card hero-card">
              <IonCardContent className="stack-section">
                <div className="soft-badge">
                  <IonIcon icon={lockClosedOutline} />
                  {isSetup ? '管理员登录' : '初始化管理员密码'}
                </div>
                <IonItem className="field-item">
                  <IonLabel position="stacked">密码</IonLabel>
                  <IonInput
                    type="password"
                    value={password}
                    onIonInput={(event) => setPassword(event.detail.value || '')}
                  />
                </IonItem>
                {authError ? (
                  <IonText color={authError.includes('成功') ? 'success' : 'danger'}>
                    <p className="form-message">{authError}</p>
                  </IonText>
                ) : null}
                <LoadingButton expand="block" loading={authLoading} onClick={handleAuth} shape="round">
                  {isSetup ? '登录后台' : '设置密码'}
                </LoadingButton>
              </IonCardContent>
            </IonCard>
          ) : (
            <section className="stack-section">
              <IonSegment
                className="capsule-segment"
                value={activeTab}
                onIonChange={(event) => setActiveTab(event.detail.value as AdminTab)}
              >
                <IonSegmentButton value="orders">
                  <IonLabel>订单</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="shops">
                  <IonLabel>店铺</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="discounts">
                  <IonLabel>折扣</IonLabel>
                </IonSegmentButton>
              </IonSegment>

              {activeTab === 'orders' ? (
                ordersLoading ? (
                  <CardSkeleton repeat={2} lines={5} />
                ) : (
                  <div className="stack-section compact-order-list">
                    {orders.map((order) => (
                      <IonCard className="surface-card compact-order-card compact-order-card--admin" key={order.id}>
                        <IonCardContent className="compact-order-card__content">
                          <div className="compact-order-card__top">
                            <div className="compact-order-card__main">
                              <div className="compact-order-card__title-row">
                                <h3>{order.userName || order.customerInfo?.name || '未命名用户'}</h3>
                                <StatusBadge status={normalizeOrderStatus(order.status)} />
                              </div>
                              <p className="compact-order-card__meta">
                                订单号 {order.id} · {new Date(order.createdAt).toLocaleString('zh-CN')}
                              </p>
                            </div>
                          </div>
                          <div className="compact-order-card__grid">
                            <div>
                              <strong>鞋款信息</strong>
                              <p className="compact-order-card__text">
                                {(order.analysisResult || order.shoeData)?.brand} {(order.analysisResult || order.shoeData)?.model}
                              </p>
                              <p className="compact-order-card__text compact-order-card__text--single">
                                {(order.userAddress || order.customerInfo?.address) ?? ''}
                              </p>
                            </div>
                            <div>
                              <strong>订单金额</strong>
                              <p className="compact-order-card__text">¥{order.price || order.totalPrice}</p>
                            </div>
                          </div>
                          {getOrderImages(order).length > 0 ? (
                            <IonButton
                              className="compact-order-card__preview-btn"
                              fill="outline"
                              shape="round"
                              onClick={() => openPreview(getOrderImages(order))}
                            >
                              <IonIcon icon={eyeOutline} slot="start" />
                              预览图片
                            </IonButton>
                          ) : null}
                          <IonButton
                            className="compact-order-card__preview-btn"
                            fill="outline"
                            shape="round"
                            onClick={() => openProgressModal(order)}
                          >
                            <IonIcon icon={createOutline} slot="start" />
                            更新进度
                          </IonButton>
                          <LoadingButton
                            color="danger"
                            expand="block"
                            fill="outline"
                            loading={mutatingOrderId === order.id}
                            onClick={() => handleDeleteOrder(order.id)}
                            shape="round"
                          >
                            <IonIcon icon={trashOutline} slot="start" />
                            删除订单
                          </LoadingButton>
                        </IonCardContent>
                      </IonCard>
                    ))}
                  </div>
                )
              ) : null}

              {activeTab === 'shops' ? (
                <section className="stack-section">
                  <IonButton
                    fill="outline"
                    shape="round"
                    onClick={() => {
                      setShopDraft(emptyShop);
                      setShopModalOpen(true);
                    }}
                  >
                    <IonIcon icon={addOutline} slot="start" />
                    新增店铺
                  </IonButton>
                  {shopsLoading ? (
                    <CardSkeleton repeat={2} lines={4} />
                  ) : (
                    shops.map((shop) => (
                      <IonCard className="surface-card" key={shop.id}>
                        <IonCardContent className="stack-section">
                          <div>
                            <h3 style={{ margin: 0 }}>{shop.name}</h3>
                            <p className="muted">{shop.address || '未填写地址'}</p>
                          </div>
                          <div className="inline-actions">
                            <IonButton
                              fill="outline"
                              shape="round"
                              onClick={() => {
                                setShopDraft(shop);
                                setShopModalOpen(true);
                              }}
                            >
                              <IonIcon icon={createOutline} slot="start" />
                              编辑
                            </IonButton>
                            <LoadingButton
                              color="danger"
                              fill="outline"
                              loading={shopSaving}
                              onClick={() => deleteShop(shop.id)}
                              shape="round"
                            >
                              <IonIcon icon={trashOutline} slot="start" />
                              删除
                            </LoadingButton>
                          </div>
                        </IonCardContent>
                      </IonCard>
                    ))
                  )}
                </section>
              ) : null}

              {activeTab === 'discounts' ? (
                <section className="stack-section">
                  <IonButton
                    fill="outline"
                    shape="round"
                    onClick={() => {
                      setDiscountDraft(emptyDiscount);
                      setDiscountModalOpen(true);
                    }}
                  >
                    <IonIcon icon={addOutline} slot="start" />
                    新增折扣
                  </IonButton>
                  {discountsLoading ? (
                    <CardSkeleton repeat={2} lines={5} />
                  ) : (
                    discounts.map((discount) => (
                      <IonCard className="surface-card" key={discount.id}>
                        <IonCardContent className="stack-section">
                          {discount.imageUrl ? (
                            <div className="preview-frame">
                              <img alt={discount.title} src={discount.imageUrl} />
                            </div>
                          ) : null}
                          <div>
                            <h3 style={{ margin: 0 }}>{discount.title}</h3>
                            <p className="muted">
                              {(discount.rate / 10).toFixed(1).replace(/\.0$/, '')} 折 · {discount.applicableGroup}
                              <br />
                              {discount.description || '暂无补充说明'}
                            </p>
                          </div>
                          <div className="inline-actions">
                            <IonButton
                              fill="outline"
                              shape="round"
                              onClick={() => {
                                setDiscountDraft(discount);
                                setDiscountModalOpen(true);
                              }}
                            >
                              <IonIcon icon={createOutline} slot="start" />
                              编辑
                            </IonButton>
                            <LoadingButton
                              color="danger"
                              fill="outline"
                              loading={discountSaving}
                              onClick={() => deleteDiscount(discount.id)}
                              shape="round"
                            >
                              <IonIcon icon={trashOutline} slot="start" />
                              删除
                            </LoadingButton>
                          </div>
                        </IonCardContent>
                      </IonCard>
                    ))
                  )}
                </section>
              ) : null}
            </section>
          )}
        </div>

        <AdminFormModal
          isOpen={progressModalOpen}
          onDismiss={() => setProgressModalOpen(false)}
          title="更新订单进度"
        >
          <div className="modal-form">
            <IonItem className="field-item">
              <IonLabel position="stacked">阶段状态</IonLabel>
              <IonSelect
                value={progressDraft.status}
                onIonChange={(event) =>
                  setProgressDraft((prev) => ({
                    ...prev,
                    status: event.detail.value as OrderStatus,
                  }))
                }
              >
                {PROGRESS_STATUS_OPTIONS.map((status) => (
                  <IonSelectOption key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">阶段说明</IonLabel>
              <IonTextarea
                autoGrow
                value={progressDraft.note}
                onIonInput={(event) =>
                  setProgressDraft((prev) => ({
                    ...prev,
                    note: event.detail.value || '',
                  }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">上传阶段图片</IonLabel>
              <input
                accept="image/*"
                multiple
                onChange={(event) => handleProgressImages(event.target.files)}
                type="file"
              />
            </IonItem>
            {progressError ? (
              <IonText color="danger">
                <p className="form-message">{progressError}</p>
              </IonText>
            ) : null}
            {progressDraft.imageUrls.length > 0 ? (
              <div className="admin-progress-preview-grid">
                {progressDraft.imageUrls.map((image, index) => (
                  <div className="admin-progress-preview-frame" key={`${image}-${index}`}>
                    <img alt={`阶段图片 ${index + 1}`} src={image} />
                  </div>
                ))}
              </div>
            ) : null}
            <LoadingButton expand="block" loading={progressSaving} onClick={saveOrderProgress} shape="round">
              保存进度
            </LoadingButton>
          </div>
        </AdminFormModal>

        <AdminFormModal
          isOpen={shopModalOpen}
          onDismiss={() => setShopModalOpen(false)}
          title={shopDraft.id ? '编辑店铺' : '新增店铺'}
        >
          <div className="modal-form">
            <IonItem className="field-item">
              <IonLabel position="stacked">店铺名称</IonLabel>
              <IonInput
                value={shopDraft.name}
                onIonInput={(event) =>
                  setShopDraft((prev) => ({ ...prev, name: event.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">店铺地址</IonLabel>
              <IonInput
                value={shopDraft.address}
                onIonInput={(event) =>
                  setShopDraft((prev) => ({ ...prev, address: event.detail.value || '' }))
                }
              />
            </IonItem>
            <LoadingButton expand="block" loading={shopSaving} onClick={saveShop} shape="round">
              保存店铺
            </LoadingButton>
          </div>
        </AdminFormModal>

        <AdminFormModal
          isOpen={discountModalOpen}
          onDismiss={() => setDiscountModalOpen(false)}
          title={discountDraft.id ? '编辑折扣' : '新增折扣'}
        >
          <div className="modal-form">
            <IonItem className="field-item">
              <IonLabel position="stacked">标题</IonLabel>
              <IonInput
                value={discountDraft.title || ''}
                onIonInput={(event) =>
                  setDiscountDraft((prev) => ({ ...prev, title: event.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">说明</IonLabel>
              <IonTextarea
                autoGrow
                value={discountDraft.description || ''}
                onIonInput={(event) =>
                  setDiscountDraft((prev) => ({ ...prev, description: event.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">折扣百分比</IonLabel>
              <IonInput
                type="number"
                value={discountDraft.rate || 80}
                onIonInput={(event) =>
                  setDiscountDraft((prev) => ({
                    ...prev,
                    rate: Number(event.detail.value || 80),
                  }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">图片地址</IonLabel>
              <IonInput
                value={discountDraft.imageUrl || ''}
                onIonInput={(event) =>
                  setDiscountDraft((prev) => ({ ...prev, imageUrl: event.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">适用人群</IonLabel>
              <IonSelect
                value={discountDraft.applicableGroup || 'all'}
                onIonChange={(event) =>
                  setDiscountDraft((prev) => ({
                    ...prev,
                    applicableGroup: event.detail.value,
                  }))
                }
              >
                <IonSelectOption value="all">所有用户</IonSelectOption>
                <IonSelectOption value="normal">普通用户</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">折扣模式</IonLabel>
              <IonSelect
                value={discountDraft.mode || 'normal'}
                onIonChange={(event) =>
                  setDiscountDraft((prev) => ({ ...prev, mode: event.detail.value }))
                }
              >
                <IonSelectOption value="normal">普通折扣</IonSelectOption>
                <IonSelectOption value="first_order">首单优惠</IonSelectOption>
              </IonSelect>
            </IonItem>
            <LoadingButton expand="block" loading={discountSaving} onClick={saveDiscount} shape="round">
              保存折扣
            </LoadingButton>
          </div>
        </AdminFormModal>

        <IonModal isOpen={previewImages.length > 0} onDidDismiss={closePreview}>
          <IonContent className="modal-content">
            <div className="device-shell">
              <div className="image-preview-modal__top">
                <div>
                  <p className="page-eyebrow">ORDER IMAGES</p>
                  <h2 style={{ margin: 0 }}>订单图片预览</h2>
                </div>
                <IonButton fill="clear" onClick={closePreview}>
                  <IonIcon icon={closeOutline} slot="icon-only" />
                </IonButton>
              </div>
              <div className="image-preview-modal__grid">
                {previewImages.map((image, index) => (
                  <div className="image-preview-modal__frame" key={`${image}-${index}`}>
                    <img alt={`订单图片 ${index + 1}`} src={image} />
                  </div>
                ))}
              </div>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

function compressImageToDataUrl(file: File, options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}) {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.76 } = options;

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取阶段图片失败'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('加载阶段图片失败'));
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
          reject(new Error('无法处理阶段图片'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

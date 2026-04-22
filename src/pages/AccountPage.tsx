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
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
} from '@ionic/react';
import {
  lockClosedOutline,
  logOutOutline,
  personCircleOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import {
  fetchUserProfile,
  loginUser,
  registerUser,
  updateOrderInfos,
  updatePassword,
} from '../api/users';
import OrderInfoManager from '../components/account/OrderInfoManager';
import AuthPanel from '../components/account/AuthPanel';
import AppLoadingOverlay from '../components/common/AppLoadingOverlay';
import CardSkeleton from '../components/common/CardSkeleton';
import CompactPromoTile from '../components/common/CompactPromoTile';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import { brandConfig } from '../config/brand';
import { campaignAssets, resolveDiscountImage } from '../config/campaigns';
import { Discount, SavedOrderInfo, Shop, UserProfile, isDiscountActive } from '../models/domain';
import { clearStoredUser, getStoredUser, setStoredUser } from '../utils/storage';
import {
  getDefaultOrderInfo,
  getOrderInfos,
  getSelectedOrderInfo,
  hasRequiredOrderInfo,
  migrateUserProfileOrderInfos,
} from '../utils/orderInfoUtils';

export default function AccountPage() {
  const history = useHistory();
  const location = useLocation();
  const returnTo = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('returnTo');
    return raw ? decodeURIComponent(raw) : '';
  }, [location.search]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedOrderInfoId, setSelectedOrderInfoId] = useState<string>('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const navigateBackToFlow = (profile: UserProfile) => {
    const defaultOrderInfo = getDefaultOrderInfo(profile);
    if (!returnTo || !hasRequiredOrderInfo(defaultOrderInfo)) return;
    history.replace(returnTo);
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
            setStoredUser(profile);
          } catch {
            clearStoredUser();
          }
        }

        if (mounted) {
          setCurrentUser(profile);
          setSelectedOrderInfoId(
            getDefaultOrderInfo(profile)?.id || getOrderInfos(profile)[0]?.id || ''
          );
          setShops(nextShops);
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

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!username || !password) {
      setAuthError('请输入用户名和密码。');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setAuthError('两次输入的密码不一致。');
      return;
    }

    setAuthLoading(true);

    try {
      const profile =
        mode === 'login'
          ? migrateUserProfileOrderInfos(await loginUser(username, password))
          : migrateUserProfileOrderInfos(await registerUser(username, password));
      setCurrentUser(profile);
      setStoredUser(profile);
      setSelectedOrderInfoId(
        getDefaultOrderInfo(profile)?.id || getOrderInfos(profile)[0]?.id || ''
      );
      setPassword('');
      setConfirmPassword('');
      if (returnTo && !hasRequiredOrderInfo(getDefaultOrderInfo(profile))) {
        setAuthSuccess('账号已就绪，请先补全默认订单资料后继续下单。');
      } else {
        setAuthSuccess(mode === 'login' ? '登录成功。' : '注册成功，已自动登录。');
      }
      navigateBackToFlow(profile);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后重试。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredUser();
    setCurrentUser(null);
    setSelectedOrderInfoId('');
    setAuthError('');
    setAuthSuccess('');
  };

  const handleOrderInfosChange = async (
    nextOrderInfos: SavedOrderInfo[],
    nextDefaultInfoId?: string | null,
    nextSelectedId?: string | null
  ) => {
    if (!currentUser) return;

    setProfileLoading(true);
    setProfileMessage('');

    try {
      const profile = migrateUserProfileOrderInfos(
        await updateOrderInfos(currentUser.id, {
          orderInfos: nextOrderInfos,
          defaultInfoId: nextDefaultInfoId || nextOrderInfos[0]?.id || '',
        })
      );
      setCurrentUser(profile);
      setStoredUser(profile);
      setSelectedOrderInfoId(
        nextSelectedId ||
          nextDefaultInfoId ||
          getSelectedOrderInfo(profile, selectedOrderInfoId)?.id ||
          getDefaultOrderInfo(profile)?.id ||
          ''
      );
      setProfileMessage(
        returnTo
          ? '默认资料已保存，正在返回下单流程。'
          : '默认资料已保存，下单时会自动回填。'
      );
      navigateBackToFlow(profile);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOrderInfoSave = async ({
    orderInfo,
    mode,
    setAsDefault,
  }: {
    orderInfo: SavedOrderInfo;
    mode: 'create' | 'edit';
    setAsDefault: boolean;
  }) => {
    const orderInfos = getOrderInfos(currentUser);
    const nextOrderInfos =
      mode === 'create'
        ? [...orderInfos, orderInfo]
        : orderInfos.map((item) => (item.id === orderInfo.id ? orderInfo : item));
    const nextDefaultInfoId =
      setAsDefault || !currentUser?.defaultInfoId
        ? orderInfo.id
        : currentUser.defaultInfoId;
    await handleOrderInfosChange(nextOrderInfos, nextDefaultInfoId, orderInfo.id);
  };

  const handleSetDefaultOrderInfo = async (id: string) => {
    await handleOrderInfosChange(getOrderInfos(currentUser), id, id);
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;

    setPasswordMessage('');

    if (!oldPassword || !newPassword) {
      setPasswordMessage('请输入原密码和新密码。');
      return;
    }
    if (newPassword !== passwordConfirm) {
      setPasswordMessage('两次输入的新密码不一致。');
      return;
    }

    setPasswordLoading(true);

    try {
      await updatePassword(currentUser.id, oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setPasswordConfirm('');
      setPasswordMessage('密码修改成功。');
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : '修改失败，请稍后再试。');
    } finally {
      setPasswordLoading(false);
    }
  };

  const vipPromo =
    discounts.find((discount) => discount.applicableGroup === 'vip') || null;
  const orderInfos = getOrderInfos(currentUser);

  return (
    <IonPage>
      <IonContent fullscreen>
        <AppLoadingOverlay isOpen={loading} message="正在恢复账户状态..." />
        <div className="device-shell">
          <PageHeader
            eyebrow="ACCOUNT"
            title="我的"
            action={
              currentUser ? (
                <IonButton fill="clear" onClick={handleLogout}>
                  <IonIcon icon={logOutOutline} slot="start" />
                  退出
                </IonButton>
              ) : null
            }
          />

          {loading ? (
            <CardSkeleton repeat={2} lines={4} />
          ) : !currentUser ? (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={personCircleOutline} />
                    登录后可保存默认资料和会员状态
                  </div>
                  {returnTo ? (
                    <p className="muted" style={{ margin: 0 }}>
                      继续下单前，需要先登录账号并补全默认订单资料。
                    </p>
                  ) : null}
                  <AuthPanel
                    confirmPassword={confirmPassword}
                    error={authError}
                    loading={authLoading}
                    mode={mode}
                    onConfirmPasswordChange={setConfirmPassword}
                    onModeChange={setMode}
                    onPasswordChange={setPassword}
                    onSubmit={handleAuthSubmit}
                    onUsernameChange={setUsername}
                    password={password}
                    success={authSuccess}
                    username={username}
                  />
                </IonCardContent>
              </IonCard>

              <CompactPromoTile
                badge="MEMBER"
                body="登录后可以保存资料，也能直接开通会员并使用会员折扣。"
                imageUrl={resolveDiscountImage(vipPromo, campaignAssets.membership)}
                meta="资料和权益会跟着账号保留"
                onClick={() => history.push('/membership')}
                title={brandConfig.membershipName}
              />
            </section>
          ) : (
            <section className="stack-section">
              <IonCard className="surface-card hero-card">
                <IonCardContent className="stack-section">
                  <div className="soft-badge">
                    <IonIcon icon={sparklesOutline} />
                    当前身份：{currentUser.group === 'vip' ? '会员' : '普通用户'}
                  </div>
                  <h2 style={{ margin: 0 }}>{currentUser.username}</h2>
                  <p>
                    常用地址、电话和门店都可以保存在这里，下次下单会直接带出。
                    {returnTo ? ' 当前下单流程会直接读取这里的默认资料。' : ''}
                  </p>
                  <div className="inline-actions">
                    <IonButton shape="round" onClick={() => history.push('/membership')}>
                      {currentUser.group === 'vip' ? '查看会员权益' : '立即开通会员'}
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent>
                  <div className="stack-section">
                    <div>
                      <p className="page-eyebrow">ORDER INFOS</p>
                      <h3 style={{ marginTop: 0 }}>订单资料管理</h3>
                    </div>
                    <OrderInfoManager
                      defaultInfoId={currentUser?.defaultInfoId}
                      onSave={handleOrderInfoSave}
                      onSelect={setSelectedOrderInfoId}
                      onSetDefault={handleSetDefaultOrderInfo}
                      orderInfos={orderInfos}
                      saveButtonLabel="保存资料"
                      saving={profileLoading}
                      selectedOrderInfoId={selectedOrderInfoId}
                      shops={shops}
                      subtitle="保存多份常用资料，支付时可以直接切换。"
                      title="订单资料"
                    />
                    {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent>
                  <form className="stack-section" onSubmit={handlePasswordSave}>
                    <div>
                      <p className="page-eyebrow">PASSWORD</p>
                      <h3 style={{ marginTop: 0 }}>修改密码</h3>
                    </div>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">原密码</IonLabel>
                      <IonInput
                        type="password"
                        value={oldPassword}
                        onIonInput={(e) => setOldPassword(e.detail.value || '')}
                      />
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">新密码</IonLabel>
                      <IonInput
                        type="password"
                        value={newPassword}
                        onIonInput={(e) => setNewPassword(e.detail.value || '')}
                      />
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">确认新密码</IonLabel>
                      <IonInput
                        type="password"
                        value={passwordConfirm}
                        onIonInput={(e) => setPasswordConfirm(e.detail.value || '')}
                      />
                    </IonItem>
                    {passwordMessage ? (
                      <IonText color={passwordMessage.includes('成功') ? 'success' : 'danger'}>
                        <p className="form-message">{passwordMessage}</p>
                      </IonText>
                    ) : null}
                    <LoadingButton expand="block" loading={passwordLoading} shape="round" type="submit">
                      <IonIcon icon={lockClosedOutline} slot="start" />
                      保存新密码
                    </LoadingButton>
                  </form>
                </IonCardContent>
              </IonCard>

              <CompactPromoTile
                badge={currentUser.group === 'vip' ? 'VIP' : 'MEMBER'}
                body={
                  currentUser.group === 'vip'
                    ? '你当前已是会员，下单时会优先匹配会员可用折扣。'
                    : '开通后即可使用会员折扣，后续活动也会优先开放给会员。'
                }
                imageUrl={resolveDiscountImage(vipPromo, campaignAssets.membership)}
                meta={currentUser.group === 'vip' ? '当前权益可直接使用' : '开通后立即生效'}
                onClick={() => history.push('/membership')}
                title={brandConfig.membershipName}
              />
            </section>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

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
  chevronDownOutline,
  chevronUpOutline,
  lockClosedOutline,
  logOutOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
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
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import { SavedOrderInfo, UserProfile } from '../models/domain';
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
  const [showWorkbenchPanel, setShowWorkbenchPanel] = useState(true);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
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

  const orderInfos = getOrderInfos(currentUser);
  const defaultOrderInfo = getDefaultOrderInfo(currentUser);
  const securityNotes = [
    '建议把密码和常用购物账号区分开，降低撞库风险。',
    '资料保存后，下单流程会直接读取默认资料，减少重复输入。',
  ];

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
            <section className="stack-section account-page account-page--guest">
              <IonCard className="surface-card account-auth-card">
                <IonCardContent className="stack-section">
                  <div className="account-auth-card__intro">
                    <div>
                      <p className="page-eyebrow">ACCOUNT ACCESS</p>
                      <h3>登录后保存资料、切换场景、直接回填</h3>
                    </div>
                    <div className="account-auth-card__chips">
                      <span>多地址</span>
                      <span>多门店</span>
                      <span>默认回填</span>
                    </div>
                  </div>
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
            </section>
          ) : (
            <section className="stack-section account-page">
              <IonCard className="surface-card hero-card account-hero-card">
                <IonCardContent className="stack-section">
                  <div className="account-profile-head">
                    <div className="account-profile-avatar" aria-hidden="true">
                      {currentUser.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="account-profile-intro">
                      <h2 style={{ margin: 0 }}>{currentUser.username}</h2>
                      <p className="account-profile-intro__meta">
                        {defaultOrderInfo?.label || '还没有默认资料'}
                        {returnTo ? ' · 当前下单会读取默认资料' : ''}
                      </p>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              <section className="result-panel result-panel--disclosure account-disclosure-panel account-workbench-card">
                <button
                  className="result-inline-toggle"
                  onClick={() => setShowWorkbenchPanel((prev) => !prev)}
                  type="button"
                >
                  <span>资料工作台</span>
                  <div className="account-disclosure-inline-meta">
                    <span>{orderInfos.length} 份资料</span>
                    <IonIcon icon={showWorkbenchPanel ? chevronUpOutline : chevronDownOutline} />
                  </div>
                </button>
                {showWorkbenchPanel ? (
                  <div className="result-disclosure-body account-disclosure-body">
                    <OrderInfoManager
                      defaultInfoId={currentUser?.defaultInfoId}
                      onSave={handleOrderInfoSave}
                      onSelect={setSelectedOrderInfoId}
                      onSetDefault={handleSetDefaultOrderInfo}
                      orderInfos={orderInfos}
                      saveButtonLabel="保存资料"
                      saving={profileLoading}
                      selectedOrderInfoId={selectedOrderInfoId}
                      subtitle=""
                      title="订单资料"
                    />
                    {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
                  </div>
                ) : null}
              </section>

              <section className="result-panel result-panel--disclosure account-disclosure-panel account-security-card">
                <button
                  className="result-inline-toggle"
                  onClick={() => setShowSecurityPanel((prev) => !prev)}
                  type="button"
                >
                  <span>账号安全与密码修改</span>
                  <div className="account-disclosure-inline-meta">
                    <span>低频操作</span>
                    <IonIcon icon={showSecurityPanel ? chevronUpOutline : chevronDownOutline} />
                  </div>
                </button>
                {showSecurityPanel ? (
                  <div className="result-disclosure-body account-disclosure-body">
                    <form className="stack-section" onSubmit={handlePasswordSave}>
                      <div className="account-section-head">
                        <div>
                          <p className="page-eyebrow">PASSWORD</p>
                          <h3 style={{ marginTop: 0 }}>账号安全</h3>
                        </div>
                        <div className="account-section-chip">
                          <IonIcon icon={lockClosedOutline} />
                          定期更新更安心
                        </div>
                      </div>
                      <div className="account-security-notes">
                        {securityNotes.map((note) => (
                          <div className="account-security-note" key={note}>
                            <IonIcon icon={shieldCheckmarkOutline} />
                            <p>{note}</p>
                          </div>
                        ))}
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
                  </div>
                ) : null}
              </section>
            </section>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

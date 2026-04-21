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
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { fetchDiscounts, fetchShops } from '../api/catalog';
import {
  fetchUserProfile,
  loginUser,
  registerUser,
  updateDefaultInfo,
  updatePassword,
} from '../api/users';
import AuthPanel from '../components/account/AuthPanel';
import AppLoadingOverlay from '../components/common/AppLoadingOverlay';
import CardSkeleton from '../components/common/CardSkeleton';
import CompactPromoTile from '../components/common/CompactPromoTile';
import LoadingButton from '../components/common/LoadingButton';
import PageHeader from '../components/common/PageHeader';
import { brandConfig } from '../config/brand';
import { campaignAssets, resolveDiscountImage } from '../config/campaigns';
import { CustomerInfo, Discount, Shop, UserProfile, isDiscountActive } from '../models/domain';
import { clearStoredUser, getStoredUser, setStoredUser } from '../utils/storage';

const defaultDraft: Partial<CustomerInfo> = {
  name: '',
  phone: '',
  address: '',
  preferredShop: '',
  pickupTime: '',
  notes: '',
};

export default function AccountPage() {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [defaultInfo, setDefaultInfo] = useState<Partial<CustomerInfo>>(defaultDraft);
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
            setStoredUser(profile);
          } catch {
            clearStoredUser();
          }
        }

        if (mounted) {
          setCurrentUser(profile);
          setDefaultInfo(profile?.defaultInfo || defaultDraft);
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
          ? await loginUser(username, password)
          : await registerUser(username, password);
      setCurrentUser(profile);
      setStoredUser(profile);
      setDefaultInfo(profile.defaultInfo || defaultDraft);
      setPassword('');
      setConfirmPassword('');
      setAuthSuccess(mode === 'login' ? '登录成功。' : '注册成功，已自动登录。');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后重试。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredUser();
    setCurrentUser(null);
    setDefaultInfo(defaultDraft);
    setAuthError('');
    setAuthSuccess('');
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;

    setProfileLoading(true);
    setProfileMessage('');

    try {
      const profile = await updateDefaultInfo(currentUser.id, defaultInfo);
      setCurrentUser(profile);
      setStoredUser(profile);
      setDefaultInfo(profile.defaultInfo || defaultDraft);
      setProfileMessage('默认资料已保存，下单时会自动回填。');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setProfileLoading(false);
    }
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
                  <p>常用地址、电话和门店都可以保存在这里，下次下单会直接带出。</p>
                  <div className="inline-actions">
                    <IonButton shape="round" onClick={() => history.push('/membership')}>
                      {currentUser.group === 'vip' ? '查看会员权益' : '立即开通会员'}
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard className="surface-card">
                <IonCardContent>
                  <form className="stack-section" onSubmit={handleProfileSave}>
                    <div>
                      <p className="page-eyebrow">DEFAULT INFO</p>
                      <h3 style={{ marginTop: 0 }}>默认订单资料</h3>
                    </div>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">姓名</IonLabel>
                      <IonInput
                        value={defaultInfo.name || ''}
                        onIonInput={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, name: e.detail.value || '' }))
                        }
                      />
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">电话</IonLabel>
                      <IonInput
                        value={defaultInfo.phone || ''}
                        onIonInput={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, phone: e.detail.value || '' }))
                        }
                      />
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">取件地址</IonLabel>
                      <IonInput
                        value={defaultInfo.address || ''}
                        onIonInput={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, address: e.detail.value || '' }))
                        }
                      />
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">常用门店</IonLabel>
                      <IonSelect
                        value={defaultInfo.preferredShop || ''}
                        onIonChange={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, preferredShop: e.detail.value || '' }))
                        }
                      >
                        <IonSelectOption value="">不指定</IonSelectOption>
                        {shops.map((shop) => (
                          <IonSelectOption key={shop.id} value={shop.name}>
                            {shop.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                    <IonItem className="field-item">
                      <IonLabel position="stacked">期望取件时间</IonLabel>
                      <IonSelect
                        value={defaultInfo.pickupTime || ''}
                        onIonChange={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, pickupTime: e.detail.value || '' }))
                        }
                      >
                        <IonSelectOption value="">不固定</IonSelectOption>
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
                        value={defaultInfo.notes || ''}
                        onIonInput={(e) =>
                          setDefaultInfo((prev) => ({ ...prev, notes: e.detail.value || '' }))
                        }
                      />
                    </IonItem>
                    {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
                    <LoadingButton expand="block" loading={profileLoading} shape="round" type="submit">
                      保存默认资料
                    </LoadingButton>
                  </form>
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

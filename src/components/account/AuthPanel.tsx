import {
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonText,
} from '@ionic/react';
import LoadingButton from '../common/LoadingButton';

interface Props {
  mode: 'login' | 'register';
  username: string;
  password: string;
  confirmPassword: string;
  error: string;
  success: string;
  loading: boolean;
  onModeChange: (mode: 'login' | 'register') => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export default function AuthPanel({
  mode,
  username,
  password,
  confirmPassword,
  error,
  success,
  loading,
  onModeChange,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: Props) {
  return (
    <form className="stack-section" onSubmit={onSubmit}>
      <IonSegment
        className="capsule-segment"
        value={mode}
        onIonChange={(event) => onModeChange(event.detail.value as 'login' | 'register')}
      >
        <IonSegmentButton value="login">
          <IonLabel>登录</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="register">
          <IonLabel>注册</IonLabel>
        </IonSegmentButton>
      </IonSegment>

      <IonItem className="field-item">
        <IonLabel position="stacked">用户名</IonLabel>
        <IonInput value={username} onIonInput={(e) => onUsernameChange(e.detail.value || '')} />
      </IonItem>

      <IonItem className="field-item">
        <IonLabel position="stacked">密码</IonLabel>
        <IonInput
          type="password"
          value={password}
          onIonInput={(e) => onPasswordChange(e.detail.value || '')}
        />
      </IonItem>

      {mode === 'register' ? (
        <IonItem className="field-item">
          <IonLabel position="stacked">确认密码</IonLabel>
          <IonInput
            type="password"
            value={confirmPassword}
            onIonInput={(e) => onConfirmPasswordChange(e.detail.value || '')}
          />
        </IonItem>
      ) : null}

      {error ? (
        <IonText color="danger">
          <p className="form-message">{error}</p>
        </IonText>
      ) : null}
      {success ? (
        <IonText color="success">
          <p className="form-message">{success}</p>
        </IonText>
      ) : null}

      <LoadingButton expand="block" loading={loading} shape="round" type="submit">
        {mode === 'login' ? '立即登录' : '注册并登录'}
      </LoadingButton>
    </form>
  );
}

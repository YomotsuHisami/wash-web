import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonTextarea,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { CustomerInfo, SavedOrderInfo } from '../../models/domain';
import LoadingButton from '../common/LoadingButton';
import {
  buildOrderInfoLabel,
  createSavedOrderInfo,
  hasRequiredOrderInfo,
} from '../../utils/orderInfoUtils';

type EditorMode = 'create' | 'edit' | null;

interface OrderInfoManagerProps {
  orderInfos: SavedOrderInfo[];
  selectedOrderInfoId?: string | null;
  defaultInfoId?: string | null;
  title: string;
  subtitle?: string;
  saveButtonLabel?: string;
  saving?: boolean;
  onSelect: (id: string) => void;
  onSave: (payload: {
    orderInfo: SavedOrderInfo;
    mode: Exclude<EditorMode, null>;
    setAsDefault: boolean;
  }) => Promise<void> | void;
  onSetDefault?: (id: string) => Promise<void> | void;
}

export default function OrderInfoManager({
  orderInfos,
  selectedOrderInfoId,
  defaultInfoId,
  title,
  subtitle,
  saveButtonLabel = '保存资料',
  saving = false,
  onSelect,
  onSave,
  onSetDefault,
}: OrderInfoManagerProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<SavedOrderInfo>(() => createSavedOrderInfo());
  const [setAsDefault, setSetAsDefault] = useState(false);

  const selectedOrderInfo = useMemo(
    () =>
      orderInfos.find((item) => item.id === selectedOrderInfoId) ||
      orderInfos.find((item) => item.id === defaultInfoId) ||
      orderInfos[0] ||
      null,
    [defaultInfoId, orderInfos, selectedOrderInfoId]
  );

  const openCreate = () => {
    const next = createSavedOrderInfo({}, orderInfos.length + 1);
    setDraft(next);
    setSetAsDefault(orderInfos.length === 0);
    setEditorMode('create');
  };

  const openEdit = (orderInfo?: SavedOrderInfo | null) => {
    const target = orderInfo || selectedOrderInfo;
    if (!target) return;
    setDraft(createSavedOrderInfo(target));
    setSetAsDefault(target.id === defaultInfoId);
    setEditorMode('edit');
  };

  const closeEditor = () => {
    setEditorMode(null);
    setDraft(createSavedOrderInfo());
    setSetAsDefault(false);
  };

  const handleSave = async () => {
    const nextDraft = createSavedOrderInfo(
      {
        ...draft,
        label: draft.label?.trim() || buildOrderInfoLabel(draft, orderInfos.length + 1),
      },
      orderInfos.length + 1
    );

    if (!hasRequiredOrderInfo(nextDraft)) return;

    await onSave({
      orderInfo: nextDraft,
      mode: editorMode as Exclude<EditorMode, null>,
      setAsDefault,
    });
    closeEditor();
  };

  return (
    <div className="order-info-manager">
      <div className="order-info-manager__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <IonButton fill="clear" size="small" onClick={openCreate}>
          新增资料
        </IonButton>
      </div>

      <div className="order-info-card-row">
        {orderInfos.map((item) => {
          const isSelected = item.id === selectedOrderInfo?.id;
          const isDefault = item.id === defaultInfoId;

          return (
            <div
              className={`order-info-card${isSelected ? ' is-selected' : ''}`}
              key={item.id}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(item.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="order-info-card__top">
                <strong>{item.label}</strong>
                <div className="order-info-card__badges">
                  {isDefault ? <span>默认</span> : null}
                  {isSelected ? <span>当前</span> : null}
                </div>
              </div>
              <p>{item.name || '未填写姓名'}</p>
              <p>{item.phone || '未填写电话'}</p>
              <p>{item.address || '未填写地址'}</p>
              <div className="order-info-card__actions">
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(item);
                  }}
                >
                  <IonLabel>编辑</IonLabel>
                </IonButton>
                {!isDefault && onSetDefault ? (
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSetDefault(item.id);
                    }}
                  >
                    <IonLabel>设为默认</IonLabel>
                  </IonButton>
                ) : null}
              </div>
            </div>
          );
        })}

        <button className="order-info-card order-info-card--create" onClick={openCreate} type="button">
          <div className="order-info-card__create-icon">
            <span>+</span>
          </div>
          <strong>新增订单资料</strong>
          <p>为不同地址保存单独资料</p>
        </button>
      </div>

      {editorMode ? (
        <div className="order-info-editor">
          <div className="order-info-editor__head">
            <strong>{editorMode === 'create' ? '新增订单资料' : '编辑订单资料'}</strong>
            <IonButton fill="clear" size="small" onClick={closeEditor}>
              <IonLabel>取消</IonLabel>
            </IonButton>
          </div>
          <div className="order-info-editor__grid">
            <IonItem className="field-item">
              <IonLabel position="stacked">资料名称</IonLabel>
              <IonInput
                value={draft.label}
                onIonInput={(e) =>
                  setDraft((prev) => ({ ...prev, label: e.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">姓名</IonLabel>
              <IonInput
                value={draft.name}
                onIonInput={(e) =>
                  setDraft((prev) => ({ ...prev, name: e.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item">
              <IonLabel position="stacked">电话</IonLabel>
              <IonInput
                value={draft.phone}
                onIonInput={(e) =>
                  setDraft((prev) => ({ ...prev, phone: e.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item order-info-editor__wide">
              <IonLabel position="stacked">取件地址</IonLabel>
              <IonInput
                value={draft.address}
                onIonInput={(e) =>
                  setDraft((prev) => ({ ...prev, address: e.detail.value || '' }))
                }
              />
            </IonItem>
            <IonItem className="field-item order-info-editor__wide">
              <IonLabel position="stacked">备注</IonLabel>
              <IonTextarea
                autoGrow
                value={draft.notes}
                onIonInput={(e) =>
                  setDraft((prev) => ({ ...prev, notes: e.detail.value || '' }))
                }
              />
            </IonItem>
          </div>
          <div className="order-info-editor__footer">
            <button
              className={`order-info-default-toggle${setAsDefault ? ' is-active' : ''}`}
              onClick={() => setSetAsDefault((prev) => !prev)}
              type="button"
            >
              <span>{setAsDefault ? '已设为默认资料' : '同时设为默认资料'}</span>
            </button>
            <LoadingButton
              expand="block"
              loading={saving}
              onClick={handleSave}
              shape="round"
            >
              {saveButtonLabel}
            </LoadingButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

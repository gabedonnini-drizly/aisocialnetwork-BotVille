import { useEffect, useState } from 'react';
import { LLM_PROVIDERS } from '@botville/shared';
import type { LLMProviderType } from '@botville/shared';
import { useKeysStore } from '../../store/keysStore.js';
import { useT } from '../../i18n/index.js';
import type { TKey } from '../../i18n/index.js';
import styles from './KeysPanel.module.css';

// TZ-14: user key management. Intentionally NOT a top-level tab — a small panel
// opened from the HUD: keys are entered rarely, and the HUD should stay narrow.

interface Props { onClose: () => void; }

const KEYABLE = LLM_PROVIDERS.filter(p => p.requiresApiKey);

/** Server-side baseUrl validation error codes → dictionary keys. */
const URL_ERROR_KEYS: Record<string, TKey> = {
  invalid_url: 'keysPanel.errUrlInvalid',
  insecure_scheme: 'keysPanel.errUrlInsecure',
  bad_url_parts: 'keysPanel.errUrlParts',
  BASE_URL_REQUIRED: 'keysPanel.errUrlRequired',
  NETWORK: 'keysPanel.errNetwork',
};

export function KeysPanel({ onClose }: Props) {
  const t = useT();
  const { keys, fetchKeys, saveKey, removeKey } = useKeysStore();
  const [editing, setEditing] = useState<LLMProviderType | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [verdict, setVerdict] = useState<boolean | null | undefined>(undefined);
  const [error, setError] = useState<TKey | null>(null);
  /** Result of the last save — visible after the editor has collapsed. */
  const [flash, setFlash] = useState<TKey | null>(null);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const openEditor = (provider: LLMProviderType) => {
    setEditing(provider);
    setApiKey('');
    setBaseUrl(keys.find(k => k.provider === provider)?.baseUrl ?? '');
    setVerdict(undefined);
    setError(null);
    setFlash(null);
  };

  const handleSave = async (provider: LLMProviderType) => {
    if (saving || !apiKey.trim()) return;
    setSaving(true);
    setVerdict(undefined);
    setError(null);
    setFlash(null);
    const needsUrl = LLM_PROVIDERS.find(p => p.id === provider)?.userBaseUrl === true;
    const res = await saveKey(provider, apiKey.trim(), needsUrl ? baseUrl.trim() : undefined);
    setSaving(false);
    if (!res.ok) {
      setError(URL_ERROR_KEYS[res.errorCode ?? ''] ?? 'keysPanel.errSaveFailed');
      return;
    }
    setVerdict(res.valid);
    setApiKey('');
    // The key didn't work — keep the editor open so it can be fixed right away
    if (res.valid !== false) {
      setFlash(res.valid === true ? 'keysPanel.savedOk' : 'model.keyUnknown');
      setEditing(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('keysPanel.title')}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>
        <div className={styles.intro}>{t('keysPanel.intro')}</div>
        {flash && <div className={styles.flash}>{t(flash)}</div>}

        {KEYABLE.map(p => {
          const saved = keys.find(k => k.provider === p.id);
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className={styles.item}>
              <div className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <span className={styles.providerName}>{p.name}</span>
                  <span className={saved ? styles.statusOn : styles.statusOff}>
                    {saved ? t('keysPanel.configured', { mask: saved.maskedKey }) : t('keysPanel.notConfigured')}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  {saved && (
                    <button className={styles.deleteBtn} onClick={() => removeKey(p.id)}>
                      {t('keysPanel.delete')}
                    </button>
                  )}
                  <button
                    className={styles.editBtn}
                    onClick={() => (isEditing ? setEditing(null) : openEditor(p.id))}
                  >
                    {isEditing ? t('common.cancel') : saved ? t('keysPanel.replace') : t('keysPanel.add')}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className={styles.editor}>
                  {p.userBaseUrl && (
                    <input
                      className={styles.input}
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder={t('keysPanel.baseUrlPlaceholder')}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  )}
                  <input
                    className={styles.input}
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={t('keysPanel.keyPlaceholder', { provider: p.name })}
                  />
                  <button
                    className={styles.saveBtn}
                    onClick={() => handleSave(p.id)}
                    disabled={saving || !apiKey.trim()}
                  >
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                  {error && <div className={styles.bad}>{t(error)}</div>}
                  {verdict === false && <div className={styles.bad}>{t('model.keyBad')}</div>}
                </div>
              )}
            </div>
          );
        })}

        <div className={styles.footNote}>{t('keysPanel.footNote')}</div>
      </div>
    </div>
  );
}

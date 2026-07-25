import { useState, useEffect, useRef } from 'react';
import { useT } from '../../i18n/index.js';
import { LLM_PROVIDERS } from '@botville/shared';
import type { LLMProviderType } from '@botville/shared';
import { useAgentStore } from '../../store/agentStore.js';
import { useKeysStore } from '../../store/keysStore.js';
import { fetchDemoStatus } from '../../lib/api.js';
import { AVATAR_VARIANTS } from '../../game/assetManifest.js';
import { VariantPreview } from './VariantPreview.js';
import { ModelPicker } from '../ModelPicker/ModelPicker.js';
import styles from './CreateAgentModal.module.css';

interface Props { onClose: () => void; }

const HUMANS = AVATAR_VARIANTS.filter(v => v.kind === 'human');
const ANIMALS = AVATAR_VARIANTS.filter(v => v.kind === 'animal');

export function CreateAgentModal({ onClose }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarVariant, setAvatarVariant] = useState(0);
  const [providerType, setProviderType] = useState<LLMProviderType>('claude');
  const [modelId, setModelId] = useState('claude-sonnet-4-6');
  const [apiKey, setApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [customUrl, setCustomUrl] = useState('');
  // Сохранённый ключ есть → поле ввода свёрнуто; раскрывается для override (ТЗ-14)
  const [overrideKey, setOverrideKey] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [demoEnabled, setDemoEnabled] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const { createAgent, setApiKey: saveKey } = useAgentStore();
  const { keys, fetchKeys } = useKeysStore();

  useEffect(() => {
    fetchDemoStatus().then(s => setDemoEnabled(s.demoEnabled));
    fetchKeys();
  }, [fetchKeys]);

  // Ошибка появляется над кнопками внизу длинной прокручиваемой модалки —
  // на мобиле её могло вытолкнуть за экран. Подтягиваем к ней (на десктопе,
  // где всё влезает, block:'nearest' — no-op).
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const provider = LLM_PROVIDERS.find(p => p.id === providerType)!;
  const savedKey = keys.find(k => k.provider === providerType);
  // Ключ уже есть у юзера — по умолчанию берём его, поле ввода не показываем
  const usingSavedKey = !!savedKey && !overrideKey;

  const handleCreate = async () => {
    if (creating) return;                    // защита от дабл-тапа (оба пути)
    if (!name.trim()) return setError(t('create.errNameRequired'));
    if (!modelId.trim()) return setError(t('create.errModelRequired'));
    if (providerType === 'custom' && !customUrl.trim()) return setError(t('create.errUrlRequired'));
    setCreating(true);
    setError('');
    const res = await createAgent({
      name: name.trim(),
      avatarVariant,
      systemPrompt,
      providerType,
      modelId: modelId.trim(),
      ollamaBaseUrl: providerType === 'ollama' ? ollamaUrl : undefined,
      customBaseUrl: providerType === 'custom' ? customUrl.trim() : undefined,
    });
    if (!res.ok) {
      setError(res.network ? t('create.errNetwork') : t('create.errCreateFailed'));
      setCreating(false);
      return;
    }
    // Личный ключ агента задаём, только если юзер его действительно ввёл;
    // иначе агент возьмёт сохранённый ключ юзера при первом же сообщении.
    if (apiKey && providerType !== 'ollama') await saveKey(res.id, apiKey);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{t('create.title')}</div>

        <div className={styles.sectionLabel}>{t('create.people')}</div>
        <div className={styles.variantGrid}>
          {HUMANS.map(v => (
            <div key={v.id} className={`${styles.variantCell} ${avatarVariant === v.id ? styles.selected : ''}`}
              onClick={() => setAvatarVariant(v.id)} title={v.label}>
              <VariantPreview variant={v} />
              <span className={styles.variantName}>{v.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.sectionLabel}>{t('create.animals')}</div>
        <div className={styles.variantGrid}>
          {ANIMALS.map(v => (
            <div key={v.id} className={`${styles.variantCell} ${avatarVariant === v.id ? styles.selected : ''}`}
              onClick={() => setAvatarVariant(v.id)} title={v.label}>
              <VariantPreview variant={v} />
              <span className={styles.variantName}>{v.label}</span>
            </div>
          ))}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('create.name')}</span>
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder={t('create.namePlaceholder')} maxLength={20} />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('create.personality')}</span>
          <textarea className={styles.textarea} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            placeholder={t('create.personalityPlaceholder')} rows={3} />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('create.provider')}</span>
          <select className={styles.select} value={providerType} onChange={e => {
            const p = e.target.value as LLMProviderType;
            setProviderType(p);
            // У openrouter/custom вшитого списка нет — модель выбирается ниже
            setModelId(LLM_PROVIDERS.find(x => x.id === p)!.models[0]?.id ?? '');
            setApiKey('');
            setOverrideKey(false);
            // Адрес сохранён вместе с ключом — не заставляем вводить его снова
            if (p === 'custom') setCustomUrl(keys.find(k => k.provider === 'custom')?.baseUrl ?? '');
          }}>
            {LLM_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        {providerType === 'custom' && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('create.customUrl')}</span>
            <input className={styles.input} value={customUrl} onChange={e => setCustomUrl(e.target.value)}
              placeholder="https://api.groq.com/openai/v1"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <span className={styles.hint}>{t('create.customUrlHint')}</span>
          </label>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('create.model')}</span>
          <ModelPicker provider={providerType} value={modelId} onChange={setModelId} />
        </div>

        {providerType === 'ollama' ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('create.ollamaUrl')}</span>
            <input className={styles.input} value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
          </label>
        ) : usingSavedKey ? (
          /* ТЗ-14: ключ уже сохранён — вместо пустого поля показываем, что берём его */
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('create.apiKey')}</span>
            <div className={styles.savedKeyRow}>
              <span className={styles.savedKeyText}>
                {t('create.usingSavedKey', { mask: savedKey!.maskedKey })}
              </span>
              <button type="button" className={styles.linkBtn} onClick={() => setOverrideKey(true)}>
                {t('create.useAnotherKey')}
              </button>
            </div>
          </div>
        ) : (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('create.apiKey')}{demoEnabled ? t('create.apiKeyOptional') : ''}</span>
            <input className={styles.input} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={t('create.apiKeyPlaceholder', { provider: provider.name })} />
            <span className={styles.hint}>{t('create.keyHint')}</span>
            {savedKey && (
              <button type="button" className={styles.linkBtn} onClick={() => { setOverrideKey(false); setApiKey(''); }}>
                {t('create.backToSavedKey')}
              </button>
            )}
          </label>
        )}

        {demoEnabled && providerType !== 'ollama' && !apiKey && !savedKey && (
          <button className={styles.demoSkipBtn} onClick={handleCreate} disabled={creating}>
            {t('create.demoSkip')}
          </button>
        )}

        {error && <div ref={errorRef} className={styles.error}>{error}</div>}

        <div className={styles.btnRow}>
          <button className={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
            {creating ? t('create.creating') : t('create.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

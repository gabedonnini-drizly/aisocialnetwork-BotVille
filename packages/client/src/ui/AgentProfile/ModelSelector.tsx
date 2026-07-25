import { useEffect, useState } from 'react';
import { LLM_PROVIDERS } from '@botville/shared';
import type { Agent } from '@botville/shared';
import { useAgentStore } from '../../store/agentStore.js';
import { useKeysStore } from '../../store/keysStore.js';
import { apiFetch } from '../../lib/api.js';
import { useT } from '../../i18n/index.js';
import { ModelPicker } from '../ModelPicker/ModelPicker.js';
import styles from './ModelSelector.module.css';

interface Props { agent: Agent; }

export function ModelSelector({ agent }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Вердикт health-check ключа: true/false — от провайдера, null — проверка не удалась
  const [keyVerdict, setKeyVerdict] = useState<boolean | null | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState(agent.providerType);
  const [selectedModel, setSelectedModel] = useState(agent.modelId);
  const [ollamaUrl, setOllamaUrl] = useState(agent.ollamaBaseUrl ?? 'http://localhost:11434');
  const [customUrl, setCustomUrl] = useState(agent.customBaseUrl ?? '');
  const [deleting, setDeleting] = useState(false);
  const { setApiKey: storeSetApiKey, deleteApiKey } = useAgentStore();
  const { keys, fetchKeys } = useKeysStore();

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleDeleteKey = async () => {
    setDeleting(true);
    try {
      await deleteApiKey(agent.id);
      setKeyVerdict(undefined);
      setApiKeyInput('');
    } finally {
      setDeleting(false);
    }
  };

  const provider = LLM_PROVIDERS.find(p => p.id === selectedProvider)!;
  const savedUserKey = keys.find(k => k.provider === selectedProvider);

  const handleSave = async () => {
    setSaving(true);
    setKeyVerdict(undefined);
    try {
      // Update model config
      await apiFetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerType: selectedProvider,
          modelId: selectedModel,
          ollamaBaseUrl: ollamaUrl,
          customBaseUrl: selectedProvider === 'custom' ? customUrl.trim() : undefined,
        }),
      });
      // Save key if provided (+ health-check)
      if (apiKey && selectedProvider !== 'ollama') {
        const verdict = await storeSetApiKey(agent.id, apiKey);
        setKeyVerdict(verdict);
        if (verdict === false) return; // ключ сохранён, но не работает — оставляем редактор открытым
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); setApiKeyInput(''); setKeyVerdict(undefined); }, 1500);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.providerName}>{provider?.name}</span>
          <span className={styles.modelName}>{selectedModel}</span>
        </div>
        <button className={styles.editBtn} onClick={() => setEditing(true)}>{t('profile.change')}</button>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.fieldLabel}>{t('model.provider')}</div>
      <select className={styles.select} value={selectedProvider} onChange={e => {
        setSelectedProvider(e.target.value as Agent['providerType']);
        const prov = LLM_PROVIDERS.find(p => p.id === e.target.value);
        // У openrouter/custom вшитого списка нет — модель выбирается ниже
        if (prov) setSelectedModel(prov.models[0]?.id ?? '');
      }}>
        {LLM_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {selectedProvider === 'custom' && (
        <>
          <div className={styles.fieldLabel}>{t('create.customUrl')}</div>
          <input className={styles.input} value={customUrl} onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://api.groq.com/openai/v1"
            autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </>
      )}

      <div className={styles.fieldLabel}>{t('model.model')}</div>
      <ModelPicker provider={selectedProvider} value={selectedModel} onChange={setSelectedModel} />

      {selectedProvider === 'ollama' ? (
        <>
          <div className={styles.fieldLabel}>{t('model.ollamaUrl')}</div>
          <input className={styles.input} value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
        </>
      ) : (
        <>
          <div className={styles.fieldLabel}>{t('model.apiKey')}</div>
          {/* ТЗ-14: без личного ключа агент возьмёт сохранённый ключ юзера */}
          {!agent.hasKey && savedUserKey && (
            <div className={styles.keySaved}>{t('model.usingSavedKey', { mask: savedUserKey.maskedKey })}</div>
          )}
          <input className={styles.input} type="password" value={apiKey} onChange={e => setApiKeyInput(e.target.value)} placeholder={t('model.keyPlaceholder')} />
          {agent.hasKey && (
            <div className={styles.keyRow}>
              <span className={styles.keySaved}>{t('model.keySaved')}</span>
              <button className={styles.deleteKeyBtn} onClick={handleDeleteKey} disabled={deleting}>
                {deleting ? t('model.deleting') : t('model.deleteKey')}
              </button>
            </div>
          )}
        </>
      )}

      {keyVerdict === true && <div className={styles.keyOk}>{t('model.keyOk')}</div>}
      {keyVerdict === false && <div className={styles.keyBad}>{t('model.keyBad')}</div>}
      {keyVerdict === null && <div className={styles.keyUnknown}>{t('model.keyUnknown')}</div>}

      <div className={styles.btnRow}>
        <button className={styles.cancelBtn} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

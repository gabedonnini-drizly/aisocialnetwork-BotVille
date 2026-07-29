import { useEffect, useMemo, useState } from 'react';
import { LLM_PROVIDERS } from '@botville/shared';
import type { CatalogModel, LLMProviderType } from '@botville/shared';
import { fetchOpenRouterModels } from '../../lib/api.js';
import { useT } from '../../i18n/index.js';
import styles from './ModelPicker.module.css';

// TZ-14: model selection for three different cases in one component:
//  • a regular provider — short static list (<select>);
//  • OpenRouter — a live catalog with hundreds of models: search + a separate
//    block of free (:free) ones, because those are what remove the entry barrier;
//  • custom — no catalog, just an input field for the model name.

interface Props {
  provider: LLMProviderType;
  value: string;
  onChange: (modelId: string) => void;
}

const FREE_BLOCK_LIMIT = 6;
const LIST_LIMIT = 60;

/** Price in $/1M tokens, compact form: `$0.15` / `$0.9` / `<$0.01`. */
function formatPrice(usdPerMillion: number): string {
  if (usdPerMillion === 0) return '$0';
  if (usdPerMillion < 0.01) return '<$0.01';
  return `$${usdPerMillion < 1 ? usdPerMillion.toFixed(2) : usdPerMillion.toFixed(usdPerMillion < 10 ? 1 : 0)}`;
}

function formatContext(tokens: number): string {
  if (!tokens) return '';
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K` : String(tokens);
}

export function ModelPicker({ provider, value, onChange }: Props) {
  const t = useT();
  const meta = LLM_PROVIDERS.find(p => p.id === provider);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [query, setQuery] = useState('');

  const dynamic = meta?.dynamicModels === true;

  useEffect(() => {
    if (!dynamic) return;
    let alive = true;
    setCatalog(null);
    fetchOpenRouterModels().then(models => { if (alive) setCatalog(models); });
    return () => { alive = false; };
  }, [dynamic]);

  const q = query.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!catalog) return [];
    if (!q) return catalog;
    return catalog.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [catalog, q]);

  // Free models get their own block at the top — only while not searching,
  // otherwise search results would be duplicated.
  const freeTop = useMemo(
    () => (q ? [] : matched.filter(m => m.isFree).slice(0, FREE_BLOCK_LIMIT)),
    [matched, q],
  );
  const freeTopIds = useMemo(() => new Set(freeTop.map(m => m.id)), [freeTop]);
  const rest = useMemo(
    () => matched.filter(m => !freeTopIds.has(m.id)).slice(0, LIST_LIMIT),
    [matched, freeTopIds],
  );

  // ── custom: no catalog, the model is typed in by hand ──
  if (provider === 'custom') {
    return (
      <input
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('model.customModelPlaceholder')}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    );
  }

  // ── regular provider: short built-in list ──
  if (!dynamic) {
    return (
      <select className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
        {(meta?.models ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    );
  }

  // ── OpenRouter: live catalog ──
  const row = (m: CatalogModel) => (
    <button
      key={m.id}
      type="button"
      className={`${styles.row} ${m.id === value ? styles.rowSelected : ''}`}
      onClick={() => onChange(m.id)}
      title={m.id}
    >
      <span className={styles.rowMain}>
        <span className={styles.rowName}>{m.name}</span>
        <span className={styles.rowId}>{m.id}</span>
      </span>
      <span className={styles.rowMeta}>
        {m.isFree
          ? <span className={styles.freeTag}>{t('model.free')}</span>
          : m.promptPrice !== null && <span className={styles.price}>{formatPrice(m.promptPrice)}/1M</span>}
        {!!m.contextWindow && <span className={styles.ctx}>{formatContext(m.contextWindow)}</span>}
      </span>
    </button>
  );

  return (
    <div className={styles.picker}>
      <input
        className={styles.search}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('model.searchPlaceholder')}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {value && <div className={styles.current}>{t('model.selected', { model: value })}</div>}

      {catalog === null && <div className={styles.note}>{t('model.catalogLoading')}</div>}

      {catalog !== null && catalog.length === 0 && (
        // The catalog never arrived — don't lock the user out: the model name can be typed in by hand.
        <>
          <div className={styles.note}>{t('model.catalogFailed')}</div>
          <input
            className={styles.input}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={t('model.customModelPlaceholder')}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </>
      )}

      {catalog !== null && catalog.length > 0 && (
        <div className={styles.list}>
          {freeTop.length > 0 && (
            <>
              <div className={styles.groupLabel}>{t('model.freeGroup')}</div>
              {freeTop.map(row)}
              <div className={styles.groupLabel}>{t('model.allGroup')}</div>
            </>
          )}
          {rest.map(row)}
          {matched.length === 0 && <div className={styles.note}>{t('model.searchEmpty')}</div>}
        </div>
      )}
    </div>
  );
}

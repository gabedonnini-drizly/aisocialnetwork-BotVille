import { useLocaleStore, type Locale } from '../i18n/index.js';
import styles from './LocaleToggle.module.css';

const LOCALES: Locale[] = ['en', 'ru'];

/** Компактный тумблер EN/RU (ТЗ-07): живёт в HUD и в шапке лендинга. */
export function LocaleToggle() {
  const { locale, setLocale } = useLocaleStore();
  return (
    <div className={styles.toggle} role="group" aria-label="Language">
      {LOCALES.map(l => (
        <button
          key={l}
          type="button"
          className={`${styles.btn} ${locale === l ? styles.active : ''}`}
          onClick={() => setLocale(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

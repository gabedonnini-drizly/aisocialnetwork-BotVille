import { useLocaleStore, type Locale } from '../i18n/index.js';
import styles from './LocaleToggle.module.css';

const LOCALES: Locale[] = ['en', 'ru'];

/** Compact EN/RU toggle (TZ-07): lives in the HUD and in the landing header. */
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

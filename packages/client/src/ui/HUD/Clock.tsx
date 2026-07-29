import { useWorldStore } from '../../store/worldStore.js';
import { useT } from '../../i18n/index.js';
import styles from './HUD.module.css';

/** Time-of-day icon: boundaries match the tint phases (config.ts). */
function dayIcon(hour: number): string {
  if (hour >= 8 && hour < 17) return '☀️';
  if (hour >= 17 && hour < 20) return '🌇';
  if (hour >= 5 && hour < 8) return '🌅';
  return '🌙';
}

/** Pixel clock in the HUD: game time from worldStore (ticked by GameBridge). */
export function Clock() {
  const t = useT();
  const timeOfDay = useWorldStore(s => s.timeOfDay);
  const hh = Math.floor(timeOfDay);
  const mm = Math.floor((timeOfDay - hh) * 60);
  const text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div className={styles.clock} title={t('clock.tooltip')}>
      <span className={styles.clockIcon}>{dayIcon(timeOfDay)}</span>
      <span className={styles.clockTime}>{text}</span>
    </div>
  );
}

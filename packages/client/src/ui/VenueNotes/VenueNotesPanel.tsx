import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/agentStore.js';
import { fetchVenueNotes, type VenueNote } from '../../lib/api.js';
import { useT } from '../../i18n/index.js';
import styles from './VenueNotesPanel.module.css';

// Addendum II.6 "render notes": a minimal venue-notes overlay.
// Mounted from App.tsx ONLY in integrated mode; in fixture mode it does not exist at all.
// Scene → venueId: interiors register under sceneKeyFor(venue.id) =
// `VenueScene:<venueId>` (game/venueRegistry.ts), so the id is parsed from
// the scene key — every interior, houses included, no hardcoded list.

const VENUE_SCENE_PREFIX = 'VenueScene:';

function venueIdOf(scene: string): string | null {
  return scene.startsWith(VENUE_SCENE_PREFIX) ? scene.slice(VENUE_SCENE_PREFIX.length) : null;
}

export function VenueNotesPanel() {
  const t = useT();
  const currentScene = useUIStore(s => s.currentScene);
  const [notes, setNotes] = useState<VenueNote[]>([]);
  const venueId = venueIdOf(currentScene);

  useEffect(() => {
    if (!venueId) { setNotes([]); return; }
    let cancelled = false;
    void fetchVenueNotes(venueId).then(list => {
      if (!cancelled) setNotes(list);
    });
    return () => { cancelled = true; };
  }, [venueId]);

  if (!venueId) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t('venueNotes.title')}</div>
      {notes.length === 0
        ? <div className={styles.empty}>{t('venueNotes.empty')}</div>
        : (
          <ul className={styles.list}>
            {notes.map(n => <li key={n.id} className={styles.note}>{n.body}</li>)}
          </ul>
        )}
    </div>
  );
}

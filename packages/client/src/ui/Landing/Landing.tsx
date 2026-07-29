import { useState } from 'react';
import { getLandingCopy } from './landingCopy.js';
import { useT } from '../../i18n/index.js';
import styles from './Landing.module.css';

// Paths to the hero media. Part 2 will put a render of the night district here;
// for now there is only the poster — a <video> without a source shows the same thing.
const HERO = {
  poster: '/hero/district-night.png',
  // Web version of the clip (Part 2). Empty → the hero shows the static poster.
  videoWebm: '/hero/district-night.webm',
  videoMp4: '/hero/district-night.mp4',
};

// Entering the app: a full navigation — Phaser initializes from scratch.
function launchApp() {
  window.location.href = '/app';
}

export function Landing() {
  const t = useT();
  const landingCopy = getLandingCopy(t);
  // If the video failed to load — hide the <video>, the poster background remains (graceful degradation).
  const [videoOk, setVideoOk] = useState(true);
  // The "How keys are stored" modal (TZ-04, part 3).
  const [keysOpen, setKeysOpen] = useState(false);
  const keys = landingCopy.keysModal;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        {/* Hero media: the night district. The poster is the fallback while/if there is no video. */}
        <div className={styles.heroMedia} style={{ backgroundImage: `url(${HERO.poster})` }}>
          {videoOk && (
            <video
              className={styles.heroVideo}
              poster={HERO.poster}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onError={() => setVideoOk(false)}
            >
              <source src={HERO.videoWebm} type="video/webm" />
              <source src={HERO.videoMp4} type="video/mp4" />
            </video>
          )}
          <div className={styles.heroOverlay} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>⬛</span> BotVille
          </div>
          <h1 className={styles.h1}>{landingCopy.h1}</h1>
          <p className={styles.subtitle}>{landingCopy.subtitle}</p>
          <div className={styles.ctaRow}>
            <button className={styles.cta} onClick={launchApp}>
              {landingCopy.ctaLabel} <span className={styles.ctaArrow}>→</span>
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setKeysOpen(true)}
            >
              {landingCopy.secondaryLabel}
            </button>
          </div>
        </div>

        <div className={styles.scrollHint} aria-hidden>↓</div>
      </section>

      <section className={styles.bullets}>
        {landingCopy.bullets.map((b) => (
          <div key={b.title} className={styles.bullet}>
            <div className={styles.bulletIcon}>{b.icon}</div>
            <div className={styles.bulletTitle}>{b.title}</div>
            <div className={styles.bulletText}>{b.text}</div>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>
        <button className={styles.ctaSmall} onClick={launchApp}>
          {landingCopy.ctaLabel} <span className={styles.ctaArrow}>→</span>
        </button>
        <div className={styles.footerNote}>{landingCopy.footerNote}</div>
      </footer>

      {/* "How keys are stored" — BYOK trust (TZ-04, part 3) */}
      {keysOpen && (
        <div className={styles.modalOverlay} onClick={() => setKeysOpen(false)} role="dialog" aria-modal="true" aria-label={keys.title}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setKeysOpen(false)} aria-label={t('common.close')}>✕</button>
            <h2 className={styles.modalTitle}>{keys.title}</h2>
            <p className={styles.modalIntro}>{keys.intro}</p>

            <ul className={styles.keyPoints}>
              {keys.points.map((p) => (
                <li key={p.title} className={styles.keyPoint}>
                  <span className={styles.keyPointIcon} aria-hidden>{p.icon}</span>
                  <div>
                    <div className={styles.keyPointTitle}>{p.title}</div>
                    <div className={styles.keyPointText}>{p.text}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.ollamaNote}>
              <div className={styles.ollamaTitle}>🦙 {keys.ollamaTitle}</div>
              <div className={styles.keyPointText}>{keys.ollamaText}</div>
            </div>

            <button className={styles.modalCta} onClick={() => setKeysOpen(false)}>
              {keys.closeLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

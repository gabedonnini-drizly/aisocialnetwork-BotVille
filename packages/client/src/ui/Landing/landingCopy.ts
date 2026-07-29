// Structure of the landing copy. The texts themselves live in the i18n dictionaries (TZ-07):
// edit packages/client/src/i18n/en.ts and ru.ts — the layout will adapt.

import type { TFunc } from '../../i18n/index.js';

export interface LandingBullet {
  icon: string;
  title: string;
  text: string;
}

export function getLandingCopy(t: TFunc) {
  return {
    // <title> takes the same value via i18n ('meta.title'), see i18n/index.ts
    h1: t('landing.h1'),
    subtitle: t('landing.subtitle'),

    bullets: [
      { icon: '🧑‍🤝‍🧑', title: t('landing.bullet1.title'), text: t('landing.bullet1.text') },
      { icon: '🔑', title: t('landing.bullet2.title'), text: t('landing.bullet2.text') },
      { icon: '🌃', title: t('landing.bullet3.title'), text: t('landing.bullet3.text') },
    ] as LandingBullet[],

    ctaLabel: t('landing.cta'),
    secondaryLabel: t('landing.keysLink'),
    footerNote: t('landing.footerNote'),

    // The "How keys are stored" modal (TZ-04, part 3). Removes the fear of pasting a key.
    keysModal: {
      title: t('keys.title'),
      intro: t('keys.intro'),
      points: [
        { icon: '🔒', title: t('keys.p1.title'), text: t('keys.p1.text') },
        { icon: '🙈', title: t('keys.p2.title'), text: t('keys.p2.text') },
        { icon: '🗑️', title: t('keys.p3.title'), text: t('keys.p3.text') },
        { icon: '🐙', title: t('keys.p4.title'), text: t('keys.p4.text') },
      ],
      ollamaTitle: t('keys.ollamaTitle'),
      ollamaText: t('keys.ollamaText'),
      closeLabel: t('keys.close'),
    },
  };
}

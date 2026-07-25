// Структура копирайта лендинга. Сами тексты живут в словарях i18n (ТЗ-07):
// правь packages/client/src/i18n/en.ts и ru.ts — вёрстка подстроится.

import type { TFunc } from '../../i18n/index.js';

export interface LandingBullet {
  icon: string;
  title: string;
  text: string;
}

export function getLandingCopy(t: TFunc) {
  return {
    // <title> берёт то же значение через i18n ('meta.title'), см. i18n/index.ts
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

    // Модалка «Как хранятся ключи» (ТЗ-04, часть 3). Снимает страх вставки ключа.
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

/**
 * BotVille — палитра UI-хрома для Phaser (ТЗ-06, Трек B).
 * Зеркало CSS-токенов из ui/theme.css. Единый источник цвета для
 * текстовых надписей игры (имена агентов, HUD-текст прелоадера).
 *
 * ВНИМАНИЕ: здесь ТОЛЬКО цвета интерфейса. Внутриигровой ночной глоу мира
 * (config.ts DAY_TINT_KEYS / NIGHT_LIGHT, dayNight.ts, glowTexture.ts) —
 * отдельная фича атмосферы и в этот модуль не входит.
 */

/** Строковые токены (для Phaser Text-стилей: color/stroke/backgroundColor). */
export const UI = {
  ink900: '#1a1915',
  ink800: '#232019',
  ink700: '#2c2822',
  inkLine: '#3a352c',

  paper100: '#f4f1e8',
  paper200: '#ede8da',
  paperLine: '#d2c8b4',

  textOnDark: '#ece6d8',
  textOnDarkMuted: '#a69e8e',
  textOnLight: '#26231c',

  accentCoral: '#c96442',
  accentWheat: '#cba871',
} as const;

/**
 * Матовые цвета статус-индикаторов агента (точки в HUD и профиле).
 * Единый источник вместо дублирующихся неон-карт в HUD.tsx/AgentProfile.tsx.
 * Все тона приглушённые (никакого #00ff88/#00ffff/#ff88ff).
 */
export const STATUS_COLORS: Record<string, string> = {
  idle: '#a69e8e', // спокойное ожидание — приглушённый серый
  wander: '#cba871', // прогулка — пшеничный
  rest: '#6e7a5a', // отдых — шалфей
  work: '#c96442', // работа — коралл
  task_running: '#b4573a', // думает над задачей — тёмный коралл
  task_done: '#6e7a5a', // готово — шалфей (успех)
  chat_npc: '#cba871', // разговор — пшеничный
};

/** Числовые токены 0xRRGGBB (для setTint / заливок Phaser). */
export const UI_HEX = {
  ink900: 0x1a1915,
  paper100: 0xf4f1e8,
  textOnDark: 0xece6d8,
  accentCoral: 0xc96442,
  /** Тёплая подсветка спрайта при наведении (нейтральный кремовый, не неон). */
  hoverTint: 0xfff4e0,
} as const;

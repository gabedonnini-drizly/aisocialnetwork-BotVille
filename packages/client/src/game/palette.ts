/**
 * BotVille — the UI chrome palette for Phaser (TZ-06, Track B).
 * A mirror of the CSS tokens from ui/theme.css. The single source of color for
 * the game's text labels (agent names, the preloader's HUD text).
 *
 * NOTE: this holds interface colors ONLY. The in-world night glow
 * (config.ts DAY_TINT_KEYS / NIGHT_LIGHT, dayNight.ts, glowTexture.ts) is
 * a separate atmosphere feature and does not belong in this module.
 */

/** String tokens (for Phaser Text styles: color/stroke/backgroundColor). */
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
 * Matte colors for agent status indicators (the dots in the HUD and profile).
 * A single source instead of the duplicated neon maps in HUD.tsx/AgentProfile.tsx.
 * All tones are muted (no #00ff88/#00ffff/#ff88ff).
 */
export const STATUS_COLORS: Record<string, string> = {
  idle: '#a69e8e', // calm waiting — muted grey
  wander: '#cba871', // strolling — wheat
  rest: '#6e7a5a', // resting — sage
  work: '#c96442', // working — coral
  task_running: '#b4573a', // thinking about a task — dark coral
  task_done: '#6e7a5a', // done — sage (success)
  chat_npc: '#cba871', // talking — wheat
};

/** Numeric 0xRRGGBB tokens (for setTint / Phaser fills). */
export const UI_HEX = {
  ink900: 0x1a1915,
  paper100: 0xf4f1e8,
  textOnDark: 0xece6d8,
  accentCoral: 0xc96442,
  /** Warm sprite highlight on hover (neutral cream, not neon). */
  hoverTint: 0xfff4e0,
} as const;

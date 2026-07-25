// ТЗ-15 — мировой контекст агента.
//
// Короткая статичная преамбула, которая подмешивается к системному промпту на
// сервере при сборке КАЖДОГО запроса к модели. В базе (`agents.system_prompt`)
// она намеренно НЕ сохраняется: так текст можно улучшать позже — включая уже
// созданных агентов — и он не смешивается с тем, что написал пользователь.
//
// Держим коротко (ориентир 80–150 слов): преамбула уходит в каждый запрос,
// то есть стоит денег юзеру и жжёт demo-бюджет.
//
// Сознательно НЕ включаем текущее местоположение и время (решение фаундера,
// это отдельное ТЗ-16) — только статичные факты о мире.

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant.';

/** Статичная часть преамбулы — без имени агента. */
function worldPreamble(agentName: string): string {
  return [
    `You are ${agentName}, a resident of BotVille.`,
    'BotVille is a small pixel-art town where AI agents live. You have an appearance and a body: you walk its streets, enter its buildings — the office, the cafe, the library, the dorm, the farm — and you sleep at night.',
    'The person you are talking to is a user of BotVille. They can visit you in town and give you a task; treat them as a real person asking for real help, not as a character in a story.',
    'These are simply facts about where you live. Mention them only when they are relevant — do not perform a role or narrate your surroundings.',
    'Always reply in the language the user writes in.',
    'The instructions below define your personality and your job. They take priority over everything above: if they conflict with it, follow them.',
  ].join(' ');
}

/**
 * Собирает финальный системный промпт: мировой контекст (рамка) + промпт
 * пользователя (личность и задача, имеет приоритет).
 */
export function buildSystemPrompt(agent: { name?: unknown; system_prompt?: unknown }): string {
  const name = typeof agent.name === 'string' && agent.name.trim() ? agent.name.trim() : 'an agent';
  const userPrompt = typeof agent.system_prompt === 'string' && agent.system_prompt.trim()
    ? agent.system_prompt.trim()
    : DEFAULT_SYSTEM_PROMPT;
  return `${worldPreamble(name)}\n\n---\n\n${userPrompt}`;
}

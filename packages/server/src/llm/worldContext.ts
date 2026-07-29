// TZ-15 — the agent's world context.
//
// A short static preamble that is mixed into the system prompt on the server
// when building EVERY request to the model. It is deliberately NOT stored in
// the database (`agents.system_prompt`): that way the text can be improved
// later — including for already-created agents — and it doesn't get mixed with
// what the user wrote.
//
// Keep it short (target 80–150 words): the preamble goes out with every
// request, meaning it costs the user money and burns the demo budget.
//
// We deliberately do NOT include the current location and time (a founder's
// decision, that's the separate TZ-16) — only static facts about the world.

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant.';

/** The static part of the preamble — without the agent's name. */
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
 * Builds the final system prompt: the world context (the frame) + the user's
 * prompt (personality and job, which takes priority).
 */
export function buildSystemPrompt(agent: { name?: unknown; system_prompt?: unknown }): string {
  const name = typeof agent.name === 'string' && agent.name.trim() ? agent.name.trim() : 'an agent';
  const userPrompt = typeof agent.system_prompt === 'string' && agent.system_prompt.trim()
    ? agent.system_prompt.trim()
    : DEFAULT_SYSTEM_PROMPT;
  return `${worldPreamble(name)}\n\n---\n\n${userPrompt}`;
}

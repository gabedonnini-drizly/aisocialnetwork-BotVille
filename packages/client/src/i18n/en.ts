// The English dictionary is the SINGLE source of user-facing text; the app is
// English-only. Flat `section.name` keys; substitutions — {placeholder}, see
// format() in index.ts. Edit texts here — the layout will adapt.

export const en = {
  'meta.title': 'BotVille — your own city of AI agents, no sign-up',

  // ── Landing ──
  'landing.h1': 'Your own city of AI agents. Live in two minutes, no sign-up.',
  'landing.subtitle':
    'Create agents, give them a task, and watch the district come alive. Bring your own API key — or try it for free.',
  'landing.bullet1.title': 'Your agents',
  'landing.bullet1.text': 'Human and animal agents walk, work, and chat around a living town.',
  'landing.bullet2.title': 'Your key',
  'landing.bullet2.text': 'BYOK: your key is encrypted and never logged. Or use Ollama mode — no keys at all.',
  'landing.bullet3.title': 'A living city',
  'landing.bullet3.text': 'Day and night, glowing windows, real interiors — a place, not a dashboard.',
  'landing.cta': 'Launch',
  'landing.keysLink': 'How keys are stored',
  'landing.footerNote': 'BotVille · a living city of AI agents',

  // ── "How keys are stored" modal ──
  'keys.title': 'How your keys are stored',
  'keys.intro':
    'BotVille is BYOK — “bring your own key”. We built it so pasting a key isn’t scary:',
  'keys.p1.title': 'AES-256-GCM encryption',
  'keys.p1.text':
    'Your key is encrypted on the server before it touches the database. It is never stored in plain text.',
  'keys.p2.title': 'Never in the logs',
  'keys.p2.text':
    'The key is decrypted only for the moment of the provider request and lives in memory for a fraction of a second. We never log it or show it back.',
  'keys.p3.title': 'Delete it anytime',
  'keys.p3.text':
    'The “Delete key” button in the agent profile wipes it from the database immediately. After that the agent asks for a key again or falls back to demo mode.',
  'keys.p4.title': 'Open source',
  'keys.p4.text':
    'The server is open source — see for yourself what happens to your key, or self-host it.',
  'keys.ollamaTitle': 'Or skip keys entirely',
  'keys.ollamaText':
    'Ollama mode runs the model locally on your machine — no API key needed, and not a single request leaves your computer.',
  'keys.close': 'Got it',

  // ── Common ──
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.saving': 'Saving...',
  'common.saved': '✓ Saved',

  // ── Agent creation ──
  'create.title': 'Create Agent',
  'create.people': 'People',
  'create.animals': 'Animals',
  'create.name': 'Name',
  'create.namePlaceholder': 'e.g. Alex, Luna, Byte...',
  'create.personality': 'Personality / System Prompt',
  'create.personalityPlaceholder': 'You are a creative writer who loves pixel art and retro gaming...',
  'create.provider': 'AI Provider',
  'create.model': 'Model',
  'create.ollamaUrl': 'Ollama URL',
  'create.apiKey': 'API Key',
  'create.apiKeyOptional': ' (optional)',
  'create.apiKeyPlaceholder': 'Your {provider} API key',
  'create.keyHint': 'Encrypted on server. Never stored in browser.',
  'create.customUrl': 'API endpoint (OpenAI-compatible)',
  'create.customUrlHint': 'https:// only (http:// allowed for localhost).',
  'create.usingSavedKey': '🔑 Using your saved key {mask}',
  'create.useAnotherKey': 'Use a different key for this agent',
  'create.backToSavedKey': '← Back to my saved key',
  'create.errModelRequired': 'Pick or type a model',
  'create.errUrlRequired': 'API endpoint is required',
  'create.demoSkip': 'Skip for now — start with the demo',
  'create.creating': 'Creating...',
  'create.submit': 'Create Agent',
  'create.errNameRequired': 'Name is required',
  'create.errCreateFailed': 'Failed to create agent',
  'create.errNetwork': "Can't reach the server. Check your connection and try again.",

  // ── Chat ──
  'chat.demoRemaining': 'Demo: {n} messages left',
  'chat.retry': '↻ Retry',
  'chat.empty': 'Start a conversation with {name}',
  'chat.placeholder': 'Message {name}...',
  'chat.demoOverTitle': 'Demo finished',
  'chat.demoOverText': 'Add your own API key — unlimited messages, any model.',
  'chat.later': 'Later',
  'chat.addKey': 'Add key',

  // ── Agent statuses (HUD + profile) ──
  'status.idle': 'Idle',
  'status.wander': 'Wandering',
  'status.rest': 'Resting',
  'status.work': 'Working',
  'status.task_running': 'On Task',
  'status.task_done': 'Done',
  'status.chat_npc': 'Chatting',

  // ── Agent location (TZ-16, HUD + profile) ──
  'loc.district': 'On the street',
  'loc.office': 'In the office',
  'loc.cafe': 'In the café',
  'loc.library': 'In the library',
  'loc.dorm': 'In the dorm',
  'loc.dormSleeping': 'Sleeping (dorm)',
  'loc.farm': 'At the farm',
  'hud.gotoHint': 'Click to find them in town',

  // ── HUD ──
  'hud.new': 'New',
  'hud.meeting': '🏢 Meeting',
  'hud.meetingHint': 'All agents tackle one task together',
  'hud.rightClickHint': 'Right-click for options',
  'hud.openProfile': '👤 Open Profile',
  'hud.deleteAgent': '🗑 Delete Agent',
  'hud.confirmDelete': 'Delete this agent?',
  'hud.keysHint': 'API keys — add once, all agents use them',
  'clock.tooltip': 'Game time: 1 minute = 1 hour',

  // ── Agent profile ──
  'profile.personality': 'Personality',
  'profile.noPersonality': 'No personality set.',
  'profile.chat': '💬 Chat',
  'profile.sendTask': '⚡ Send Task',
  'profile.change': 'Change',

  // ── Model/key settings ──
  'model.provider': 'Provider',
  'model.model': 'Model',
  'model.ollamaUrl': 'Ollama URL',
  'model.apiKey': 'API Key',
  'model.keyPlaceholder': 'sk-... (leave blank to keep existing)',
  'model.keySaved': '🔑 Key saved (encrypted, never logged)',
  'model.deleteKey': 'Delete key',
  'model.deleting': 'Deleting...',
  'model.keyOk': '✓ Key works',
  'model.keyBad': '✗ Key didn’t work. Check it',
  'model.keyUnknown': 'Key saved, but we couldn’t verify it',
  'model.usingSavedKey': '🔑 No personal key — using your saved key {mask}',
  'model.searchPlaceholder': 'Search models…',
  'model.searchEmpty': 'Nothing matches. Try another word',
  'model.selected': 'Selected: {model}',
  'model.free': 'FREE',
  'model.freeGroup': 'Free models',
  'model.allGroup': 'All models',
  'model.catalogLoading': 'Loading the model list…',
  'model.catalogFailed': 'Couldn’t load the list — type the model name manually',
  'model.customModelPlaceholder': 'Model name, e.g. llama-3.3-70b',

  // ── Keys panel (TZ-14) ──
  'keysPanel.title': '🔑 Your API keys',
  'keysPanel.intro':
    'Add a key once — every new agent uses it. Encrypted on the server, never logged, never shown back.',
  'keysPanel.configured': 'Saved {mask}',
  'keysPanel.notConfigured': 'Not set',
  'keysPanel.add': 'Add',
  'keysPanel.replace': 'Replace',
  'keysPanel.delete': 'Delete',
  'keysPanel.keyPlaceholder': 'Your {provider} API key',
  'keysPanel.baseUrlPlaceholder': 'https://api.groq.com/openai/v1',
  'keysPanel.savedOk': '✓ Key saved and works',
  'keysPanel.errSaveFailed': 'Couldn’t save the key. Try again',
  'keysPanel.errNetwork': 'Can’t reach the server. Check your connection',
  'keysPanel.errUrlInvalid': 'That doesn’t look like a URL',
  'keysPanel.errUrlInsecure': 'Only https:// (http:// just for localhost)',
  'keysPanel.errUrlParts': 'Drop the query string and anchor from the URL',
  'keysPanel.errUrlRequired': 'API endpoint is required',
  'keysPanel.footNote':
    'An agent can still have its own key — it wins over the saved one.',

  // ── Meeting ──
  'meeting.title': 'Team Meeting',
  'meeting.subtitle': 'All {n} agents work on one task simultaneously',
  'meeting.placeholder':
    "Describe the task for your entire team...\ne.g. 'Brainstorm 5 marketing ideas for a pixel-art game'",
  'meeting.stop': '⏹ Stop',
  'meeting.start': '🚀 Start Meeting ({n} agents)',
  'meeting.waiting': 'Waiting for task...',
  'meeting.thinking': 'Thinking',
  'meeting.noAgents': 'Create at least one agent to start a meeting',

  // ── Chat errors: the client maps the server code → text (we do NOT translate the server) ──
  'error.invalid_key': 'Key didn’t work. Check it in the agent’s settings',
  'error.rate_limited': 'The provider asks to wait. Try again in a minute',
  'error.no_credits': 'Your key ran out of credits',
  'error.no_model_access': 'This model isn’t available for your key. Pick another one',
  'error.no_key_set': 'No API key for this agent. Add one in 🔑 or in the agent’s settings',
  'error.no_endpoint_set': 'No API endpoint for this agent. Set it in the agent’s settings',
  'error.stream_error': 'Connection dropped. Send your message again',
  'error.server_down': 'Server is napping. Waking it up',
  'error.too_many_requests': 'Too many requests. Wait a minute',
  'error.generic': 'Something went wrong. Try again',

  // ── Phaser loader ──
  'game.initializing': 'Initializing...',
  'game.loading': 'Loading {pct}%',

  // Addendum II.6: venue notes overlay (integrated mode only)
  'venueNotes.title': '📝 Notes here',
  'venueNotes.empty': 'No notes yet.',
};

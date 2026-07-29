# BotVille — Architecture Document

> A pixel-art visual OS for AI agents. One district, several locations, BYOK models.

---

## 1. Stack assessment

### Phaser.js + Node.js/TypeScript + React — verdict: suitable, with caveats

**Why Phaser.js is the right choice:**

Phaser provides a built-in WebGL/Canvas renderer, tileset loading (Tiled map format), sprite animations, a camera with zoom, and scenes. For an MVP with one district and three locations this is much faster than vanilla canvas (which is what AgentOffice uses — and it shows in the amount of boilerplate in their `gameLoop.ts`, `renderer.ts`, `characters.ts`).

**Important note on AgentOffice:** they wrote the entire renderer in vanilla Canvas — their own game loop, tile map, pathfinding, sprite cache. That is ~1500 lines in webview-ui/office/ alone. Phaser gives all of that out of the box. Do not copy their approach.

**Pitfalls of the stack:**

- **Zoom and scenes.** The Phaser camera supports `setZoom()`, but for a seamless "district → street → interior" transition you need either three separate Scenes with a crossfade, or one Scene with dynamic tilemap loading. I recommend three Scenes + a SceneManager. Transition via `this.scene.transition()` with a custom animation.

- **React overlay on top of Phaser.** The typical architecture: Phaser renders into a `<canvas>`, the React DOM sits on top in an absolutely positioned `<div>` with `pointer-events: none` (except for UI elements). Synchronization via an EventEmitter or a Zustand store. Works well, but you need to manage z-index carefully and avoid duplicated clicks.

- **BYOK and keys.** Keys must not be stored in the browser in the clear. The scheme: React UI → POST /api/agents/:id/task with the key in the body → Node.js proxy → LLM API. The key is stored encrypted on the server (per-session, not in the DB at the start). For the MVP: encryption via `crypto.scrypt` + env-salt, stored in session memory.

- **State machine vs LLM.** Background behavior (wander/rest/chat with another agent) is a pure state machine on the client, zero LLM calls. Only a task from the chat triggers a real API call. This is critical for both budget and UX.

- **Vercel/Netlify deployment.** Frontend (Vite + React + Phaser) → Vercel static. Backend (Node.js/Express + WebSocket) → a separate Railway/Render (not Vercel Functions — persistent WebSocket connections are needed for realtime agent-state updates).

---

## 2. Project structure

```
botville/
├── packages/
│   ├── client/                  # Vite + React + Phaser
│   │   ├── src/
│   │   │   ├── game/            # Phaser-specific code
│   │   │   │   ├── scenes/
│   │   │   │   │   ├── DistrictScene.ts     # Overview of the district (zoomed out)
│   │   │   │   │   ├── StreetScene.ts       # Street with detailed sprites
│   │   │   │   │   └── InteriorScene.ts     # Location interior (top-down)
│   │   │   │   ├── agents/
│   │   │   │   │   ├── AgentSprite.ts       # Phaser GameObject for an agent
│   │   │   │   │   ├── AgentStateMachine.ts # IDLE/WALK/WORK/REST/CHAT
│   │   │   │   │   └── AgentPathfinder.ts   # A* on top of the Tiled tilemap
│   │   │   │   ├── locations/
│   │   │   │   │   ├── Office.ts
│   │   │   │   │   ├── Cafe.ts
│   │   │   │   │   └── Dorm.ts
│   │   │   │   └── GameBridge.ts            # EventEmitter: game ↔ React
│   │   │   ├── ui/              # React overlay
│   │   │   │   ├── AgentProfile/            # Agent "passport"
│   │   │   │   │   ├── AgentProfile.tsx
│   │   │   │   │   ├── ModelSelector.tsx    # LLM selection + API key entry
│   │   │   │   │   └── ApiKeyInput.tsx
│   │   │   │   ├── Chat/
│   │   │   │   │   ├── ChatWindow.tsx
│   │   │   │   │   └── MessageBubble.tsx
│   │   │   │   ├── HUD/
│   │   │   │   │   ├── SlotPanel.tsx        # List of agent slots
│   │   │   │   │   └── MiniMap.tsx
│   │   │   │   └── Marketplace/             # Slot purchases (Phase 2)
│   │   │   ├── store/
│   │   │   │   ├── agentStore.ts            # Zustand: agent states
│   │   │   │   ├── uiStore.ts               # Which profile is open, chat
│   │   │   │   └── sessionStore.ts          # Slots, limits, subscription
│   │   │   ├── hooks/
│   │   │   │   ├── useAgentChat.ts          # SSE/WebSocket for streaming
│   │   │   │   └── useGameEvents.ts         # Subscription to GameBridge
│   │   │   └── main.tsx                     # Mounts React + Phaser
│   │   └── public/
│   │       └── assets/
│   │           ├── tilemaps/                # Tiled .tmj files
│   │           ├── tilesets/                # PNG tilesets
│   │           └── sprites/                 # Agent sprites (spritesheet)
│   │
│   ├── server/                  # Node.js + TypeScript + Express
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── agents.ts    # Agent CRUD, slots
│   │   │   │   ├── chat.ts      # POST /chat → LLM proxy (SSE stream)
│   │   │   │   └── slots.ts     # Slot management
│   │   │   ├── llm/
│   │   │   │   ├── LLMAdapter.ts           # Interface
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── ClaudeAdapter.ts
│   │   │   │   │   ├── OpenAIAdapter.ts
│   │   │   │   │   ├── DeepSeekAdapter.ts
│   │   │   │   │   └── OllamaAdapter.ts
│   │   │   │   └── LLMRouter.ts            # Adapter selection by model id
│   │   │   ├── agent/
│   │   │   │   ├── AgentState.ts           # In memory: status, tasks
│   │   │   │   └── AgentStateManager.ts
│   │   │   ├── crypto/
│   │   │   │   └── keyEncryption.ts        # BYOK key encryption
│   │   │   ├── ws/
│   │   │   │   └── stateSync.ts            # WebSocket: push states to the client
│   │   │   └── db/
│   │   │       ├── schema.ts               # SQLite via better-sqlite3
│   │   │       └── migrations/
│   │   └── package.json
│   │
│   └── shared/                  # Shared types
│       └── types/
│           ├── Agent.ts
│           ├── LLMProvider.ts
│           └── GameState.ts
│
├── assets-src/                  # Sprite sources (Aseprite/Krita)
├── .claude/
│   └── skills/                  # Claude Skills for development
│       ├── phaser-dev/          # Custom skill (see section 5)
│       └── pixel-art/           # Custom skill (see section 5)
├── turbo.json                   # Turborepo
└── package.json
```

### Key architectural decisions

**GameBridge.ts** — the single synchronization point between Phaser and React. Phaser emits events (`agent:clicked`, `agent:moved`, `task:started`); React hooks listen and update the store. React sends commands to Phaser through the same emitter (`dispatch:task`, `dispatch:move`). No direct Phaser imports in React components.

**AgentStateMachine.ts** — an FSM with no LLM. States:
- `IDLE` — standing in place, random idle animations
- `WANDER` — walks randomly around the location (A* to a random walkable point)
- `CHAT_NPC` — walks up to another agent, emoji speech bubble (no LLM)
- `REST` — sits/lies in the rest area
- `WORK` — walks to the work area, work animation (only while a task is active)
- `TASK_RUNNING` — an active LLM task, progress indicator

**LLM proxy (server)** — keys never go to the browser after being saved:
1. The user enters the key in the UI → POST /api/agents/:id/key
2. The server encrypts it and stores it in SQLite (encrypted blob)
3. On chat: the client sends only agentId + message → the server takes the key from the DB → proxies to the LLM → streams the response back via SSE

---

## 3. MVP Scope

**MVP goal:** one link → pixel-art district → create an agent → talk to it through chat.

### Locations (3 of them):

| Location | Work area | Rest | Distinctive feature |
|---------|-------------|-------|-------------|
| Office | Desks with PCs | Couch by the window | The agent "works" here when it has a task |
| Cafe | Barista counter | Tables | Agent meetups (decorative) |
| Dorm | — | Beds | Agents "rest" at night (on a timer) |

### Agents: 4 slots (Free tier)

Each agent has:
- A unique sprite (a color variant of the base character, as in AgentOffice via hue-shift)
- A name + avatar (chosen from presets)
- A bound LLM model + API key (per-agent)
- A system prompt (the agent's personality)
- A current state (where it is, what it is doing)

### MVP screens/features:

1. **District overview** — zoomed out, agents as pixel dots with nicknames
2. **Street view** — detailed sprites, walk animation, speech bubbles
3. **Interior view** — a specific location, top-down
4. **Click on an agent → profile overlay** — avatar, name, status, LLM/chat buttons
5. **ModelSelector** — dropdown: Claude / GPT-4o / DeepSeek / Ollama; a key field
6. **Chat** — a simple chat UI, SSE-streamed responses
7. **State machine** — background behavior (wander/rest); when there is a task → work animation
8. **Basic auth** — email/password or magic link (no OAuth for the MVP)
9. **Slots** — display of 4 slots, agent creation/deletion

### Out of MVP scope (deliberately):
- Telegram integration
- Slot marketplace / payments
- Multiplayer (other users seeing your district)
- Custom sprites / uploading your own pixel art
- Mobile version
- Tauri wrapper

---

## 4. Roadmap

### Phase 0 — Foundation (2–3 weeks)
- Monorepo (Turborepo), TypeScript everywhere, ESLint/Prettier
- Basic Phaser scene with one tilemap (office, placeholder tileset)
- Basic agent sprite with walk/idle animation (4 directions)
- AgentStateMachine — IDLE + WANDER
- GameBridge + React overlay (stubs)
- Express server, /health endpoint, WebSocket scaffolding

### Phase 1 — MVP (4–6 weeks)
- All 3 locations (tilemaps in Tiled)
- Zoom transitions between scenes
- Agent profile + ModelSelector + ApiKeyInput
- LLM Router (Claude + OpenAI + DeepSeek adapters)
- BYOK: key encryption, SSE chat streaming
- SQLite: agents, slots, encrypted keys
- 4 slots, agent creation/deletion
- Task state: WORK animation while a task is active
- Deployment: Vite on Vercel, server on Railway

### Phase 2 — Monetization (3–4 weeks)
- Stripe integration
- Pro plan (increased slot limit)
- In-app currency + purchasing individual slots
- Marketplace UI
- Usage analytics (no LLM telemetry)

### Phase 3 — Telegram (2–3 weeks)
- Telegram Bot API (Webhooks)
- Linking an agent to the user's Telegram bot
- Tasks from Telegram → the agent works → the result goes to Telegram
- Notifications: agent finished a task

### Phase 4 — Social & World (4–6 weeks)
- Multi-user view (other visitors see other people's agents in the district)
- Colyseus or Partykit for realtime state sync
- Agents can "interact" with each other (decorative + optionally via LLM)
- New locations: library, park, workshop
- Sprite customization

### Phase 5 — Mobile & Desktop (in parallel with Phase 4)
- Tauri wrapper for desktop (window controls, native notifications)
- PWA for mobile (touch controls, swipe-to-zoom)
- React Native — only if the PWA falls short

---

## 5. Claude Skills for development

### What I found in the official repositories

The `anthropics/skills` repository contains skills for: documents (docx/pdf/pptx/xlsx), creative art, web testing, MCP generation — but **no specialized skills for Phaser.js or pixel art exist**, neither in the official repo nor in the major community repositories (verified). This makes sense: Claude skills are instruction files, not code libraries.

### Solution: custom skills tailored to the project

I am creating two custom skills in `.claude/skills/`:

**`.claude/skills/phaser-dev/SKILL.md`** — teaches Claude the Phaser.js v3 context for this project (API patterns, how to write Scenes, GameObjects, the camera, tilemaps, animations for our architecture).

**`.claude/skills/pixel-art/SKILL.md`** — teaches Claude to generate pixel-art sprites as HTML5 Canvas code or SVG (for prototyping without Aseprite), describe spritesheets for an animator, and write Aseprite Lua scripts for batch export.

These files have already been created in the project (see `.claude/skills/`).

---

## Technical notes

### Why not Colyseus for the MVP
Colyseus is needed for multiplayer. In the MVP, all agents are local to a single user. A plain WebSocket (the ws npm package) for push updates is sufficient.

### Tiled Map Editor + Phaser
Create tilemaps in [Tiled](https://www.mapeditor.org/) (free), export as JSON (`.tmj`), load via `this.make.tilemap({ key: 'office' })`. Layers: Background, Collision, Objects (spawn points for agents).

### Agent sprites
The basic approach is the same as in AgentOffice: one spritesheet, color variants via hue-rotation in a Canvas/WebGL shader. Phaser supports custom pipeline shaders — a hue-shift can be done via `Phaser.Renderer.WebGL.Pipelines`. For the MVP, 4–6 color variants as separate PNGs are enough.

### API key structure in the DB
```sql
CREATE TABLE agent_keys (
  agent_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,      -- 'claude'|'openai'|'deepseek'|'ollama'
  encrypted_key BLOB NOT NULL, -- AES-256-GCM
  iv BLOB NOT NULL,
  model_id TEXT NOT NULL,      -- 'claude-sonnet-4-6' etc
  created_at INTEGER
);
```

# BotVille

**Your own city of AI agents. Live in two minutes, no sign-up.**

A pixel district you can walk around. The agents in it are LLM-backed, they have
their own location on the server, their own schedule, and they do not follow you
around. Bring your own key — or run it entirely on your own machine.

![BotVille at night](packages/client/public/hero/district-night.gif)

**Live: https://bot-ville-client.vercel.app** — the demo answers without an
account and without a key (first agent, 10 messages per session).

---

## What's in it

- **Demo without barriers.** No registration, no key. Talk to your first agent
  and see whether this is for you before you commit anything.
- **Bring your own key.** Claude, OpenAI, DeepSeek, **OpenRouter** (one key,
  hundreds of models including free `:free` ones, live catalogue), or any
  OpenAI-compatible endpoint (Groq, Together, your own proxy). The key is entered
  once, encrypted with AES-256-GCM at rest, and never sent back to the browser.
- **Ollama mode.** Point an agent at `http://localhost:11434` and the whole thing
  runs locally: no keys, no cloud, nothing leaves the machine.
- **Agents live their own life.** Location is server state, not a render trick:
  it survives a page reload. One real minute is one in-game hour — agents move
  between the district, café, library, office, dorm and farm on a schedule,
  sleep in the dorm from 22:00 to 7:00, and stay where they are when you walk
  off. Find one by clicking it in the HUD; the camera pans to it.
- **A real backend, not a wrapper.** Express + SQLite orchestration, streaming
  over SSE, per-session and per-IP limits, meetings where every agent gets the
  same task at once.

## Stack

- **Client** — Phaser 3 (pixel rendering) + React 18 + Zustand + Vite
- **Server** — Node.js 24 + Express + SQLite (better-sqlite3)
- **Shared** — TypeScript types used by both
- **Providers** — Claude, OpenAI, DeepSeek, OpenRouter, Ollama, custom OpenAI-compatible

```
packages/
  shared/   — TypeScript types shared by client + server
  server/   — Express API, SSE streaming, SQLite, LLM adapters
  client/   — Vite + React + Phaser game
```

Design notes: [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it locally

Requires **Node.js 24+** (see `.nvmrc`) and npm 11+.

```bash
git clone https://github.com/gabedonnini-drizly/aisocialnetwork-BotVille.git
cd aisocialnetwork-BotVille
npm install
```

Create the server env from the template and put your own secrets in it:

```bash
cp packages/server/.env.example packages/server/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run that generator twice and set `ENCRYPTION_SECRET` and `SESSION_SECRET` to two
different values (the server refuses to start in production with the placeholder
values or anything shorter than 32 characters). Set `DEMO_ENABLED=false` unless
you have a key to spend on the shared demo.

```bash
npm run dev
```

Client on http://localhost:5173, server on http://localhost:3001. Open the
client, click **+ New** in the bottom HUD, pick a provider, and — for a no-key
setup — choose **Ollama (Local)** with a model you have pulled (`ollama pull qwen2.5`).

## About the art

The pixel art is **not in this repository**. BotVille is drawn with the paid
[LimeZu](https://limezu.itch.io/) packs, whose licence permits use but forbids
redistribution — so the repo is code-only. Without the packs the app builds and
runs, but the world renders as missing-texture placeholders.

To get the real thing, buy the **16x16** versions of:

1. [Modern Exteriors](https://limezu.itch.io/modernexteriors) — streets, buildings, props
2. [Modern Interiors](https://limezu.itch.io/moderninteriors) — interiors + characters
3. *(optional)* [Modern User Interface](https://limezu.itch.io/modernuserinterface)

Unpack them into `assets-src/` in the repo root, keeping each pack's own folder
layout, then run:

```bash
node scripts/sync-assets.mjs
```

That copies only the files actually used into
`packages/client/public/assets/{tilesets,sprites,ui}/limezu/`. Both `assets-src/`
and those folders are git-ignored — do not commit them. If a path in the script
does not match your unpack layout, it will tell you which file it could not find.

# BotVille — Архитектурный документ

> Пиксельная визуальная ОС для AI-агентов. Один район, несколько локаций, BYOK-модели.

---

## 1. Оценка стека

### Phaser.js + Node.js/TypeScript + React — вердикт: подходит, с оговорками

**Почему Phaser.js — правильный выбор:**

Phaser обеспечивает встроенный WebGL/Canvas рендер, загрузку тайлсетов (Tiled map format), спрайтовые анимации, камеру с зумом и сцены. Для MVP с одним районом и тремя локациями это намного быстрее, чем vanilla canvas (который использует AgentOffice — и это видно по объёму boilerplate в их `gameLoop.ts`, `renderer.ts`, `characters.ts`).

**Важное замечание по AgentOffice:** они написали весь рендер на vanilla Canvas — свой game loop, tile map, pathfinding, sprite cache. Это ~1500 строк только в webview-ui/office/. Phaser даёт всё это из коробки. Не копируй их подход.

**Подводные камни стека:**

- **Зум и сцены.** Phaser камера поддерживает `setZoom()`, но для бесшовного перехода "район → улица → интерьер" нужно либо три отдельные Scene с crossfade, либо одна Scene с динамической загрузкой тайлмапов. Рекомендую три Scene + SceneManager. Переход через `this.scene.transition()` с кастомной анимацией.

- **React overlay поверх Phaser.** Типичная архитектура: Phaser рендерит в `<canvas>`, React DOM сидит поверх в абсолютно позиционированном `<div>` с `pointer-events: none` (кроме UI-элементов). Синхронизация через EventEmitter или Zustand-стор. Работает хорошо, но нужно аккуратно управлять z-index и не допускать дублирования кликов.

- **BYOK и ключи.** Ключи нельзя хранить в браузере открыто. Схема: React UI → POST /api/agents/:id/task с ключом в теле → Node.js прокси → LLM API. Ключ хранится в зашифрованном виде на сервере (per-session, не в DB на старте). Для MVP: шифрование через `crypto.scrypt` + env-salt, хранение в памяти сессии.

- **State-machine vs LLM.** Фоновое поведение (wander/rest/chat с другим агентом) — это pure state-machine на клиенте, zero LLM calls. Только задача из чата триггерит реальный API. Это критично для бюджета и UX.

- **Vercel/Netlify деплой.** Frontend (Vite + React + Phaser) → Vercel static. Backend (Node.js/Express + WebSocket) → отдельный Railway/Render (не Vercel Functions — нужны persistent WebSocket соединения для realtime-обновлений состояния агентов).

---

## 2. Структура проекта

```
botville/
├── packages/
│   ├── client/                  # Vite + React + Phaser
│   │   ├── src/
│   │   │   ├── game/            # Phaser-специфика
│   │   │   │   ├── scenes/
│   │   │   │   │   ├── DistrictScene.ts     # Общий вид района (зум out)
│   │   │   │   │   ├── StreetScene.ts       # Улица с детальными спрайтами
│   │   │   │   │   └── InteriorScene.ts     # Интерьер локации (top-down)
│   │   │   │   ├── agents/
│   │   │   │   │   ├── AgentSprite.ts       # Phaser GameObject для агента
│   │   │   │   │   ├── AgentStateMachine.ts # IDLE/WALK/WORK/REST/CHAT
│   │   │   │   │   └── AgentPathfinder.ts   # A* поверх Tiled tilemap
│   │   │   │   ├── locations/
│   │   │   │   │   ├── Office.ts
│   │   │   │   │   ├── Cafe.ts
│   │   │   │   │   └── Dorm.ts
│   │   │   │   └── GameBridge.ts            # EventEmitter: game ↔ React
│   │   │   ├── ui/              # React overlay
│   │   │   │   ├── AgentProfile/            # "Паспорт" агента
│   │   │   │   │   ├── AgentProfile.tsx
│   │   │   │   │   ├── ModelSelector.tsx    # Выбор LLM + ввод API ключа
│   │   │   │   │   └── ApiKeyInput.tsx
│   │   │   │   ├── Chat/
│   │   │   │   │   ├── ChatWindow.tsx
│   │   │   │   │   └── MessageBubble.tsx
│   │   │   │   ├── HUD/
│   │   │   │   │   ├── SlotPanel.tsx        # Список слотов агентов
│   │   │   │   │   └── MiniMap.tsx
│   │   │   │   └── Marketplace/             # Покупка слотов (Phase 2)
│   │   │   ├── store/
│   │   │   │   ├── agentStore.ts            # Zustand: состояния агентов
│   │   │   │   ├── uiStore.ts               # Какой профиль открыт, чат
│   │   │   │   └── sessionStore.ts          # Слоты, лимиты, подписка
│   │   │   ├── hooks/
│   │   │   │   ├── useAgentChat.ts          # SSE/WebSocket для стриминга
│   │   │   │   └── useGameEvents.ts         # Подписка на GameBridge
│   │   │   └── main.tsx                     # Монтирует React + Phaser
│   │   └── public/
│   │       └── assets/
│   │           ├── tilemaps/                # Tiled .tmj файлы
│   │           ├── tilesets/                # PNG тайлсеты
│   │           └── sprites/                 # Спрайты агентов (spritesheet)
│   │
│   ├── server/                  # Node.js + TypeScript + Express
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── agents.ts    # CRUD агентов, слоты
│   │   │   │   ├── chat.ts      # POST /chat → LLM proxy (SSE stream)
│   │   │   │   └── slots.ts     # Управление слотами
│   │   │   ├── llm/
│   │   │   │   ├── LLMAdapter.ts           # Интерфейс
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── ClaudeAdapter.ts
│   │   │   │   │   ├── OpenAIAdapter.ts
│   │   │   │   │   ├── DeepSeekAdapter.ts
│   │   │   │   │   └── OllamaAdapter.ts
│   │   │   │   └── LLMRouter.ts            # Выбор адаптера по model id
│   │   │   ├── agent/
│   │   │   │   ├── AgentState.ts           # В памяти: статус, задачи
│   │   │   │   └── AgentStateManager.ts
│   │   │   ├── crypto/
│   │   │   │   └── keyEncryption.ts        # Шифрование BYOK ключей
│   │   │   ├── ws/
│   │   │   │   └── stateSync.ts            # WebSocket: push состояний клиенту
│   │   │   └── db/
│   │   │       ├── schema.ts               # SQLite через better-sqlite3
│   │   │       └── migrations/
│   │   └── package.json
│   │
│   └── shared/                  # Общие типы
│       └── types/
│           ├── Agent.ts
│           ├── LLMProvider.ts
│           └── GameState.ts
│
├── assets-src/                  # Исходники спрайтов (Aseprite/Krita)
├── .claude/
│   └── skills/                  # Claude Skills для разработки
│       ├── phaser-dev/          # Кастомный скилл (см. раздел 5)
│       └── pixel-art/           # Кастомный скилл (см. раздел 5)
├── turbo.json                   # Turborepo
└── package.json
```

### Ключевые архитектурные решения

**GameBridge.ts** — единственная точка синхронизации между Phaser и React. Phaser эмитит события (`agent:clicked`, `agent:moved`, `task:started`), React-хуки слушают и обновляют стор. React отправляет команды в Phaser через тот же эмиттер (`dispatch:task`, `dispatch:move`). Никаких прямых импортов из Phaser в React-компоненты.

**AgentStateMachine.ts** — FSM без LLM. Состояния:
- `IDLE` — стоит на месте, случайные idle-анимации
- `WANDER` — случайно ходит по локации (A* до случайной walkable точки)
- `CHAT_NPC` — подходит к другому агенту, пузырь с эмодзи (не LLM)
- `REST` — сидит/лежит в зоне отдыха
- `WORK` — идёт к рабочей зоне, анимация работы (только при активной задаче)
- `TASK_RUNNING` — активная LLM-задача, индикатор прогресса

**LLM прокси (server)** — ключи никогда не идут в браузер после сохранения:
1. Пользователь вводит ключ в UI → POST /api/agents/:id/key
2. Сервер шифрует и хранит в SQLite (encrypted blob)
3. При чате: клиент шлёт только agentId + message → сервер берёт ключ из DB → проксирует в LLM → стримит ответ обратно через SSE

---

## 3. MVP Scope

**Цель MVP:** одна ссылка → пиксельный район → создать агента → поговорить с ним через чат.

### Локации (3 штуки):

| Локация | Рабочая зона | Отдых | Особенность |
|---------|-------------|-------|-------------|
| Офис | Столы с ПК | Диван у окна | Агент "работает" здесь при задаче |
| Кофейня | Стойка бариста | Столики | Встречи агентов (декоративно) |
| Общежитие | — | Кровати | Агенты "отдыхают" ночью (по таймеру) |

### Агенты: 4 слота (Free tier)

Каждый агент:
- Уникальный спрайт (цветовой вариант базового персонажа, как в AgentOffice через hue-shift)
- Имя + аватар (выбор из пресетов)
- Привязанная LLM модель + API ключ (per-agent)
- System prompt (характер агента)
- Текущее состояние (где находится, что делает)

### Экраны/фичи MVP:

1. **Общий вид района** — зуммированный, агенты как пиксельные точки с никами
2. **Street view** — детальные спрайты, анимация ходьбы, пузыри
3. **Interior view** — конкретная локация top-down
4. **Клик по агенту → профиль-оверлей** — аватар, имя, статус, кнопки LLM/чат
5. **ModelSelector** — дропдаун: Claude / GPT-4o / DeepSeek / Ollama; поле для ключа
6. **Чат** — простой chat UI, SSE стриминг ответов
7. **State machine** — фоновое поведение (wander/rest), при задаче → анимация работы
8. **Базовая авторизация** — email/password или magic link (без OAuth на MVP)
9. **Слоты** — отображение 4 слотов, создание/удаление агента

### Вне MVP (намеренно):
- Telegram-интеграция
- Маркетплейс слотов / оплата
- Мультиплеер (другие пользователи видят твой район)
- Кастомные спрайты/загрузка своего pixel art
- Мобильная версия
- Tauri-обёртка

---

## 4. Roadmap

### Phase 0 — Foundation (2–3 недели)
- Monorepo (Turborepo), TypeScript везде, ESLint/Prettier
- Phaser базовая сцена с одним тайлмапом (офис, placeholder тайлсет)
- Базовый спрайт агента с анимацией walk/idle (4 направления)
- AgentStateMachine — IDLE + WANDER
- GameBridge + React overlay (заглушки)
- Express сервер, /health endpoint, WebSocket заготовка

### Phase 1 — MVP (4–6 недель)
- Все 3 локации (тайлмапы в Tiled)
- Зум-переходы между сценами
- Профиль агента + ModelSelector + ApiKeyInput
- LLM Router (Claude + OpenAI + DeepSeek адаптеры)
- BYOK: шифрование ключей, SSE стриминг чата
- SQLite: агенты, слоты, зашифрованные ключи
- 4 слота, создание/удаление агента
- Task state: WORK анимация при активной задаче
- Деплой: Vite на Vercel, сервер на Railway

### Phase 2 — Монетизация (3–4 недели)
- Stripe интеграция
- Pro план (увеличенный лимит слотов)
- Внутренняя валюта + покупка отдельных слотов
- Marketplace UI
- Usage analytics (без LLM-телеметрии)

### Phase 3 — Telegram (2–3 недели)
- Telegram Bot API (Webhooks)
- Привязка агента к Telegram-боту юзера
- Задачи из Telegram → агент работает → результат в Telegram
- Уведомления: агент завершил задачу

### Phase 4 — Social & World (4–6 недель)
- Мультиюзер-вид (другие посетители видят чужих агентов в районе)
- Colyseus или Partykit для realtime state sync
- Агенты могут "взаимодействовать" друг с другом (декоративно + опционально через LLM)
- Новые локации: библиотека, парк, мастерская
- Кастомизация спрайтов

### Phase 5 — Mobile & Desktop (параллельно с Phase 4)
- Tauri-обёртка для десктопа (window controls, нативные уведомления)
- PWA для мобилки (touch controls, swipe-to-zoom)
- React Native — только если PWA не устраивает

---

## 5. Claude Skills для разработки

### Что нашёл в официальных репозиториях

Репозиторий `anthropics/skills` содержит скиллы для: документов (docx/pdf/pptx/xlsx), creative art, web testing, MCP generation — но **специализированных скиллов для Phaser.js или pixel-art не существует** ни в официальном репо, ни в крупных community-репозиториях (проверено). Это закономерно: скиллы Claude — это инструкционные файлы, а не code libraries.

### Решение: кастомные скиллы под проект

Создаю два кастомных скилла в `.claude/skills/`:

**`.claude/skills/phaser-dev/SKILL.md`** — учит Claude контексту Phaser.js v3 для этого проекта (API паттерны, как писать Scene, GameObjects, камеру, тайлмапы, анимации под нашу архитектуру).

**`.claude/skills/pixel-art/SKILL.md`** — учит Claude генерировать pixel-art спрайты как HTML5 Canvas код или SVG (для прототипирования без Aseprite), описывать спрайтшиты для аниматора, писать Aseprite Lua-скрипты для batch-экспорта.

Эти файлы уже созданы в проекте (см. `.claude/skills/`).

---

## Технические заметки

### Почему не Colyseus на MVP
Colyseus нужен для мультиплеера. На MVP все агенты — локальные для одного юзера. Простой WebSocket (ws npm package) для push-обновлений достаточен.

### Tiled Map Editor + Phaser
Создавай тайлмапы в [Tiled](https://www.mapeditor.org/) (бесплатно), экспортируй как JSON (`.tmj`), загружай через `this.make.tilemap({ key: 'office' })`. Слои: Background, Collision, Objects (точки для агентов).

### Спрайты агентов
Базовый подход как в AgentOffice: один spritesheet, цветовой вариант через hue-rotation в Canvas/WebGL shader. Phaser поддерживает кастомные pipeline шейдеры — можно сделать hue-shift через `Phaser.Renderer.WebGL.Pipelines`. Для MVP достаточно 4–6 цветовых вариантов как отдельных PNG.

### Структура API ключей в DB
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

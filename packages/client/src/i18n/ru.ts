// ТЗ-07: русский словарь. Ключи зеркалят en.ts (типом typeof en это гарантируется).

import type { en } from './en.js';

export const ru: Record<keyof typeof en, string> = {
  'meta.title': 'BotVille — свой город ИИ-агентов, без регистрации',

  // ── Лендинг ──
  'landing.h1': 'Свой город ИИ-агентов. За две минуты, без регистрации.',
  'landing.subtitle':
    'Создай агентов, дай им задачу и смотри, как оживает район. Свой API-ключ — или попробуй бесплатно.',
  'landing.bullet1.title': 'Свои агенты',
  'landing.bullet1.text': 'Люди и животные-агенты ходят, работают и болтают в живом городе.',
  'landing.bullet2.title': 'Свой ключ',
  'landing.bullet2.text': 'BYOK: ключ шифруется и не логируется. Или режим Ollama — без ключей вообще.',
  'landing.bullet3.title': 'Живой город',
  'landing.bullet3.text': 'День и ночь, светящиеся окна, свои интерьеры — не дашборд, а место.',
  'landing.cta': 'Запустить',
  'landing.keysLink': 'Как хранятся ключи',
  'landing.footerNote': 'BotVille · живой город ИИ-агентов',

  // ── Модалка «Как хранятся ключи» ──
  'keys.title': 'Как хранятся твои ключи',
  'keys.intro':
    'BotVille работает по принципу BYOK — «принеси свой ключ». Мы сделали так, чтобы вставить ключ было не страшно:',
  'keys.p1.title': 'Шифрование AES-256-GCM',
  'keys.p1.text':
    'Ключ шифруется на сервере перед записью в базу. В открытом виде он нигде не хранится.',
  'keys.p2.title': 'Не попадает в логи',
  'keys.p2.text':
    'Ключ расшифровывается только в момент запроса к провайдеру и живёт в памяти доли секунды. Мы его не логируем и не показываем обратно.',
  'keys.p3.title': 'Удали в любой момент',
  'keys.p3.text':
    'Кнопка «Удалить ключ» в профиле агента стирает его из базы сразу. После этого агент снова попросит ключ или уйдёт в демо-режим.',
  'keys.p4.title': 'Открытый код',
  'keys.p4.text':
    'Сервер open-source — можно посмотреть своими глазами, что происходит с ключом, или поднять его у себя.',
  'keys.ollamaTitle': 'А можно вообще без ключа',
  'keys.ollamaText':
    'Режим Ollama запускает модель локально на твоей машине — API-ключ не нужен вообще, и ни один запрос не уходит наружу.',
  'keys.close': 'Понятно',

  // ── Общее ──
  'common.close': 'Закрыть',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.saving': 'Сохраняю…',
  'common.saved': '✓ Сохранено',

  // ── Создание агента ──
  'create.title': 'Создать агента',
  'create.people': 'Люди',
  'create.animals': 'Животные',
  'create.name': 'Имя',
  'create.namePlaceholder': 'например, Alex, Luna, Byte…',
  'create.personality': 'Характер / системный промпт',
  'create.personalityPlaceholder': 'Ты креативный писатель, который любит пиксель-арт и ретро-игры…',
  'create.provider': 'AI-провайдер',
  'create.model': 'Модель',
  'create.ollamaUrl': 'Ollama URL',
  'create.apiKey': 'API-ключ',
  'create.apiKeyOptional': ' (необязательно)',
  'create.apiKeyPlaceholder': 'Твой API-ключ {provider}',
  'create.keyHint': 'Шифруется на сервере. В браузере не хранится.',
  'create.customUrl': 'Адрес API (OpenAI-совместимый)',
  'create.customUrlHint': 'Только https:// (http:// — можно для localhost).',
  'create.usingSavedKey': '🔑 Использую твой сохранённый ключ {mask}',
  'create.useAnotherKey': 'Ввести другой ключ для этого агента',
  'create.backToSavedKey': '← Вернуться к сохранённому ключу',
  'create.errModelRequired': 'Выбери или впиши модель',
  'create.errUrlRequired': 'Нужен адрес API',
  'create.demoSkip': 'Позже — начать с демо',
  'create.creating': 'Создаю…',
  'create.submit': 'Создать агента',
  'create.errNameRequired': 'Введи имя',
  'create.errCreateFailed': 'Не удалось создать агента',
  'create.errNetwork': 'Не удаётся связаться с сервером. Проверь соединение и попробуй ещё раз.',

  // ── Чат ──
  'chat.demoRemaining': 'Demo: осталось {n} сообщений',
  'chat.retry': '↻ Повторить',
  'chat.empty': 'Начни разговор с {name}',
  'chat.placeholder': 'Сообщение для {name}…',
  'chat.demoOverTitle': 'Демо закончилось',
  'chat.demoOverText': 'Добавь свой API-ключ — безлимит и любая модель.',
  'chat.later': 'Позже',
  'chat.addKey': 'Добавить ключ',

  // ── Статусы агентов (HUD + профиль) ──
  'status.idle': 'Свободен',
  'status.wander': 'Гуляет',
  'status.rest': 'Отдыхает',
  'status.work': 'Работает',
  'status.task_running': 'Занят задачей',
  'status.task_done': 'Готово',
  'status.chat_npc': 'Болтает',

  // ── Местоположение агента (ТЗ-16, HUD + профиль) ──
  'loc.district': 'На улице',
  'loc.office': 'В офисе',
  'loc.cafe': 'В кафе',
  'loc.library': 'В библиотеке',
  'loc.dorm': 'В общежитии',
  'loc.dormSleeping': 'Спит (общежитие)',
  'loc.farm': 'На ферме',
  'hud.gotoHint': 'Клик — найти его в городе',

  // ── HUD ──
  'hud.new': 'Новый',
  'hud.meeting': '🏢 Собрание',
  'hud.meetingHint': 'Все агенты берутся за одну задачу вместе',
  'hud.rightClickHint': 'ПКМ — опции',
  'hud.openProfile': '👤 Открыть профиль',
  'hud.deleteAgent': '🗑 Удалить агента',
  'hud.confirmDelete': 'Удалить этого агента?',
  'hud.keysHint': 'API-ключи — вводятся один раз, работают для всех агентов',
  'clock.tooltip': 'Игровое время: 1 минута = 1 час',

  // ── Профиль агента ──
  'profile.personality': 'Характер',
  'profile.noPersonality': 'Характер не задан.',
  'profile.chat': '💬 Чат',
  'profile.sendTask': '⚡ Дать задачу',
  'profile.change': 'Изменить',

  // ── Настройки модели/ключа ──
  'model.provider': 'Провайдер',
  'model.model': 'Модель',
  'model.ollamaUrl': 'Ollama URL',
  'model.apiKey': 'API-ключ',
  'model.keyPlaceholder': 'sk-… (пусто — оставить текущий)',
  'model.keySaved': '🔑 Ключ сохранён (шифруется, не логируется)',
  'model.deleteKey': 'Удалить ключ',
  'model.deleting': 'Удаляю…',
  'model.keyOk': '✓ Ключ работает',
  'model.keyBad': '✗ Ключ не подошёл. Проверь его',
  'model.keyUnknown': 'Ключ сохранён, но проверить его не удалось',
  'model.usingSavedKey': '🔑 Личного ключа нет — беру твой сохранённый {mask}',
  'model.searchPlaceholder': 'Поиск модели…',
  'model.searchEmpty': 'Ничего не нашлось. Попробуй другое слово',
  'model.selected': 'Выбрано: {model}',
  'model.free': 'FREE',
  'model.freeGroup': 'Бесплатные модели',
  'model.allGroup': 'Все модели',
  'model.catalogLoading': 'Загружаю список моделей…',
  'model.catalogFailed': 'Список не загрузился — впиши имя модели руками',
  'model.customModelPlaceholder': 'Имя модели, напр. llama-3.3-70b',

  // ── Панель ключей (ТЗ-14) ──
  'keysPanel.title': '🔑 Твои API-ключи',
  'keysPanel.intro':
    'Добавь ключ один раз — его возьмут все новые агенты. Шифруется на сервере, не логируется и обратно не показывается.',
  'keysPanel.configured': 'Сохранён {mask}',
  'keysPanel.notConfigured': 'Не задан',
  'keysPanel.add': 'Добавить',
  'keysPanel.replace': 'Заменить',
  'keysPanel.delete': 'Удалить',
  'keysPanel.keyPlaceholder': 'Твой API-ключ {provider}',
  'keysPanel.baseUrlPlaceholder': 'https://api.groq.com/openai/v1',
  'keysPanel.savedOk': '✓ Ключ сохранён и работает',
  'keysPanel.errSaveFailed': 'Не удалось сохранить ключ. Попробуй ещё раз',
  'keysPanel.errNetwork': 'Сервер недоступен. Проверь соединение',
  'keysPanel.errUrlInvalid': 'Это не похоже на адрес',
  'keysPanel.errUrlInsecure': 'Только https:// (http:// — лишь для localhost)',
  'keysPanel.errUrlParts': 'Убери из адреса параметры и якорь',
  'keysPanel.errUrlRequired': 'Нужен адрес API',
  'keysPanel.footNote':
    'У агента всё ещё может быть свой ключ — он важнее сохранённого.',

  // ── Собрание ──
  'meeting.title': 'Общее собрание',
  'meeting.subtitle': 'Все агенты ({n}) работают над одной задачей одновременно',
  'meeting.placeholder':
    'Опиши задачу для всей команды…\nнапример: «Придумай 5 маркетинговых идей для пиксель-арт-игры»',
  'meeting.stop': '⏹ Стоп',
  'meeting.start': '🚀 Начать собрание ({n} агентов)',
  'meeting.waiting': 'Ждёт задачу…',
  'meeting.thinking': 'Думает',
  'meeting.noAgents': 'Создай хотя бы одного агента, чтобы начать собрание',

  // ── Ошибки чата (по code с сервера; тексты — из server/llm/errors.ts) ──
  'error.invalid_key': 'Ключ не подошёл. Проверь его в настройках агента',
  'error.rate_limited': 'Провайдер просит подождать. Попробуй через минуту',
  'error.no_credits': 'На ключе закончились средства',
  'error.no_model_access': 'Эта модель недоступна для твоего ключа. Выбери другую',
  'error.no_key_set': 'У агента нет API-ключа. Добавь его в 🔑 или в настройках агента',
  'error.no_endpoint_set': 'У агента нет адреса API. Задай его в настройках агента',
  'error.stream_error': 'Связь прервалась. Отправь сообщение ещё раз',
  'error.server_down': 'Сервер спит. Уже будим',
  'error.too_many_requests': 'Слишком много запросов. Подожди минуту',
  'error.generic': 'Что-то пошло не так. Попробуй ещё раз',

  // ── Phaser-лоадер ──
  'game.initializing': 'Запускаемся…',
  'game.loading': 'Загрузка {pct}%',
};

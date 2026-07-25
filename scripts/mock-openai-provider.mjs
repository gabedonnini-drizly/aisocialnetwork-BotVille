// Живая проверка ТЗ-14: локальный OpenAI-совместимый провайдер.
//
// Нужен, чтобы проверить сквозной путь «ключ юзера → любой агент» по-настоящему
// (реальный HTTP, реальный SSE, реальная проверка ключа), не тратя платный ключ
// и не завися от внешней сети. Провайдер 'custom' ходит сюда ровно так же, как
// ходил бы в Groq/Together: GET /v1/models для health-check ключа и
// POST /v1/chat/completions со стримом.
//
//   node scripts/mock-openai-provider.mjs [порт]
// Верный ключ — MOCK_API_KEY (по умолчанию mock-key-ok), всё остальное → 401.
import http from 'node:http';

const PORT = Number(process.argv[2] ?? 4010);
const GOOD_KEY = process.env.MOCK_API_KEY ?? 'mock-key-ok';

const server = http.createServer(async (req, res) => {
  const auth = req.headers.authorization ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = new URL(req.url, 'http://localhost');

  if (key !== GOOD_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
  }

  if (url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'mock-model-1' }] }));
  }

  if (url.pathname === '/v1/chat/completions') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    const agent = body.messages?.find(m => m.role === 'system')?.content ?? '';
    const words = `Отвечает ${agent || 'агент'} на модели ${body.model}. Ключ принят.`.split(' ');

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w + ' ' } }] })}\n\n`);
      await new Promise(r => setTimeout(r, 30));
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`mock OpenAI-compatible provider on :${PORT}`));

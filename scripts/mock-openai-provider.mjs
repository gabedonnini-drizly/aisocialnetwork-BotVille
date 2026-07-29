// Live check for TZ-14: a local OpenAI-compatible provider.
//
// Needed to exercise the end-to-end "user key → any agent" path for real
// (real HTTP, real SSE, real key validation) without spending a paid key
// and without depending on the external network. The 'custom' provider talks to
// this exactly as it would to Groq/Together: GET /v1/models for the key
// health-check and POST /v1/chat/completions with streaming.
//
//   node scripts/mock-openai-provider.mjs [port]
// The valid key is MOCK_API_KEY (mock-key-ok by default), anything else → 401.
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
    const words = `This is ${agent || 'the agent'} replying on model ${body.model}. Key accepted.`.split(' ');

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

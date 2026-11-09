// Local test-only transport: real Auth/PostgREST with controllable pantry faults.
// No production imports, hosted URLs, tokens, or database bypass.
const http = require('node:http');
let failReads = false;
let delayWrites = false;
let pendingWrites = 0;
let writeStarted = false;
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/__test/')) {
    if (req.url === '/__test/fail-reads') failReads = true;
    else if (req.url === '/__test/restore') { failReads = false; delayWrites = false; }
    else if (req.url === '/__test/delay-write') { delayWrites = true; writeStarted = false; }
    else if (req.url === '/__test/wait-write') await new Promise(resolve => setTimeout(resolve, 500));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pendingWrites, writeStarted })); return;
  }
  const pantry = req.url.startsWith('/rest/v1/pantry_items');
  if (failReads && pantry && req.method === 'GET') {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Intentional local pantry read failure' })); return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (req.url.startsWith('/auth/v1/signup') || req.url.startsWith('/auth/v1/resend')) {
    let payload;
    try { payload = JSON.parse(body.toString()); } catch { payload = {}; }
    if (payload.code_challenge_method !== 's256') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Native confirmation test requires S256 PKCE' })); return;
    }
  }
  const delayed = delayWrites && pantry && req.method === 'PATCH';
  if (delayed) { writeStarted = true; pendingWrites++; await new Promise(resolve => setTimeout(resolve, 30000)); }
  const upstream = http.request({ hostname: '127.0.0.1', port: 54321, path: req.url, method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:54321' } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
    response.on('end', () => {
      if (delayed) {
        pendingWrites--;
      }
    });
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Local Supabase unavailable'); });
  upstream.end(body);
});
server.listen(54329, '127.0.0.1', () => process.send?.('ready'));
process.on('SIGTERM', () => server.close(() => process.exit()));

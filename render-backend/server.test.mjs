import assert from 'node:assert';
import { describe, it, before, after, mock } from 'node:test';
import { createApp, DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL, DEFAULT_PROVIDERS } from './server.mjs';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const QUESTION = 'Zebra-question-7731: what is a good first move?';
const ANSWER = 'Unicorn-answer-4419: try **e4**.';
let idSeq = 0;
const newInstallId = () => `test-install-${process.pid}-${++idSeq}-abcdef`;

function okBody(text) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) };
}
function errBody(status) {
  return { ok: false, status, json: async () => ({ error: { code: status, message: 'upstream detail' } }) };
}

/** responses: array of fetch results; a function is called with (url, init); 'hang' never resolves until abort. */
function mockFetch(responses) {
  let i = 0;
  return mock.fn(async (url, init) => {
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r === 'hang') {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    if (typeof r === 'function') return r(url, init);
    return r;
  });
}

function env(overrides = {}) {
  return { AI_TUTOR_ENABLED: 'true', OPENROUTER_API_KEY: 'mock-key', ...overrides };
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

async function advice(base, { installId = newInstallId(), fen = START_FEN, question = QUESTION } = {}) {
  const res = await fetch(`${base}/api/chess/advice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-chess-install-id': installId },
    body: JSON.stringify({ fen, question }),
  });
  return { status: res.status, headers: res.headers, body: await res.json(), installId };
}
async function health(base) {
  const res = await fetch(`${base}/api/health`);
  return { status: res.status, body: await res.json() };
}
const fastApp = (fetchMock, extra = {}) =>
  createApp({ fetch: fetchMock, sleep: async () => {}, random: () => 0, env: env(extra.env), ...extra.opts });
const bodyOf = (call) => JSON.parse(call.arguments[1].body);

describe('Chess coach via OpenRouter', () => {
  it('1: primary ok -> 200 advice, model, request settings (zdr, data_collection deny, providers)', async () => {
    const f = mockFetch([okBody(ANSWER)]);
    await withServer(fastApp(f), async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.advice, ANSWER);
      assert.strictEqual(r.body.model, DEFAULT_MODEL);
      assert.ok(r.body.usage.dailyCap > 0);
    });
    assert.strictEqual(f.mock.calls.length, 1);
    const [url, init] = f.mock.calls[0].arguments;
    assert.strictEqual(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.strictEqual(init.headers.Authorization, 'Bearer mock-key');
    const b = bodyOf(f.mock.calls[0]);
    assert.strictEqual(b.model, 'anthropic/claude-haiku-5.5');
    assert.deepStrictEqual(b.provider, {
      zdr: true, data_collection: 'deny', only: DEFAULT_PROVIDERS, order: DEFAULT_PROVIDERS, allow_fallbacks: true,
    });
    assert.ok(b.messages[0].content.includes(START_FEN));
  });

  it('2: OPENROUTER_PROVIDERS overrides only/order', async () => {
    const f = mockFetch([okBody(ANSWER)]);
    await withServer(fastApp(f, { env: { OPENROUTER_PROVIDERS: 'amazon-bedrock, azure' } }), (base) => advice(base));
    assert.deepStrictEqual(bodyOf(f.mock.calls[0]).provider.only, ['amazon-bedrock', 'azure']);
  });

  it('3: primary 404 (non-retriable) -> no retry, falls back once -> 200 with fallback model', async () => {
    const f = mockFetch([errBody(404), okBody(ANSWER)]);
    await withServer(fastApp(f), async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.model, DEFAULT_FALLBACK_MODEL);
    });
    assert.strictEqual(f.mock.calls.length, 2);
    assert.strictEqual(bodyOf(f.mock.calls[1]).model, 'openai/gpt-5.6-luna');
  });

  it('4: primary 400/401/403 and empty answer each fall back', async () => {
    for (const first of [errBody(400), errBody(401), errBody(403), okBody('   ')]) {
      const f = mockFetch([first, okBody(ANSWER)]);
      await withServer(fastApp(f), async (base) => {
        const r = await advice(base);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.body.model, DEFAULT_FALLBACK_MODEL);
      });
      assert.strictEqual(f.mock.calls.length, 2);
    }
  });

  it('5: 429 then 500 then ok on primary -> 3 calls, bounded jittered sleeps', async () => {
    const sleeps = [];
    const f = mockFetch([errBody(429), errBody(500), okBody(ANSWER)]);
    const app = createApp({ fetch: f, sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.999, env: env() });
    await withServer(app, async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.model, DEFAULT_MODEL);
    });
    assert.strictEqual(f.mock.calls.length, 3);
    assert.strictEqual(sleeps.length, 2);
    assert.ok(sleeps[0] <= 500 && sleeps[1] <= 1000, `sleeps ${sleeps}`);
  });

  it('6: all 503 on primary and fallback -> 503 COACH_BUSY, Retry-After, non-empty error, 6 calls, cap released', async () => {
    const f = mockFetch([errBody(503)]);
    const installId = newInstallId();
    await withServer(fastApp(f), async (base) => {
      const r = await advice(base, { installId });
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.body.code, 'COACH_BUSY');
      assert.ok(r.body.error.length > 0);
      assert.strictEqual(r.headers.get('retry-after'), '15');
      const ok = mockFetch([okBody(ANSWER)]);
      void ok;
    });
    assert.strictEqual(f.mock.calls.length, 6);
    // cap released: a later success reports dayCount 1 for this install
    const f2 = mockFetch([okBody(ANSWER)]);
    await withServer(fastApp(f2), async (base) => {
      const r = await advice(base, { installId });
      assert.strictEqual(r.body.usage.dayCount, 1);
    });
  });

  it('7: primary 404 and fallback 404 -> 502 COACH_ERROR with error text', async () => {
    const f = mockFetch([errBody(404), errBody(404)]);
    await withServer(fastApp(f), async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 502);
      assert.strictEqual(r.body.code, 'COACH_ERROR');
      assert.ok(r.body.error.length > 0);
    });
    assert.strictEqual(f.mock.calls.length, 2);
  });

  it('8: every attempt hangs -> COACH_BUSY within the 20 s budget (real timers, short budget)', async () => {
    const f = mockFetch(['hang']);
    const app = createApp({ fetch: f, sleep: async () => {}, random: () => 0, env: env({ COACH_TOTAL_BUDGET_MS: '600' }) });
    const t0 = Date.now();
    await withServer(app, async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.body.code, 'COACH_BUSY');
    });
    assert.ok(Date.now() - t0 < 3000);
  });

  it('9: bad input (invalid FEN) -> 400, no upstream call', async () => {
    const f = mockFetch([okBody(ANSWER)]);
    await withServer(fastApp(f), async (base) => {
      const r = await advice(base, { fen: 'not a fen' });
      assert.strictEqual(r.status, 400);
    });
    assert.strictEqual(f.mock.calls.length, 0);
  });

  it('10: LEGAL install ID never appears in the outbound URL, headers or body', async () => {
    const f = mockFetch([errBody(500), errBody(404), okBody(ANSWER)]);
    const installId = newInstallId();
    await withServer(fastApp(f), (base) => advice(base, { installId }));
    assert.ok(f.mock.calls.length >= 2);
    for (const call of f.mock.calls) {
      const [url, init] = call.arguments;
      const dump = JSON.stringify({ url, headers: init.headers, body: init.body });
      assert.ok(!dump.includes(installId), 'install ID leaked to OpenRouter');
      assert.ok(!/install/i.test(JSON.stringify(init.headers)), 'install header forwarded');
    }
  });

  it('11: LEGAL logs carry no FEN, question, answer or install ID (success and failure paths)', async () => {
    const lines = [];
    const spies = ['log', 'error', 'warn', 'info'].map((k) =>
      mock.method(console, k, (...a) => { lines.push(a.map(String).join(' ')); }));
    const installId = newInstallId();
    try {
      await withServer(fastApp(mockFetch([okBody(ANSWER)])), (base) => advice(base, { installId }));
      await withServer(fastApp(mockFetch([errBody(429), errBody(500), errBody(503), okBody(''), errBody(404)])),
        (base) => advice(base, { installId }));
      await withServer(fastApp(mockFetch([errBody(503)])), (base) => advice(base, { installId }));
    } finally {
      spies.forEach((s) => s.mock.restore());
    }
    const all = lines.join('\n');
    assert.ok(lines.length > 0, 'expected some status logs');
    for (const secret of [START_FEN, 'rnbqkbnr', QUESTION, 'Zebra-question', ANSWER, 'Unicorn-answer', installId, 'mock-key']) {
      assert.ok(!all.includes(secret), `log leaked: ${secret}`);
    }
    assert.match(all, /status=\d+/);
  });

  it('12: health ok -> healthy, 1.0.7 fields intact, primary+fallback status', async () => {
    const f = mockFetch([okBody('OK'), okBody('OK')]);
    await withServer(fastApp(f), async (base) => {
      const h = await health(base);
      assert.strictEqual(h.status, 200);
      for (const k of ['status', 'geminiConfigured', 'model', 'aiTutorEnabled', 'dailyCap', 'monthlyCap', 'installIdHeader', 'gemini', 'fallbackModel', 'checkedAt']) {
        assert.ok(k in h.body, `missing ${k}`);
      }
      assert.strictEqual(h.body.status, 'healthy');
      assert.strictEqual(h.body.gemini, 'ok');
      assert.strictEqual(h.body.geminiConfigured, true);
      assert.strictEqual(h.body.primary.status, 'ok');
      assert.strictEqual(h.body.fallback.status, 'ok');
      assert.strictEqual(h.body.fallbackOk, true);
    });
    assert.strictEqual(f.mock.calls.length, 2);
    for (const c of f.mock.calls) assert.strictEqual(bodyOf(c).provider.zdr, true);
  });

  it('13: health primary 404, fallback 503 -> degraded, error codes reported, HTTP 200', async () => {
    const f = mock.fn(async (url, init) => (JSON.parse(init.body).model === DEFAULT_MODEL ? errBody(404) : errBody(503)));
    await withServer(fastApp(f), async (base) => {
      const h = await health(base);
      assert.strictEqual(h.status, 200);
      assert.strictEqual(h.body.status, 'degraded');
      assert.strictEqual(h.body.gemini, 'error');
      assert.strictEqual(h.body.primary.errorCode, 'HTTP_404');
      assert.strictEqual(h.body.fallback.status, 'busy');
      assert.strictEqual(h.body.fallback.errorCode, 'HTTP_503');
      assert.strictEqual(h.body.fallbackOk, false);
    });
  });

  it('14: health cache: 5 calls in 60 s -> 1 probe pair; after expiry -> new pair; concurrent share one', async () => {
    let t = 1_000_000;
    const f = mockFetch([okBody('OK')]);
    const app = createApp({ fetch: f, now: () => t, sleep: async () => {}, random: () => 0, env: env() });
    await withServer(app, async (base) => {
      for (let i = 0; i < 5; i++) { await health(base); t += 10_000; }
      assert.strictEqual(f.mock.calls.length, 2);
      t += 30_000;
      await health(base);
      assert.strictEqual(f.mock.calls.length, 4);
      t += 70_000;
      await Promise.all([health(base), health(base), health(base)]);
      assert.strictEqual(f.mock.calls.length, 6);
    });
  });

  it('15: no key -> unconfigured, no probe; advice 503 without upstream call', async () => {
    const f = mockFetch([okBody('OK')]);
    await withServer(fastApp(f, { env: { OPENROUTER_API_KEY: '' } }), async (base) => {
      const h = await health(base);
      assert.strictEqual(h.body.geminiConfigured, false);
      assert.strictEqual(h.body.gemini, 'unconfigured');
      const r = await advice(base);
      assert.strictEqual(r.status, 503);
      assert.ok(r.body.error.length > 0);
    });
    assert.strictEqual(f.mock.calls.length, 0);
  });

  it('16: kill switch -> 503 TUTOR_DISABLED with original text; missing install ID -> 400', async () => {
    const f = mockFetch([okBody(ANSWER)]);
    await withServer(fastApp(f, { env: { AI_TUTOR_ENABLED: 'false' } }), async (base) => {
      const r = await advice(base);
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.body.code, 'TUTOR_DISABLED');
      assert.match(r.body.error, /AI_TUTOR_ENABLED is not true/);
    });
    await withServer(fastApp(f), async (base) => {
      const res = await fetch(`${base}/api/chess/advice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fen: START_FEN, question: 'q' }) });
      assert.strictEqual(res.status, 400);
    });
    assert.strictEqual(f.mock.calls.length, 0);
  });
});

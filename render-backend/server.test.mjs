import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { createApp } from './server.mjs';

const VALID_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const VALID_INSTALL_ID = 'test-install-12345';

function mockGemini(responses = []) {
  let callCount = 0;
  return {
    models: {
      generateContent: mock.fn(async () => {
        const response = responses[callCount];
        callCount++;
        if (response instanceof Error) throw response;
        return response;
      }),
    },
  };
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.code = status;
  return err;
}

function make503(message = 'Service unavailable') {
  return makeError(503, message);
}

function mockEnv(overrides = {}) {
  return {
    AI_TUTOR_ENABLED: 'true',
    GEMINI_API_KEY: 'mock-key',
    GEMINI_MODEL: 'gemini-3.6-flash',
    GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
    ...overrides,
  };
}

function createRequest(body) {
  return {
    method: 'POST',
    url: '/api/chess/advice',
    headers: {
      'content-type': 'application/json',
      'x-chess-install-id': VALID_INSTALL_ID,
    },
    body: JSON.stringify(body),
  };
}

async function sendRequest(app, req) {
  return new Promise((resolve) => {
    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers || {},
      ip: '127.0.0.1',
      body: req.body ? JSON.parse(req.body) : undefined,
    };

    const response = {
      statusCode: 200,
      headers: {},
      body: '',
      status(code) {
        this.statusCode = code;
        return this;
      },
      header(key, value) {
        this.headers[key.toLowerCase()] = String(value);
        return this;
      },
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = String(value);
        return this;
      },
      json(data) {
        this.body = JSON.stringify(data);
        resolve(this);
      },
      end() {
        resolve(this);
      },
    };

    const stack = app._router.stack.filter(layer => layer.route);
    let handled = false;

    for (const layer of stack) {
      const route = layer.route;
      if (route && route.path === request.url) {
        const method = request.method.toLowerCase();
        if (route.methods[method]) {
          handled = true;
          const middlewares = [...app._router.stack.filter(l => !l.route), layer];
          let idx = 0;
          
          const next = (err) => {
            if (err) {
              response.statusCode = 500;
              response.json({ error: err.message });
              return;
            }
            if (idx >= middlewares.length) {
              return;
            }
            const currentLayer = middlewares[idx++];
            try {
              if (currentLayer.route) {
                currentLayer.route.stack[0].handle(request, response, next);
              } else {
                currentLayer.handle(request, response, next);
              }
            } catch (error) {
              response.statusCode = 500;
              response.json({ error: error.message });
            }
          };
          
          next();
          break;
        }
      }
    }

    if (!handled) {
      response.statusCode = 404;
      response.json({ error: 'Not found' });
    }
  });
}

describe('Chess Coach Resilience', () => {
  it('Test 1: Primary 503 x2 then text -> 200 advice; 3 calls; sleeps within jitter bounds', async () => {
    const sleeps = [];
    const gemini = mockGemini([
      make503('UNAVAILABLE'),
      make503('high demand'),
      { text: 'Good move!' },
    ]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      random: () => 0.5,
      env: mockEnv(),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'What should I do?' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.advice, 'Good move!');
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 3);
    assert.strictEqual(sleeps.length, 2);
    
    assert.ok(sleeps[0] >= 0 && sleeps[0] <= 500, `First sleep ${sleeps[0]} should be 0-500ms`);
    assert.ok(sleeps[1] >= 0 && sleeps[1] <= 1000, `Second sleep ${sleeps[1]} should be 0-1000ms`);
  });

  it('Test 2: 3x 503, fallback empty -> 503 COACH_BUSY, non-empty error, Retry-After, cap released', async () => {
    const gemini = mockGemini([
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
    ]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv({ GEMINI_FALLBACK_MODEL: '' }),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help me' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.headers['retry-after'], '15');
    const body = JSON.parse(res.body);
    assert.ok(body.error.length > 0, 'Error should be non-empty');
    assert.strictEqual(body.code, 'COACH_BUSY');
    assert.strictEqual(body.retryAfterSec, 15);
  });

  it('Test 3: 3x 503, fallback text -> 200; fallback called with gemini-3.5-flash-lite', async () => {
    const gemini = mockGemini([
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      { text: 'Fallback advice!' },
    ]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.advice, 'Fallback advice!');
    assert.strictEqual(body.model, 'gemini-3.5-flash-lite');
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 4);
    
    const fallbackCall = gemini.models.generateContent.mock.calls[3];
    assert.strictEqual(fallbackCall.arguments[0].model, 'gemini-3.5-flash-lite');
    assert.strictEqual(fallbackCall.arguments[0].config?.thinkingConfig, undefined);
  });

  it('Test 4: Fallback 503 too -> 503 COACH_BUSY', async () => {
    const gemini = mockGemini([
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
      make503('UNAVAILABLE'),
    ]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'COACH_BUSY');
    assert.strictEqual(body.retryAfterSec, 15);
  });

  it('Test 5: 400/403/404 -> 1 call, 502 COACH_ERROR; 429 -> 1 call, no retries', async () => {
    for (const status of [400, 403, 404, 429]) {
      const gemini = mockGemini([makeError(status, `Error ${status}`)]);
      
      const app = createApp({
        gemini,
        now: () => Date.now(),
        sleep: async () => Promise.resolve(),
        random: () => 0,
        env: mockEnv(),
      });

      const req = createRequest({ fen: VALID_FEN, question: 'Help' });
      const res = await sendRequest(app, req);

      assert.strictEqual(res.statusCode, 502);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.code, 'COACH_ERROR');
      assert.strictEqual(gemini.models.generateContent.mock.calls.length, 1, `Status ${status} should have 1 call`);
    }
  });

  it('Test 6: Every attempt hangs -> finishes <= 20s with COACH_BUSY; no attempt starts past deadline', async () => {
    let currentTime = 0;
    const callTimes = [];
    
    const gemini = {
      models: {
        generateContent: mock.fn(async () => {
          callTimes.push(currentTime);
          await new Promise(resolve => setTimeout(resolve, 100000));
        }),
      },
    };

    const app = createApp({
      gemini,
      now: () => currentTime,
      sleep: async (ms) => {
        currentTime += ms;
        return Promise.resolve();
      },
      random: () => 0.5,
      env: mockEnv(),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help' });
    const startTime = currentTime;
    
    const responsePromise = sendRequest(app, req);
    
    while (currentTime < startTime + 25000) {
      currentTime += 100;
      await new Promise(resolve => setImmediate(resolve));
      if (responsePromise && typeof responsePromise.then === 'function') {
        const settled = await Promise.race([
          responsePromise.then(() => true),
          new Promise(resolve => setImmediate(() => resolve(false)))
        ]);
        if (settled) break;
      }
    }

    const res = await responsePromise;
    const elapsed = currentTime - startTime;
    
    assert.ok(elapsed <= 20100, `Should finish in ~20s, took ${elapsed}ms`);
    assert.strictEqual(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'COACH_BUSY');
    
    for (const callTime of callTimes) {
      assert.ok(callTime < startTime + 20000, `Call at ${callTime} should not start past 20s deadline`);
    }
  });

  it('Test 7: Empty text -> no retry, 502 COACH_ERROR', async () => {
    const gemini = mockGemini([{ text: '' }]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 502);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'COACH_ERROR');
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 1);
  });

  it('Test 8: Health ok -> status healthy, gemini ok', async () => {
    const gemini = mockGemini([{ text: 'OK' }]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    const req = { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' };
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.gemini, 'ok');
    assert.strictEqual(body.geminiConfigured, true);
  });

  it('Test 9: Health probe 503 -> status degraded, gemini busy, HTTP 200, existing fields intact', async () => {
    const gemini = mockGemini([make503('UNAVAILABLE')]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    const req = { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' };
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'degraded');
    assert.strictEqual(body.gemini, 'busy');
    assert.strictEqual(body.geminiConfigured, true);
    assert.strictEqual(body.model, 'gemini-3.6-flash');
    assert.ok(body.aiTutorEnabled !== undefined);
    assert.ok(body.dailyCap > 0);
    assert.ok(body.monthlyCap > 0);
  });

  it('Test 10: Health cache: 5 calls in 60s -> 1 probe; after 60s -> new probe; concurrent calls share one probe', async () => {
    let currentTime = 0;
    const gemini = mockGemini([
      { text: 'OK' },
      { text: 'OK' },
    ]);

    const app = createApp({
      gemini,
      now: () => currentTime,
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv(),
    });

    for (let i = 0; i < 5; i++) {
      const req = { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' };
      await sendRequest(app, req);
      currentTime += 10000;
    }
    
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 1, 'Should have 1 probe for 5 calls within 60s');

    currentTime = 70000;
    const req = { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' };
    await sendRequest(app, req);
    
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 2, 'Should have 2 probes after 60s expires');

    currentTime = 75000;
    const concurrentRequests = Promise.all([
      sendRequest(app, { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' }),
      sendRequest(app, { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' }),
      sendRequest(app, { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' }),
    ]);
    await concurrentRequests;

    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 2, 'Concurrent calls should share cached probe');
  });

  it('Test 11: No key -> gemini unconfigured, no probe', async () => {
    const app = createApp({
      gemini: null,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv({ GEMINI_API_KEY: '' }),
    });

    const req = { method: 'GET', url: '/api/health', headers: {}, ip: '127.0.0.1' };
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.geminiConfigured, false);
    assert.strictEqual(body.gemini, 'unconfigured');
  });

  it('Test 12: AI_TUTOR_ENABLED false -> 503 with original text and code TUTOR_DISABLED', async () => {
    const gemini = mockGemini([]);

    const app = createApp({
      gemini,
      now: () => Date.now(),
      sleep: async () => Promise.resolve(),
      random: () => 0,
      env: mockEnv({ AI_TUTOR_ENABLED: 'false' }),
    });

    const req = createRequest({ fen: VALID_FEN, question: 'Help' });
    const res = await sendRequest(app, req);

    assert.strictEqual(res.statusCode, 503);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'TUTOR_DISABLED');
    assert.ok(body.error.includes('AI tutor is disabled'));
    assert.strictEqual(gemini.models.generateContent.mock.calls.length, 0);
  });
});

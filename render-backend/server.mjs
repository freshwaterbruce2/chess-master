import { Chess } from 'chess.js';
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  INSTALL_ID_HEADER,
  checkAndReserveAdvice,
  getCapDefaults,
  isAiTutorEnabled,
  normalizeInstallId,
  releaseReservedAdvice,
} from './aiCaps.mjs';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });

// OpenRouter chat completions (https://openrouter.ai/docs/api-reference/chat-completion).
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';
export const DEFAULT_FALLBACK_MODEL = 'openai/gpt-5.6-luna';
// Provider routing (https://openrouter.ai/docs/features/provider-routing): `only` takes provider
// slugs; an endpoint slug such as "google-vertex/us-east5" targets one endpoint, a base slug
// ("google-vertex") matches every region of that provider. Override with OPENROUTER_PROVIDERS.
export const DEFAULT_PROVIDERS = ['amazon-bedrock/us-east-1', 'google-vertex/us', 'azure/us'];

const PER_ATTEMPT_TIMEOUT_MS = 8000;
const HEALTH_PROBE_TIMEOUT_MS = 5000;
const SERVER_REQUEST_TIMEOUT_MS = 30000; // above the 20 s budget
const MAX_ATTEMPTS = 3; // per model, retries only on 429/5xx/timeout
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;
const MIN_FALLBACK_BUDGET_MS = 3000;
const MAX_OUTPUT_TOKENS = 1024;

const BUSY_TEXT = 'Coach is busy right now. Please try again in a moment.';
const ERROR_TEXT = 'The coach encountered an error. Please try again.';
const EMPTY_TEXT = 'The coach could not generate advice. Please try again.';

const { dailyCap: AI_DAILY_CAP, monthlyCap: AI_MONTHLY_CAP } = getCapDefaults();

const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    ...(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
);

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export function buildPrompt(fen, question, legalMoves) {
  return `You are Chess Master's expert chess tutor for a beginner chess app.

Current board FEN: "${fen}"
Legal SAN moves from this exact FEN: ${legalMoves.join(', ') || '(none)'}

User asks: "${question}"

Rules:
- Give accurate, beginner-friendly chess advice.
- Do not claim illegal moves.
- If you suggest a move, it must appear in the legal SAN move list above.
- If checkmate, stalemate, or draw is already present, say that clearly.
- Keep the answer concise and formatted in Markdown.`;
}

/** Upstream error carrying only an HTTP status and a short code (never prompt or answer text). */
export class UpstreamError extends Error {
  constructor(status, code) {
    super(`upstream ${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

export function isRetriable(error) {
  const s = error?.status;
  return s === 429 || s === 408 || (typeof s === 'number' && s >= 500) || error?.code === 'TIMEOUT';
}

export function getProviderSettings(env) {
  const list = String(env.OPENROUTER_PROVIDERS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const only = list.length ? list : DEFAULT_PROVIDERS;
  return { zdr: true, data_collection: 'deny', only, order: only, allow_fallbacks: true };
}

export function extractAdviceText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('\n')
      .trim();
    if (joined) return joined;
  }
  return null;
}

async function callOpenRouterOnce({ fetchImpl, apiKey, model, messages, maxTokens, provider, timeoutMs, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    let res;
    try {
      res = await fetchImpl(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://www.vibe-tech.org/chess-master',
          'X-Title': 'Chess Master',
        },
        body: JSON.stringify({ model, messages, temperature: 0.35, max_tokens: maxTokens, provider }),
        signal: controller.signal,
      });
    } catch {
      throw new UpstreamError(0, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK');
    }
    if (!res.ok) throw new UpstreamError(res.status, `HTTP_${res.status}`);
    let data;
    try {
      data = await res.json();
    } catch {
      throw new UpstreamError(502, 'BAD_JSON');
    }
    if (data?.error) {
      const code = Number(data.error.code) || 502;
      throw new UpstreamError(code, `HTTP_${code}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Bounded retries on 429/5xx/timeout for one model, inside the request deadline. */
async function callModelWithRetry(ctx, model, deadline) {
  const { now, sleep, random } = ctx;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - now();
    if (remaining <= 0) throw new UpstreamError(0, 'DEADLINE');
    const started = now();
    try {
      const data = await callOpenRouterOnce({ ...ctx, model, timeoutMs: Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining) });
      return data;
    } catch (error) {
      const ms = now() - started;
      // Log status code + timing only. Never FEN, question, answer or install ID.
      console.error(`[OpenRouter] ${model} attempt ${attempt} failed status=${error.status} code=${error.code} ms=${ms}`);
      if (!isRetriable(error) || attempt === MAX_ATTEMPTS) throw error;
      const delay = Math.floor(random() * Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS));
      if (now() + delay >= deadline) throw error;
      await sleep(delay);
    }
  }
  throw new UpstreamError(0, 'DEADLINE');
}

/** Primary, then fallback on ANY primary failure (bad user input is rejected before this). */
export async function callWithFallback(ctx, primary, fallback, deadline) {
  let primaryError;
  try {
    const data = await callModelWithRetry(ctx, primary, deadline);
    const advice = extractAdviceText(data);
    if (advice) return { advice, modelUsed: primary };
    primaryError = new UpstreamError(502, 'EMPTY');
    console.error(`[OpenRouter] ${primary} empty answer`);
  } catch (error) {
    primaryError = error;
  }
  if (!fallback || deadline - ctx.now() < MIN_FALLBACK_BUDGET_MS) {
    throw markBusy(primaryError, !fallback ? isRetriable(primaryError) : true);
  }
  let fallbackError;
  try {
    const data = await callModelWithRetry(ctx, fallback, deadline);
    const advice = extractAdviceText(data);
    if (advice) return { advice, modelUsed: fallback };
    fallbackError = new UpstreamError(502, 'EMPTY');
    console.error(`[OpenRouter] ${fallback} empty answer`);
  } catch (error) {
    fallbackError = error;
  }
  const exhausted = (isRetriable(primaryError) || primaryError.code === 'DEADLINE') &&
    (isRetriable(fallbackError) || fallbackError.code === 'DEADLINE');
  throw markBusy(fallbackError, exhausted);
}

function markBusy(error, busy) {
  error.busy = Boolean(busy || error?.code === 'DEADLINE' || error?.code === 'TIMEOUT');
  return error;
}

async function probeModel(ctx, model) {
  try {
    const data = await callOpenRouterOnce({
      ...ctx,
      model,
      messages: [{ role: 'user', content: 'Reply OK' }],
      maxTokens: 5,
      timeoutMs: HEALTH_PROBE_TIMEOUT_MS,
    });
    void data;
    return { status: 'ok', errorCode: null };
  } catch (error) {
    return { status: isRetriable(error) ? 'busy' : 'error', errorCode: error.code || `HTTP_${error.status}` };
  }
}

export function createApp(options = {}) {
  const {
    fetch: fetchImpl = globalThis.fetch,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random,
    env = process.env,
  } = options;

  const apiKey = env.OPENROUTER_API_KEY || '';
  const primaryModel = env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallbackModel = env.OPENROUTER_FALLBACK_MODEL !== undefined ? env.OPENROUTER_FALLBACK_MODEL : DEFAULT_FALLBACK_MODEL;
  const totalBudgetMs = Number(env.COACH_TOTAL_BUDGET_MS || 20000);
  // Health probe cache: <= 1 probe pair per HEALTH_CACHE_MS (default 60 s) = <= 2,880 tiny calls/day.
  const healthCacheMs = Number(env.HEALTH_CACHE_MS || 60000);
  const provider = getProviderSettings(env);
  const ctx = { fetchImpl, apiKey, provider, now, sleep, random };
  const isAiEnabled = () => {
    const raw = String(env.AI_TUTOR_ENABLED ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  };

  const healthCache = { value: null, expiresAt: 0, promise: null };
  async function getHealth() {
    if (!apiKey) {
      return { gemini: 'unconfigured', primary: { model: primaryModel, status: 'unconfigured', errorCode: null },
        fallback: { model: fallbackModel || null, status: 'unconfigured', errorCode: null }, fallbackOk: undefined,
        checkedAt: new Date(now()).toISOString() };
    }
    if (healthCache.promise) return healthCache.promise;
    if (healthCache.value && now() < healthCache.expiresAt) return healthCache.value;
    const t = now();
    healthCache.promise = (async () => {
      const [p, f] = await Promise.all([
        probeModel(ctx, primaryModel),
        fallbackModel ? probeModel(ctx, fallbackModel) : Promise.resolve({ status: 'disabled', errorCode: null }),
      ]);
      const value = {
        gemini: p.status, // legacy field name read by the 1.0.7 app: primary model status
        primary: { model: primaryModel, ...p },
        fallback: { model: fallbackModel || null, ...f },
        fallbackOk: f.status === 'ok',
        checkedAt: new Date(t).toISOString(),
      };
      healthCache.value = value;
      healthCache.expiresAt = t + healthCacheMs;
      return value;
    })().finally(() => { healthCache.promise = null; });
    return healthCache.promise;
  }

  const rateLimit = new Map();
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.has(origin) || origin.startsWith('capacitor://')) {
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', `Content-Type, ${INSTALL_ID_HEADER}, X-Chess-Install-Id`);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
      return;
    }
    res.status(403).json({ error: 'Origin not allowed' });
  });

  app.use((req, res, next) => {
    const currentTime = now();
    const key = req.ip || 'unknown';
    const current = rateLimit.get(key);
    if (!current || currentTime > current.resetAt) {
      rateLimit.set(key, { count: 1, resetAt: currentTime + RATE_WINDOW_MS });
      next();
      return;
    }
    if (current.count >= MAX_REQUESTS) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }
    current.count += 1;
    next();
  });

  app.get('/api/health', async (req, res) => {
    const h = await getHealth();
    res.json({
      status: h.gemini === 'ok' ? 'healthy' : 'degraded',
      geminiConfigured: Boolean(apiKey), // legacy name kept for the 1.0.7 app: "AI key configured"
      model: primaryModel,
      aiTutorEnabled: isAiEnabled(),
      dailyCap: AI_DAILY_CAP,
      monthlyCap: AI_MONTHLY_CAP,
      installIdHeader: 'X-Chess-Install-Id',
      provider: 'openrouter',
      gemini: h.gemini,
      fallbackModel: fallbackModel || null,
      fallbackOk: h.fallbackOk,
      primary: h.primary,
      fallback: h.fallback,
      checkedAt: h.checkedAt,
    });
  });

  app.post('/api/chess/advice', async (req, res) => {
    if (!isAiEnabled()) {
      res.status(503).json({
        error: 'AI tutor is disabled on this server (AI_TUTOR_ENABLED is not true). Enable it in the Render env when ready.',
        code: 'TUTOR_DISABLED',
      });
      return;
    }

    const installId = normalizeInstallId(req.headers[INSTALL_ID_HEADER] || req.headers['x-chess-install-id']);
    if (!installId) {
      res.status(400).json({ error: 'Missing or invalid X-Chess-Install-Id header (8-128 chars: letters, digits, _ or -).' });
      return;
    }

    const reserve = checkAndReserveAdvice(installId);
    if (!reserve.ok) {
      res.status(reserve.status).json({
        error: reserve.error,
        dayCount: reserve.dayCount,
        monthCount: reserve.monthCount,
        dailyCap: reserve.dailyCap,
        monthlyCap: reserve.monthlyCap,
      });
      return;
    }

    if (!apiKey) {
      releaseReservedAdvice(installId);
      res.status(503).json({ error: 'AI API key is not configured on the server.', code: 'COACH_UNCONFIGURED' });
      return;
    }

    const { fen, question } = req.body || {};
    if (typeof fen !== 'string' || typeof question !== 'string') {
      releaseReservedAdvice(installId);
      res.status(400).json({ error: 'Expected JSON body with string fields: fen, question.' });
      return;
    }
    if (fen.length > 120 || question.length > 800) {
      releaseReservedAdvice(installId);
      res.status(400).json({ error: 'Request is too large.' });
      return;
    }
    let legalMoves;
    try {
      legalMoves = new Chess(fen).moves();
    } catch {
      releaseReservedAdvice(installId);
      res.status(400).json({ error: 'Invalid FEN.' });
      return;
    }

    const started = now();
    try {
      // Only the prompt (FEN + question + legal moves) goes upstream; never the install ID.
      const messages = [{ role: 'user', content: buildPrompt(fen, question, legalMoves) }];
      const { advice, modelUsed } = await callWithFallback(
        { ...ctx, messages, maxTokens: MAX_OUTPUT_TOKENS },
        primaryModel,
        fallbackModel,
        started + totalBudgetMs,
      );
      console.log(`[OpenRouter] advice ok model=${modelUsed} ms=${now() - started}`);
      res.json({
        advice,
        model: modelUsed,
        usage: {
          dayCount: reserve.dayCount,
          monthCount: reserve.monthCount,
          dailyCap: reserve.dailyCap,
          monthlyCap: reserve.monthlyCap,
        },
      });
    } catch (error) {
      releaseReservedAdvice(installId);
      const ms = now() - started;
      console.error(`[OpenRouter] advice failed status=${error?.status} code=${error?.code} busy=${Boolean(error?.busy)} ms=${ms}`);
      if (error?.busy) {
        res.status(503).header('Retry-After', '15').json({ error: BUSY_TEXT, code: 'COACH_BUSY', retryAfterSec: 15 });
        return;
      }
      res.status(502).json({ error: error?.code === 'EMPTY' ? EMPTY_TEXT : ERROR_TEXT, code: 'COACH_ERROR' });
    }
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.env.PORT || 3107);
  const app = createApp();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OK] Chess Master API listening on port ${PORT}`);
    console.log(`[OK] OpenRouter key configured: ${process.env.OPENROUTER_API_KEY ? 'yes' : 'no'}`);
    console.log(`[OK] Model: ${process.env.OPENROUTER_MODEL || DEFAULT_MODEL}, fallback: ${process.env.OPENROUTER_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL}`);
    console.log(`[OK] Providers: ${getProviderSettings(process.env).only.join(',')} (zdr, data_collection deny)`);
    console.log(`[OK] AI tutor enabled: ${isAiTutorEnabled() ? 'yes' : 'no (kill switch)'}`);
    console.log(`[OK] Caps: ${AI_DAILY_CAP}/day, ${AI_MONTHLY_CAP}/month per X-Chess-Install-Id`);
  });
  server.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
  server.headersTimeout = SERVER_REQUEST_TIMEOUT_MS + 1000;
}

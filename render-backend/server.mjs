import { GoogleGenAI } from '@google/genai';
import { Chess } from 'chess.js';
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'node:url';
import {
  INSTALL_ID_HEADER,
  checkAndReserveAdvice,
  getCapDefaults,
  isAiTutorEnabled,
  normalizeInstallId,
  releaseReservedAdvice,
} from './aiCaps.mjs';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });

const RAW_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_MODEL =
  RAW_GEMINI_MODEL === 'gemini-2.5-flash' || RAW_GEMINI_MODEL === 'models/gemini-2.5-flash'
    ? 'gemini-3.6-flash'
    : RAW_GEMINI_MODEL;

const GEMINI_TOTAL_BUDGET_MS = Number(process.env.GEMINI_TOTAL_BUDGET_MS || 20000);
const HEALTH_CACHE_MS = Number(process.env.HEALTH_CACHE_MS || 60000);
const PER_ATTEMPT_TIMEOUT_MS = 8000;
const HEALTH_PROBE_TIMEOUT_MS = 5000;
const SERVER_REQUEST_TIMEOUT_MS = 30000; // 30s, above the 20s budget
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 4000;

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

const rateLimit = new Map();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

function buildPrompt(fen, question, legalMoves) {
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

function extractAdviceText(response) {
  try {
    const text = response?.text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  } catch (err) {
    console.error('[Gemini] response.text unavailable:', err?.message || err);
  }

  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined) return joined;
  }

  const finishReason = candidate?.finishReason || 'unknown';
  const thoughts = response?.usageMetadata?.thoughtsTokenCount;
  console.error(
    '[Gemini] empty advice text; finishReason:',
    finishReason,
    'thoughtsTokenCount:',
    thoughts ?? 'n/a',
  );
  return null;
}

function isRetriable503(error) {
  if (error?.status === 503 || error?.code === 503) return true;
  const msg = String(error?.message || '');
  return /UNAVAILABLE|overloaded|high demand/i.test(msg);
}

async function callWithTimeout(fn, timeoutMs, signal) {
  if (signal?.aborted) {
    throw new Error('Request deadline exceeded');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortHandler = () => controller.abort();
  signal?.addEventListener('abort', abortHandler);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
  }
}

async function callGeminiWithRetry(gemini, model, request, options = {}) {
  const { deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS, random = Math.random, sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)) } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deadline - Date.now());

  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (Date.now() >= deadline) {
        throw new Error('Request deadline exceeded');
      }

      try {
        const response = await callWithTimeout(
          async (signal) => {
            return await gemini.models.generateContent({
              model,
              ...request,
              abortSignal: signal,
            });
          },
          PER_ATTEMPT_TIMEOUT_MS,
          controller.signal
        );
        return { response, modelUsed: model };
      } catch (error) {
        const isLast = attempt === MAX_RETRIES;
        
        if (!isRetriable503(error) || isLast) {
          throw error;
        }

        const baseDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const cappedDelay = Math.min(baseDelay, RETRY_MAX_DELAY_MS);
        const jitteredDelay = Math.floor(random() * cappedDelay);

        if (Date.now() + jitteredDelay >= deadline) {
          throw new Error('Request deadline exceeded');
        }

        console.log(`[Gemini] 503 attempt ${attempt}/${model}, retrying in ${jitteredDelay}ms`);
        await sleep(jitteredDelay);
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiWithFallback(gemini, primaryModel, fallbackModel, request, options = {}) {
  const { deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS } = options;
  
  let primaryWas503 = false;
  try {
    return await callGeminiWithRetry(gemini, primaryModel, request, { ...options, deadline });
  } catch (primaryError) {
    primaryWas503 = isRetriable503(primaryError);
    if (!primaryWas503) {
      throw primaryError;
    }

    const remainingTime = deadline - Date.now();
    if (!fallbackModel || remainingTime < 6000) {
      const busyError = new Error('Request deadline exceeded');
      busyError.is503Busy = true;
      throw busyError;
    }

    console.log(`[Gemini] Primary exhausted, trying fallback: ${fallbackModel}`);
    
    const fallbackRequest = { ...request };
    if (fallbackRequest.config?.thinkingConfig) {
      delete fallbackRequest.config.thinkingConfig;
    }

    try {
      return await callGeminiWithRetry(gemini, fallbackModel, fallbackRequest, { ...options, deadline });
    } catch (fallbackError) {
      if (isRetriable503(fallbackError)) {
        const busyError = new Error('Request deadline exceeded');
        busyError.is503Busy = true;
        throw busyError;
      }
      throw fallbackError;
    }
  }
}

async function probeGeminiHealth(gemini, model, options = {}) {
  const { timeout = HEALTH_PROBE_TIMEOUT_MS } = options;
  
  try {
    await callWithTimeout(
      async (signal) => {
        return await gemini.models.generateContent({
          model,
          contents: 'Reply OK',
          config: {
            maxOutputTokens: 5,
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
          },
          abortSignal: signal,
        });
      },
      timeout,
      null
    );
    return 'ok';
  } catch (error) {
    if (isRetriable503(error)) {
      return 'busy';
    }
    return 'error';
  }
}

async function getHealthStatus(gemini, healthCache, fallbackModel, now = Date.now) {
  const currentTime = now();
  
  if (!gemini) {
    return {
      gemini: 'unconfigured',
      fallbackModel: fallbackModel,
      fallbackOk: undefined,
      checkedAt: new Date(currentTime).toISOString(),
    };
  }

  if (healthCache.promise) {
    await healthCache.promise;
  }

  if (currentTime < healthCache.expiresAt) {
    return {
      gemini: healthCache.gemini,
      fallbackModel: fallbackModel,
      fallbackOk: healthCache.fallbackOk,
      checkedAt: healthCache.checkedAt,
    };
  }

  const probePromise = (async () => {
    const geminiStatus = await probeGeminiHealth(gemini, GEMINI_MODEL);
    
    healthCache.gemini = geminiStatus;
    healthCache.checkedAt = new Date(currentTime).toISOString();
    healthCache.expiresAt = currentTime + HEALTH_CACHE_MS;
    healthCache.promise = null;
  })();

  healthCache.promise = probePromise;
  await probePromise;

  return {
    gemini: healthCache.gemini,
    fallbackModel: fallbackModel,
    fallbackOk: healthCache.fallbackOk,
    checkedAt: healthCache.checkedAt,
  };
}

export function createApp(options = {}) {
  const {
    gemini: injectedGemini,
    now = Date.now,
    sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    random = Math.random,
    env = process.env,
  } = options;

  const geminiClient = injectedGemini ?? (env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null);
  const geminiFallbackModel = env.GEMINI_FALLBACK_MODEL !== undefined ? env.GEMINI_FALLBACK_MODEL : 'gemini-3.5-flash-lite';
  
  const healthCache = {
    gemini: 'unconfigured',
    fallbackOk: undefined,
    checkedAt: null,
    expiresAt: 0,
    promise: null,
  };
  
  const isAiEnabled = () => {
    const raw = String(env.AI_TUTOR_ENABLED ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  };

  const app = express();
  
  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.has(origin) || origin.startsWith('capacitor://')) {
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Headers',
        `Content-Type, ${INSTALL_ID_HEADER}, X-Chess-Install-Id`,
      );
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
    const healthStatus = await getHealthStatus(geminiClient, healthCache, geminiFallbackModel, now);
    const status = healthStatus.gemini === 'ok' ? 'healthy' : 'degraded';

    res.json({
      status,
      geminiConfigured: Boolean(geminiClient),
      model: GEMINI_MODEL,
      aiTutorEnabled: isAiEnabled(),
      dailyCap: AI_DAILY_CAP,
      monthlyCap: AI_MONTHLY_CAP,
      installIdHeader: 'X-Chess-Install-Id',
      ...healthStatus,
    });
  });

  app.post('/api/chess/advice', async (req, res) => {
    if (!isAiEnabled()) {
      res.status(503).json({
        error:
          'AI tutor is disabled on this server (AI_TUTOR_ENABLED is not true). Enable it in the Render env when ready.',
        code: 'TUTOR_DISABLED',
      });
      return;
    }

    const installId = normalizeInstallId(
      req.headers[INSTALL_ID_HEADER] || req.headers['x-chess-install-id'],
    );
    if (!installId) {
      res.status(400).json({
        error:
          'Missing or invalid X-Chess-Install-Id header (8-128 chars: letters, digits, _ or -).',
      });
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

    if (!geminiClient) {
      releaseReservedAdvice(installId);
      res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
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

    try {
      const deadline = now() + GEMINI_TOTAL_BUDGET_MS;
      const request = {
        contents: buildPrompt(fen, question, legalMoves),
        config: {
          temperature: 0.35,
          maxOutputTokens: 2048,
          thinkingConfig: {
            thinkingLevel: 'MINIMAL',
          },
        },
      };

      const { response, modelUsed } = await callGeminiWithFallback(
        geminiClient,
        GEMINI_MODEL,
        geminiFallbackModel,
        request,
        { deadline, random, sleep }
      );

      const advice = extractAdviceText(response);
      if (!advice) {
        releaseReservedAdvice(installId);
        res.status(502).json({ 
          error: 'The coach could not generate advice. Please try again.',
          code: 'COACH_ERROR',
        });
        return;
      }

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
      
      if (error?.is503Busy || isRetriable503(error) || error?.message === 'Request deadline exceeded') {
        console.error('[Gemini] chess advice busy:', error?.message || error);
        res.status(503)
          .header('Retry-After', '15')
          .json({
            error: 'Coach is busy right now. Please try again in a moment.',
            code: 'COACH_BUSY',
            retryAfterSec: 15,
          });
        return;
      }

      console.error('[Gemini] chess advice failed:', error?.message || error);
      res.status(502).json({ 
        error: 'The coach encountered an error. Please try again.',
        code: 'COACH_ERROR',
      });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = Number(process.env.PORT || 3107);
  const gemini = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

  const app = createApp({ gemini });
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OK] Chess Master API listening on port ${PORT}`);
    console.log(`[OK] Gemini configured: ${gemini ? 'yes' : 'no'}`);
    console.log(`[OK] Gemini model: ${GEMINI_MODEL}`);
    console.log(`[OK] AI tutor enabled: ${isAiTutorEnabled() ? 'yes' : 'no (kill switch)'}`);
    console.log(`[OK] Caps: ${AI_DAILY_CAP}/day, ${AI_MONTHLY_CAP}/month per X-Chess-Install-Id`);
  });
  
  server.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
  server.headersTimeout = SERVER_REQUEST_TIMEOUT_MS + 1000;
}

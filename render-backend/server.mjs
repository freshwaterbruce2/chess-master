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

const app = express();
const PORT = Number(process.env.PORT || 3107);
// Default stays gemini-2.5-flash (free-tier capable). Override via GEMINI_MODEL if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const rateLimit = new Map();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

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
  const now = Date.now();
  const key = req.ip || 'unknown';
  const current = rateLimit.get(key);

  if (!current || now > current.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
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

/** Safe text extract: response.text throws when thinking ate maxOutputTokens / no parts. */
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConfigured: Boolean(gemini),
    model: GEMINI_MODEL,
    aiTutorEnabled: isAiTutorEnabled(),
    dailyCap: AI_DAILY_CAP,
    monthlyCap: AI_MONTHLY_CAP,
    installIdHeader: 'X-Chess-Install-Id',
  });
});

app.post('/api/chess/advice', async (req, res) => {
  // 1) Kill switch - missing/empty/false rejects all advice
  if (!isAiTutorEnabled()) {
    res.status(503).json({
      error:
        'AI tutor is disabled on this server (AI_TUTOR_ENABLED is not true). Enable it in the Render env when ready.',
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

  // 2) Per-install daily/monthly caps (persisted under render-backend/data/)
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

  // 3) Gemini (Chess-only; never Tutor OpenRouter)
  if (!gemini) {
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
    // gemini-2.5-flash thinking tokens count against maxOutputTokens.
    // With budget 700 and dynamic thinking, visible text is often empty and
    // response.text throws -> 502. Disable thinking for beginner advice;
    // raise output ceiling as a safety margin.
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(fen, question, legalMoves),
      config: {
        temperature: 0.35,
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const advice = extractAdviceText(response);
    if (!advice) {
      releaseReservedAdvice(installId);
      res.status(502).json({ error: 'Gemini analysis failed. Please try again.' });
      return;
    }

    res.json({
      advice,
      usage: {
        dayCount: reserve.dayCount,
        monthCount: reserve.monthCount,
        dailyCap: reserve.dailyCap,
        monthlyCap: reserve.monthlyCap,
      },
    });
  } catch (error) {
    releaseReservedAdvice(installId);
    console.error('[Gemini] chess advice failed:', error?.message || error);
    res.status(502).json({ error: 'Gemini analysis failed. Please try again.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[OK] Chess Master API listening on port ${PORT}`);
  console.log(`[OK] Gemini configured: ${gemini ? 'yes' : 'no'}`);
  console.log(`[OK] AI tutor enabled: ${isAiTutorEnabled() ? 'yes' : 'no (kill switch)'}`);
  console.log(`[OK] Caps: ${AI_DAILY_CAP}/day, ${AI_MONTHLY_CAP}/month per X-Chess-Install-Id`);
});

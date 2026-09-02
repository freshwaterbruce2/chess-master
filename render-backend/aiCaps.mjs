import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const USAGE_FILE = path.join(DATA_DIR, 'ai-usage.json');

/** Header clients must send for per-install caps. Documented in .env.example. */
export const INSTALL_ID_HEADER = 'x-chess-install-id';

export function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Missing / empty / anything other than true/1/yes → disabled. */
export function isAiTutorEnabled() {
  const raw = String(process.env.AI_TUTOR_ENABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getCapDefaults() {
  return {
    dailyCap: parsePositiveInt(process.env.AI_DAILY_CAP, 40),
    monthlyCap: parsePositiveInt(process.env.AI_MONTHLY_CAP, 800),
  };
}

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function utcMonthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify({ installs: {} }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.installs !== 'object') {
      return { installs: {} };
    }
    return parsed;
  } catch {
    return { installs: {} };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = `${USAGE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, USAGE_FILE);
}

/**
 * Normalize install id from header. Returns null if invalid.
 * Accepts UUID or opaque 8–128 char [A-Za-z0-9_-] tokens.
 */
export function normalizeInstallId(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const id = headerValue.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return null;
  return id;
}

/**
 * Check daily/monthly caps and reserve one unit if under cap.
 * Persists to disk so restarts keep counters.
 * @returns {{ ok: true, dayCount: number, monthCount: number } | { ok: false, status: number, error: string, dayCount?: number, monthCount?: number }}
 */
export function checkAndReserveAdvice(installId) {
  const { dailyCap, monthlyCap } = getCapDefaults();
  const day = utcDayKey();
  const month = utcMonthKey();
  const store = readStore();
  const prev = store.installs[installId] || {};

  let dayCount = prev.day === day ? Number(prev.dayCount) || 0 : 0;
  let monthCount = prev.month === month ? Number(prev.monthCount) || 0 : 0;

  if (dayCount >= dailyCap) {
    return {
      ok: false,
      status: 429,
      error: `Daily AI tutor cap reached (${dailyCap}/day). Try again tomorrow.`,
      dayCount,
      monthCount,
      dailyCap,
      monthlyCap,
    };
  }

  if (monthCount >= monthlyCap) {
    return {
      ok: false,
      status: 429,
      error: `Monthly AI tutor cap reached (${monthlyCap}/month). Try again next month.`,
      dayCount,
      monthCount,
      dailyCap,
      monthlyCap,
    };
  }

  dayCount += 1;
  monthCount += 1;
  store.installs[installId] = {
    day,
    dayCount,
    month,
    monthCount,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);

  return {
    ok: true,
    dayCount,
    monthCount,
    dailyCap,
    monthlyCap,
  };
}

/** Roll back a reserved unit if Gemini call failed after reserve. */
export function releaseReservedAdvice(installId) {
  const day = utcDayKey();
  const month = utcMonthKey();
  const store = readStore();
  const prev = store.installs[installId];
  if (!prev) return;

  if (prev.day === day && (Number(prev.dayCount) || 0) > 0) {
    prev.dayCount = (Number(prev.dayCount) || 0) - 1;
  }
  if (prev.month === month && (Number(prev.monthCount) || 0) > 0) {
    prev.monthCount = (Number(prev.monthCount) || 0) - 1;
  }
  prev.updatedAt = new Date().toISOString();
  store.installs[installId] = prev;
  writeStore(store);
}

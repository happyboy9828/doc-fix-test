/* Download limit tracker — a per-browser, UTC-midnight calendar-day counter.
   Because DocFix is a zero-backend, browser-only app, "per user" maps to
   "per browser". The counter lives in localStorage and resets automatically
   at 00:00 UTC when the calendar day changes.

   Public API:
     canDownload()              → boolean
     recordDownload()           → { count, date }  (call after a successful download)
     getDownloadStats()         → { count, remaining, resetsAt, limit, date }
     formatTimeRemaining(ms)    → human-readable string
     onLimitChange(cb)          → unsubscribe function
     resetDownloadLimit()       → force a reset (testing / manual)
*/

const STORAGE_KEY = "docfix_dl_limit";
export const DAILY_LIMIT = 10;

const EVENT = "docfix:downloadLimitChange";

/* ---------- storage helpers ---------- */

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Current UTC calendar day as YYYY-MM-DD (e.g. "2026-10-07"). */
export function currentUtcDate() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Epoch milliseconds for the next 00:00 UTC (start of the next calendar day). */
export function nextUtcMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0); // next day 00:00 UTC
  return d.getTime();
}

function readRaw() {
  if (!isBrowser()) return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeRaw(data) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or disabled – fail silently */
  }
}

/** Ensure stored date matches today; if not, reset count to 0. */
function ensureFreshDay() {
  const today = currentUtcDate();
  const data = readRaw();
  if (!data || data.date !== today) {
    const fresh = { date: today, count: 0 };
    writeRaw(fresh);
    return fresh;
  }
  return data;
}

function notify() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(EVENT));
}

/* ---------- public API ---------- */

/** Current state: { count, date } with automatic rollover at UTC midnight. */
export function getDownloadState() {
  const data = ensureFreshDay();
  return { count: data.count, date: data.date };
}

/** Whether the user is still below the daily limit. */
export function canDownload() {
  return getDownloadState().count < DAILY_LIMIT;
}

/** Persist a new download. Returns the updated state. */
export function recordDownload() {
  const data = ensureFreshDay();
  data.count += 1;
  writeRaw(data);
  notify();
  return { count: data.count, date: data.date };
}

/** Full stats for UI display. */
export function getDownloadStats() {
  const { count, date } = getDownloadState();
  const remaining = DAILY_LIMIT - count;
  const resetsAt = nextUtcMidnight(); // next 00:00 UTC
  return { count, remaining, resetsAt, limit: DAILY_LIMIT, date };
}

/** Human-readable countdown, e.g. "2h 15m" or "<1 minute". */
export function formatTimeRemaining(ms) {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `<1 minute`;
}

/** Subscribe to limit changes (fires after recordDownload or manual reset). */
export function onLimitChange(callback) {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

/** Force a reset — useful for testing or a manual "clear counter" button. */
export function resetDownloadLimit() {
  if (!isBrowser()) return;
  const today = currentUtcDate();
  writeRaw({ date: today, count: 0 });
  notify();
}

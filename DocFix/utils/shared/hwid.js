const STORAGE_KEY = "docfix_hwid";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function stableHash(input) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= input.charCodeAt(i);
    h2 = Math.immul(h2, 0x01000193);
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0");
  return hex.toUpperCase();
}

export function getHwid() {
  if (!isBrowser()) return "";
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) return cached;

    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      navigator.hardwareConcurrency || "",
      (navigator.deviceMemory || ""),
      (screen.colorDepth || ""),
      `${screen.width}x${screen.height}`,
      (navigator.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
      (navigator.cookieEnabled ? "1" : "0"),
    ];

    const fingerprint = stableHash(components.join("|"));
    localStorage.setItem(STORAGE_KEY, fingerprint);
    return fingerprint;
  } catch {
    return "";
  }
}

export function clearHwid() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
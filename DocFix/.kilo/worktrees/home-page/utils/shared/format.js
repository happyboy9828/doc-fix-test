// Shared display helpers.

// Batch converters stop accepting files past this many queued items.
export const MAX_FILES = 50;

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return Math.round(bytes) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

// Positive percentage saved by shrinking `compressed` bytes down from `original`.
export function savingsPercent(original, compressed) {
  return Math.round((1 - compressed / original) * 100);
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "photo.png" -> "photo", "photo" -> "photo", "" -> "image"
export const baseName = (name) => (name || "").replace(/\.[^.]+$/, "") || "image";

export const withExtension = (name, extension) => baseName(name) + "." + extension;
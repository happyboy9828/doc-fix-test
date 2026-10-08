// Image Resizer & Aspect Ratio Cropper: browser-only, zero dependencies. Image
// loading, rotate/flip, crop geometry (move, resize, aspect ratio locking) and
// resized export.

import { clamp } from "../../../utils/shared/format";
import { canvasToBlob, loadImage } from "../../../utils/shared/imageFile";

export const ACCEPTED_KINDS = ["png", "jpg", "webp", "svg"];
export const MAX_DIM = 8192; // longest side kept in memory and allowed for output

export const PRESETS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "Cover banner (3:1)", value: 3 },
];

// Creates a working canvas (longest side <= MAX_DIM) from a shared loadImage result.
export function createSession(loaded) {
  const ow = loaded.width, oh = loaded.height;
  const k = Math.min(1, MAX_DIM / Math.max(ow, oh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(ow * k));
  canvas.height = Math.max(1, Math.round(oh * k));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(loaded.img, 0, 0, canvas.width, canvas.height);
  return { canvas, W: canvas.width, H: canvas.height, name: loaded.name, originalWidth: ow, originalHeight: oh };
}

// ---------- Rotate and flip ----------

export function transformCanvas(canvas, op) {
  const W = canvas.width, H = canvas.height;
  const out = document.createElement("canvas");
  if (op === "rotate") { out.width = H; out.height = W; } else { out.width = W; out.height = H; }
  const ctx = out.getContext("2d");
  if (op === "rotate") { ctx.translate(H, 0); ctx.rotate(Math.PI / 2); }
  if (op === "flipH") { ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (op === "flipV") { ctx.translate(0, H); ctx.scale(1, -1); }
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// Moves the crop box along with the pixels, so it keeps framing the same area.
// W and H are the canvas size BEFORE the transform.
export function transformCrop(c, W, H, op) {
  if (op === "rotate") return { x: H - c.y - c.h, y: c.x, w: c.h, h: c.w };
  if (op === "flipH") return { x: W - c.x - c.w, y: c.y, w: c.w, h: c.h };
  return { x: c.x, y: H - c.y - c.h, w: c.w, h: c.h };
}

// ---------- Crop geometry ----------

// Largest rect of the given ratio that fits the image, centred near (cx, cy).
export function fitRatioRect(ratio, W, H, cx, cy) {
  let w = W, h = W / ratio;
  if (h > H) { h = H; w = H * ratio; }
  return { x: clamp(cx - w / 2, 0, W - w), y: clamp(cy - h / 2, 0, H - h), w, h };
}

export function moveCrop(start, dx, dy, W, H) {
  return { x: clamp(start.x + dx, 0, W - start.w), y: clamp(start.y + dy, 0, H - start.h), w: start.w, h: start.h };
}

// handle: "n", "ne", "e", "se", "s", "sw", "w", "nw". (px, py): pointer position
// in image pixels. ratio: null (free) or width / height.
export function resizeCrop(handle, start, px, py, W, H, ratio, min) {
  const x0 = start.x, y0 = start.y, x1 = start.x + start.w, y1 = start.y + start.h;
  const hasW = handle.includes("w"), hasE = handle.includes("e");
  const hasN = handle.includes("n"), hasS = handle.includes("s");

  if (!ratio) {
    let nx0 = x0, nx1 = x1, ny0 = y0, ny1 = y1;
    if (hasW) nx0 = clamp(px, 0, x1 - min);
    if (hasE) nx1 = clamp(px, x0 + min, W);
    if (hasN) ny0 = clamp(py, 0, y1 - min);
    if (hasS) ny1 = clamp(py, y0 + min, H);
    return { x: nx0, y: ny0, w: nx1 - nx0, h: ny1 - ny0 };
  }

  const minW = ratio >= 1 ? min * ratio : min;
  if ((hasW || hasE) && (hasN || hasS)) { // corner: anchor the opposite corner
    const ax = hasW ? x1 : x0, ay = hasN ? y1 : y0;
    const maxW = hasW ? ax : W - ax, maxH = hasN ? ay : H - ay;
    let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * ratio);
    w = Math.max(minW, Math.min(w, maxW, maxH * ratio));
    const h = w / ratio;
    return { x: hasW ? ax - w : ax, y: hasN ? ay - h : ay, w, h };
  }
  if (hasW || hasE) { // side edge: height follows, centred vertically
    const ax = hasW ? x1 : x0, cy = y0 + start.h / 2;
    const maxW = hasW ? ax : W - ax;
    let w = Math.max(minW, Math.min(Math.abs(px - ax), maxW, (2 * Math.min(cy, H - cy)) * ratio));
    const h = w / ratio;
    return { x: hasW ? ax - w : ax, y: cy - h / 2, w, h };
  }
  const ay = hasN ? y1 : y0, cx = x0 + start.w / 2; // top or bottom edge
  const maxH = hasN ? ay : H - ay;
  let h = Math.max(minW / ratio, Math.min(Math.abs(py - ay), maxH, (2 * Math.min(cx, W - cx)) / ratio));
  const w = h * ratio;
  return { x: cx - w / 2, y: hasN ? ay - h : ay, w, h };
}

export function simplifyRatio(w, h) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(w, h);
  const a = w / g, b = h / g;
  if (a <= 50 && b <= 50) return a + ":" + b;
  return (w / h).toFixed(2) + ":1";
}

// ---------- Export ----------

// Downscales the crop to (outW, outH) using halving steps for crisp results,
// then encodes to PNG/JPG/WebP using the shared canvasToBlob.
export async function exportBlob(work, crop, outW, outH, format, quality) {
  const sx = Math.round(crop.x), sy = Math.round(crop.y);
  const sw = Math.max(1, Math.min(Math.round(crop.w), work.width - sx));
  const sh = Math.max(1, Math.min(Math.round(crop.h), work.height - sy));

  let cur = document.createElement("canvas");
  cur.width = sw;
  cur.height = sh;
  cur.getContext("2d").drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);
  while (cur.width / 2 >= outW && cur.height / 2 >= outH) {
    const step = document.createElement("canvas");
    step.width = Math.floor(cur.width / 2);
    step.height = Math.floor(cur.height / 2);
    const sctx = step.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(cur, 0, 0, step.width, step.height);
    cur = step;
  }
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (format === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, outW, outH); }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, outW, outH);

  const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[format];
  return canvasToBlob(out, type, quality / 100);
}
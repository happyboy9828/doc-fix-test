// Remove BG: browser-only, zero dependencies. Subject detection, mask editing,
// edge smoothing, backdrop replacement, rendering and export.
//
// Detection is classical image processing (background colour model seeded from
// the image border + flood fill + cleanup). It works best on photos where the
// background differs in colour from the subject. Brush tools cover the rest.

import { JPEG, PNG, canvasToBlob, loadImage } from "../../../utils/shared/imageFile";

export const ACCEPTED_KINDS = ["png", "jpg", "webp"];

const MAX_DIM = 2048; // longest side used for editing and export
const DETECT_DIM = 480; // longest side used for subject detection

// ---------- Loading ----------

export function createSession(loaded) {
  const scale = Math.min(1, MAX_DIM / Math.max(loaded.width, loaded.height));
  const W = Math.max(1, Math.round(loaded.width * scale));
  const H = Math.max(1, Math.round(loaded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(loaded.img, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H).data;
  return {
    W, H,
    originalWidth: loaded.width,
    originalHeight: loaded.height,
    name: loaded.name,
    canvas, // the original picture at working size
    src,
    hard: new Uint8ClampedArray(W * H).fill(255), // editable mask
    soft: new Uint8ClampedArray(W * H).fill(255), // mask after edge smoothing
    softness: 5,
    history: [],
    bg: null,
    backdrop: { mode: "transparent", color: "#ffffff", image: null, blur: 12 },
    out: new ImageData(W, H),
  };
}

// ---------- Blur helpers ----------

function boxPass(src, dst, w, h, r, horizontal) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 1 : w;
  const lineStep = horizontal ? w : 1;
  const div = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * stride];
    for (let i = 0; i < len; i++) {
      dst[base + i * stride] = sum / div;
      sum += src[base + Math.min(len - 1, i + r + 1) * stride] - src[base + Math.max(0, i - r) * stride];
    }
  }
}

// Three box passes approximate a Gaussian. `amount` is the edge width in pixels.
export function blurMask(src, w, h, amount) {
  const k = Math.round(amount / 2);
  if (k <= 0) return Uint8ClampedArray.from(src);
  let a = Float32Array.from(src);
  let b = new Float32Array(w * h);
  for (let n = 0; n < 3; n++) {
    boxPass(a, b, w, h, k, true);
    boxPass(b, a, w, h, k, false);
  }
  return Uint8ClampedArray.from(a);
}

// ---------- Subject detection ----------

function toLab(r, g, b) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Finds up to 3 dominant colours along the image border (k-means in Lab).
function borderColours(lab, w, h) {
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const samples = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) {
        const i = (y * w + x) * 3;
        samples.push([lab[i], lab[i + 1], lab[i + 2]]);
      }
    }
  }
  const centres = [samples[0]];
  while (centres.length < 3) {
    let far = null, farD = -1;
    for (let s = 0; s < samples.length; s += 3) {
      const d = Math.min(...centres.map((c) => dist3(c, samples[s])));
      if (d > farD) { farD = d; far = samples[s]; }
    }
    if (farD < 12) break;
    centres.push(far);
  }
  let counts = new Array(centres.length).fill(0);
  for (let it = 0; it < 8; it++) {
    const sums = centres.map(() => [0, 0, 0]);
    counts = new Array(centres.length).fill(0);
    for (const s of samples) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = dist3(centres[c], s);
        if (d < bd) { bd = d; best = c; }
      }
      counts[best]++;
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2];
    }
    for (let c = 0; c < centres.length; c++) {
      if (counts[c]) centres[c] = sums[c].map((v) => v / counts[c]);
    }
  }
  const kept = centres.filter((c, i) => counts[i] >= samples.length * 0.1);
  return kept.length ? kept : [centres[0]];
}

function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, max = 0, best = 0;
  for (let t = 0; t < hist.length; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > max) { max = v; best = t; }
  }
  return best;
}

// 3x3 majority vote: smooths jagged edges and removes specks.
function majority(m, w, h) {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) c += m[yy * w + Math.min(w - 1, Math.max(0, x + dx))];
      }
      o[y * w + x] = c >= 5 ? 1 : 0;
    }
  }
  return o;
}

// Keeps the largest blob and any blob at least 10% of its size.
function keepMainBlobs(m, w, h) {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const sizes = [0];
  let next = 1;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]) continue;
    let sp = 0, size = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp) {
      const p = stack[--sp];
      size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && m[p - 1] && !label[p - 1]) { label[p - 1] = next; stack[sp++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !label[p + 1]) { label[p + 1] = next; stack[sp++] = p + 1; }
      if (y > 0 && m[p - w] && !label[p - w]) { label[p - w] = next; stack[sp++] = p - w; }
      if (y < h - 1 && m[p + w] && !label[p + w]) { label[p + w] = next; stack[sp++] = p + w; }
    }
    sizes.push(size);
    next++;
  }
  let max = 0;
  for (const s of sizes) if (s > max) max = s;
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) if (label[i] && sizes[label[i]] >= max * 0.1) out[i] = 1;
  return out;
}

// sensitivity 0-100 (higher removes more), softness = edge width in px.
export function runDetection(session, options) {
  const { W, H } = session;
  const sensitivity = options.sensitivity;
  const s = Math.min(1, DETECT_DIM / Math.max(W, H));
  const dw = Math.max(2, Math.round(W * s));
  const dh = Math.max(2, Math.round(H * s));
  const small = document.createElement("canvas");
  small.width = dw;
  small.height = dh;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(session.canvas, 0, 0, dw, dh);
  const px = sctx.getImageData(0, 0, dw, dh).data;

  const n = dw * dh;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const l = toLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    lab[i * 3] = l[0]; lab[i * 3 + 1] = l[1]; lab[i * 3 + 2] = l[2];
  }

  // Distance of every pixel from the background colour model.
  const colours = borderColours(lab, dw, dh);
  const dmap = new Float32Array(n);
  const hist = new Array(101).fill(0);
  for (let i = 0; i < n; i++) {
    const p = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
    let d = Infinity;
    for (const c of colours) d = Math.min(d, dist3(c, p));
    dmap[i] = d;
    hist[Math.min(100, Math.round(d))]++;
  }
  const base = Math.min(30, Math.max(8, otsu(hist, n) * 0.6));
  const T = base * (1.6 - (sensitivity / 100) * 1.2);

  // Flood the background inward from the border.
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const seed = (i) => { if (!isBg[i] && dmap[i] < T) { isBg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < dw; x++) { seed(x); seed((dh - 1) * dw + x); }
  for (let y = 0; y < dh; y++) { seed(y * dw); seed(y * dw + dw - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % dw, y = (p / dw) | 0;
    if (x > 0) seed(p - 1);
    if (x < dw - 1) seed(p + 1);
    if (y > 0) seed(p - dw);
    if (y < dh - 1) seed(p + dw);
  }

  let fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = isBg[i] ? 0 : 1;
  fg = majority(majority(fg, dw, dh), dw, dh);
  fg = keepMainBlobs(fg, dw, dh);

  let count = 0;
  for (let i = 0; i < n; i++) if (fg[i]) count++;

  // Smooth at low resolution, upscale, then threshold for a clean contour.
  const gray = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) gray[i] = fg[i] ? 255 : 0;
  const smooth = blurMask(gray, dw, dh, 3);
  const maskImg = new ImageData(dw, dh);
  for (let i = 0; i < n; i++) {
    maskImg.data[i * 4] = maskImg.data[i * 4 + 1] = maskImg.data[i * 4 + 2] = smooth[i];
    maskImg.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(maskImg, 0, 0);
  const big = document.createElement("canvas");
  big.width = W;
  big.height = H;
  const bctx = big.getContext("2d", { willReadFrequently: true });
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, W, H);
  const bd = bctx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) session.hard[i] = bd[i * 4] > 127 ? 255 : 0;

  session.softness = options.softness;
  session.soft = blurMask(session.hard, W, H, session.softness);
  session.history = [];
  return { coverage: count / n };
}

// ---------- Brush ----------

export function snapshot(session) {
  session.history.push(Uint8ClampedArray.from(session.hard));
  if (session.history.length > 8) session.history.shift();
}

export function undo(session) {
  const prev = session.history.pop();
  if (!prev) return false;
  session.hard = prev;
  session.soft = blurMask(session.hard, session.W, session.H, session.softness);
  return true;
}

function stamp(session, cx, cy, R, mode) {
  const { W, H, hard, soft } = session;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R) continue;
      const f = d <= R * 0.7 ? 1 : (R - d) / (R * 0.3);
      const i = y * W + x;
      if (mode === "erase") {
        const v = 255 * (1 - f);
        if (hard[i] > v) hard[i] = v;
        if (soft[i] > v) soft[i] = v;
      } else {
        const v = 255 * f;
        if (hard[i] < v) hard[i] = v;
        if (soft[i] < v) soft[i] = v;
      }
    }
  }
}

// Paints from (ax, ay) to (bx, by). Returns the changed rectangle.
export function paintStroke(session, ax, ay, bx, by, R, mode) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, R / 3)));
  for (let k = 0; k <= steps; k++) {
    stamp(session, ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps, R, mode);
  }
  return {
    x0: Math.max(0, Math.floor(Math.min(ax, bx) - R - 1)),
    y0: Math.max(0, Math.floor(Math.min(ay, by) - R - 1)),
    x1: Math.min(session.W, Math.ceil(Math.max(ax, bx) + R + 1)),
    y1: Math.min(session.H, Math.ceil(Math.max(ay, by) + R + 1)),
  };
}

// Call when a stroke ends: re-applies edge smoothing to the edited mask.
export function finishStroke(session) {
  session.soft = blurMask(session.hard, session.W, session.H, session.softness);
}

// Re-blurs the hard mask. Named "apply" rather than "set" so it never reads
// like a React state setter at the call site.
export function applySoftness(session, amount) {
  session.softness = amount;
  session.soft = blurMask(session.hard, session.W, session.H, amount);
}

// ---------- Backdrop ----------

function scaleTo(canvas, w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

function blurredCopy(srcCanvas, W, H, amount) {
  const targetW = Math.max(2, W / (1 + amount * 1.5));
  let cur = srcCanvas;
  while (cur.width / 2 > targetW) cur = scaleTo(cur, cur.width / 2, cur.height / 2);
  cur = scaleTo(cur, targetW, (targetW * H) / W);
  while (cur.width * 2 < W) cur = scaleTo(cur, cur.width * 2, cur.height * 2);
  return scaleTo(cur, W, H);
}

export function updateBackdrop(session, patch) {
  Object.assign(session.backdrop, patch);
  const { W, H, backdrop } = session;
  if (backdrop.mode === "transparent") { session.bg = null; return; }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  if (backdrop.mode === "solid") {
    ctx.fillStyle = backdrop.color;
    ctx.fillRect(0, 0, W, H);
  } else if (backdrop.mode === "image") {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, W, H);
    const img = backdrop.image;
    if (img) {
      const k = Math.max(W / img.naturalWidth, H / img.naturalHeight); // cover
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }
  } else if (backdrop.mode === "blur") {
    ctx.drawImage(blurredCopy(session.canvas, W, H, backdrop.blur), 0, 0);
  }
  session.bg = ctx.getImageData(0, 0, W, H).data;
}

// ---------- Rendering & export ----------

// Draws the result into `canvas`. Pass a rect to redraw only that area.
export function render(session, canvas, rect) {
  const { W, H, src, soft, bg, out } = session;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; rect = null; }
  const r = rect || { x0: 0, y0: 0, x1: W, y1: H };
  const d = out.data;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      const i = y * W + x, p = i * 4;
      const a = (soft[i] * src[p + 3]) / 255;
      if (!bg) {
        d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; d[p + 3] = a;
      } else {
        const k = a / 255;
        d[p] = src[p] * k + bg[p] * (1 - k);
        d[p + 1] = src[p + 1] * k + bg[p + 1] * (1 - k);
        d[p + 2] = src[p + 2] * k + bg[p + 2] * (1 - k);
        d[p + 3] = 255;
      }
    }
  }
  canvas.getContext("2d").putImageData(out, 0, 0, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
}

export function exportBlob(session, resultCanvas, format) {
  if (format === "jpg") {
    const flattened = document.createElement("canvas");
    flattened.width = session.W;
    flattened.height = session.H;
    const ctx = flattened.getContext("2d");
    ctx.fillStyle = "#ffffff"; // JPG has no transparency
    ctx.fillRect(0, 0, flattened.width, flattened.height);
    ctx.drawImage(resultCanvas, 0, 0);
    return canvasToBlob(flattened, JPEG, 0.95);
  }
  return canvasToBlob(resultCanvas, PNG, 0.95);
}
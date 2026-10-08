// Watermark: draws text or logo watermarks (single or tiled) onto photos, loads
// fonts and images, renders previews and exports watermarked PNG/JPG/WebP files
// with ZIP packaging. Browser only, zero dependencies.
//
// Every size in the settings is RELATIVE to the photo width, so a batch of
// photos with different resolutions all get a watermark that looks the same.

import { baseName, clamp } from "../../../utils/shared/format";
import { canvasToBlob, extensionFor, mimeFor } from "../../../utils/shared/imageFile";

// Kinds this tool accepts. Photos exclude SVG; logos allow it.
export const PHOTO_KINDS = ["png", "jpg", "webp"];
export const LOGO_KINDS = ["png", "jpg", "webp", "svg"];
export const MAX_EXPORT_SIDE = 8192;

export const FONTS = [
  { id: "inter", label: "Inter Bold", name: "Inter", family: 'Inter, system-ui, sans-serif', weight: 700, style: "normal" },
  { id: "playfair", label: "Playfair", name: "Playfair Display", family: '"Playfair Display", Georgia, serif', weight: 700, style: "normal" },
  { id: "georgia", label: "Georgia Italic", name: "Georgia", family: 'Georgia, "Times New Roman", serif', weight: 400, style: "italic" },
  { id: "pacifico", label: "Pacifico", name: "Pacifico", family: 'Pacifico, "Brush Script MT", cursive', weight: 400, style: "normal" },
  { id: "caveat", label: "Caveat", name: "Caveat", family: 'Caveat, "Segoe Script", cursive', weight: 700, style: "normal" },
  { id: "mono", label: "Courier", name: "Courier New", family: '"Courier New", Courier, monospace', weight: 700, style: "normal" },
];

export const ANCHORS = [
  { id: "tl", label: "Top-L", aria: "Top left" }, { id: "tc", label: "Top-C", aria: "Top center" }, { id: "tr", label: "Top-R", aria: "Top right" },
  { id: "ml", label: "Mid-L", aria: "Middle left" }, { id: "c", label: "Center", aria: "Center" }, { id: "mr", label: "Mid-R", aria: "Middle right" },
  { id: "bl", label: "Bot-L", aria: "Bottom left" }, { id: "bc", label: "Bot-C", aria: "Bottom center" }, { id: "br", label: "Bot-R", aria: "Bottom right" },
];

export const DEFAULT_SETTINGS = {
  type: "text", text: "\u00a9 2026 Studio Brand", fontId: "inter", color: "#ffffff", shadow: true,
  sizeText: 5, sizeLogo: 20, opacity: 60,
  mode: "single", anchor: "br", custom: null, margin: 3, angle: 0, spacing: 60,
};

// ---------- Loading ----------

// A generated landscape so the tool is usable before any photo is added.
export function createSample() {
  const W = 1600, H = 1067;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const sky = x.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, "#1e3a8a"); sky.addColorStop(0.55, "#c2410c"); sky.addColorStop(1, "#fbbf24");
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(254,243,199,.95)"; x.beginPath(); x.arc(W * 0.68, H * 0.5, 90, 0, Math.PI * 2); x.fill();
  const ridge = (base, amp, color, seed) => {
    x.fillStyle = color; x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= 40; i++) x.lineTo((W / 40) * i, base - amp * (0.5 + 0.5 * Math.sin(i * 0.55 + seed)) - amp * 0.4 * Math.sin(i * 1.3 + seed * 2));
    x.lineTo(W, H); x.closePath(); x.fill();
  };
  ridge(H * 0.62, 120, "#7c2d12", 1); ridge(H * 0.72, 110, "#431407", 3); ridge(H * 0.85, 90, "#1c0a04", 5);
  return { img: c, width: W, height: H, name: "sample.jpg", kind: "jpg" };
}

// Loads a font so canvas fillText measures and renders with it. Falls back to
// whatever the browser already has when the Font Loading API is unavailable.
export function loadFont(def) {
  if (typeof document === "undefined" || !document.fonts || !document.fonts.load) return Promise.resolve();
  return document.fonts.load(def.style + " " + def.weight + ' 32px "' + def.name + '"').catch(() => {});
}

// ---------- Drawing ----------

function makeStamp(W, s, logo) {
  if (s.type === "logo") {
    if (!logo) return null;
    const w = Math.max(4, Math.round((W * s.sizeLogo) / 100));
    const h = Math.max(4, Math.round((w * logo.height) / logo.width));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(logo.img, 0, 0, w, h);
    return { canvas: c, w, h };
  }
  const text = (s.text || "").replace(/\r/g, "");
  if (!text.trim()) return null;
  const def = FONTS.find((f) => f.id === s.fontId) || FONTS[0];
  const px = Math.max(6, (W * s.sizeText) / 100);
  const font = def.style + " " + def.weight + " " + px + "px " + def.family;
  const lines = text.split("\n");
  const m = document.createElement("canvas").getContext("2d");
  m.font = font;
  const maxW = Math.max.apply(null, lines.map((l) => m.measureText(l).width));
  const lineH = px * 1.25, pad = Math.ceil(px * 0.3);
  const w = Math.ceil(maxW + pad * 2), h = Math.ceil(lineH * lines.length + pad * 2);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.font = font;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = s.color;
  if (s.shadow) { x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = px * 0.12; x.shadowOffsetY = px * 0.05; }
  lines.forEach((l, i) => x.fillText(l, w / 2, pad + lineH * (i + 0.5)));
  return { canvas: c, w, h };
}

// Draws the watermark on ctx (size W x H). Returns the box it occupies
// (single mode) so the page can hit-test dragging, or null.
export function drawWatermark(ctx, W, H, s, logo) {
  const st = makeStamp(W, s, logo);
  if (!st) return null;
  const rad = (s.angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const bw = st.w * cos + st.h * sin, bh = st.w * sin + st.h * cos;
  ctx.save();
  ctx.globalAlpha = clamp(s.opacity / 100, 0, 1);

  if (s.mode === "tile") {
    let sx = st.w * (1 + s.spacing / 100), sy = st.h * (1 + s.spacing / 50);
    const diag = Math.hypot(W, H);
    while ((diag / sx + 2) * (diag / sy + 2) > 3000) { sx *= 1.2; sy *= 1.2; } // keep huge counts in check
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rad);
    let row = 0;
    for (let y = -diag / 2 - sy; y < diag / 2 + sy; y += sy, row++) {
      const off = row % 2 ? sx / 2 : 0; // staggered rows read as a diagonal pattern
      for (let x = -diag / 2 - sx + off; x < diag / 2 + sx; x += sx) ctx.drawImage(st.canvas, x, y);
    }
    ctx.restore();
    return null;
  }

  const m = (W * s.margin) / 100;
  let cx, cy;
  if (s.custom) {
    cx = clamp(s.custom.x * W, bw / 2, W - bw / 2);
    cy = clamp(s.custom.y * H, bh / 2, H - bh / 2);
  } else {
    const row = s.anchor === "c" ? 1 : "tmb".indexOf(s.anchor[0]);
    const col = s.anchor === "c" ? 1 : "lcr".indexOf(s.anchor[1]);
    const x = col === 0 ? m : col === 1 ? (W - bw) / 2 : W - bw - m;
    const y = row === 0 ? m : row === 1 ? (H - bh) / 2 : H - bh - m;
    cx = Math.max(bw / 2, x + bw / 2);
    cy = Math.max(bh / 2, y + bh / 2);
  }
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.drawImage(st.canvas, -st.w / 2, -st.h / 2);
  ctx.restore();
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}

// Draws photo + watermark into `canvas`, scaled so the longest side <= maxSide.
export function renderWatermarked(canvas, photo, s, logo, maxSide) {
  const k = Math.min(1, maxSide / Math.max(photo.width, photo.height));
  const W = Math.max(1, Math.round(photo.width * k));
  const H = Math.max(1, Math.round(photo.height * k));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo.img, 0, 0, W, H);
  return drawWatermark(ctx, W, H, s, logo);
}

// Keeps the photo's own format (JPG stays JPG, PNG stays PNG, WEBP stays WEBP).
export async function exportPhoto(photo, s, logo) {
  const canvas = document.createElement("canvas");
  renderWatermarked(canvas, photo, s, logo, MAX_EXPORT_SIDE);
  const mime = mimeFor(photo.kind) || "image/png";
  const blob = await canvasToBlob(canvas, mime, 0.92);
  if (!blob) throw new Error(photo.name + " is too large for this browser.");
  return { blob, name: baseName(photo.name) + "-watermarked." + (extensionFor(photo.kind) || "png") };
}
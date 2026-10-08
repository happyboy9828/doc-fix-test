// Compress Image: browser-only, zero dependencies. Image loading, compression
// (JPG, WebP, PNG, SVG) and target file size search.

import { baseName } from "../../../utils/shared/format";
import {
  JPEG,
  PNG,
  SVG,
  canvasToBlob,
  extensionFor,
  kindForMime,
  kindOf,
  loadImage,
  mimeFor,
} from "../../../utils/shared/imageFile";

export const ACCEPTED_KINDS = ["png", "jpg", "webp", "svg"];

// ---------- Loading ----------

// Adds the SVG source text so it can be optimised as markup instead of pixels.
export async function loadItem(file) {
  const kind = kindOf(file);
  const loaded = await loadImage(file, 512); // SVGs without a size report 0
  return { ...loaded, file, kind, svgText: kind === "svg" ? await file.text() : null };
}

// ---------- SVG ----------

function optimizeSvg(text, quality) {
  const precision = quality >= 90 ? 3 : quality >= 70 ? 2 : 1;
  let s = text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/gi, "")
    .replace(/\s(?:inkscape|sodipodi):[\w-]+="[^"]*"/g, "")
    .replace(/\sxmlns:(?:inkscape|sodipodi|dc|cc|rdf)="[^"]*"/g, "")
    .replace(/\s(?:data-name|xml:space)="[^"]*"/g, "");
  const numeric = /(\s(?:d|points|transform|viewBox|x|y|width|height|cx|cy|r|rx|ry|x1|y1|x2|y2|offset|stroke-width|stroke-miterlimit)=")([^"]*)"/g;
  s = s.replace(numeric, (m, pre, val) =>
    pre + val.replace(/-?\d*\.\d+/g, (n) => String(Number(Number(n).toFixed(precision)))) + '"');
  s = s.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
  const check = new DOMParser().parseFromString(s, "image/svg+xml");
  return check.getElementsByTagName("parsererror").length ? text : s;
}

// ---------- Raster helpers ----------

const toBlob = canvasToBlob;

function drawScaled(item, scale, whiteBg) {
  const w = Math.max(1, Math.round(item.width * scale));
  const h = Math.max(1, Math.round(item.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (whiteBg) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(item.img, 0, 0, w, h);
  return canvas;
}

// Lossy PNG: reduce colours per channel with Floyd-Steinberg dithering,
// which makes the PNG encoder produce a much smaller file.
function posterize(canvas, quality) {
  const levels = Math.max(2, Math.round(256 * Math.pow(quality / 100, 2.2)));
  if (levels >= 256) return;
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const step = 255 / (levels - 1);
  let cur = [0, 1, 2].map(() => new Float32Array(w + 2));
  let nxt = [0, 1, 2].map(() => new Float32Array(w + 2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (d[p + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        const v = d[p + c] + cur[c][x + 1];
        const q = Math.round(Math.min(255, Math.max(0, v)) / step) * step;
        const e = v - q;
        d[p + c] = q;
        cur[c][x + 2] += (e * 7) / 16;
        nxt[c][x] += (e * 3) / 16;
        nxt[c][x + 1] += (e * 5) / 16;
        nxt[c][x + 2] += e / 16;
      }
    }
    const t = cur; cur = nxt; nxt = t;
    nxt.forEach((row) => row.fill(0));
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- Compression ----------

// settings: { quality: 1-100, format: "original" | "webp" | "jpg", maxKB: number | 0 }
export async function compressItem(item, settings) {
  const { quality, format } = settings;
  const limit = settings.maxKB ? settings.maxKB * 1024 : 0;

  if (item.kind === "svg" && format === "original") {
    const text = optimizeSvg(item.svgText, quality);
    const blob = new Blob([text], { type: SVG });
    const kept = blob.size >= item.size;
    return finish(item, kept ? item.file : blob, SVG, 1, quality,
      kept ? "Already optimal, original kept." : (limit && blob.size > limit ? "SVG text cannot shrink further to reach the limit." : ""), kept);
  }

  const type = format === "original" ? mimeFor(item.kind) : mimeFor(format);
  if (!type) throw new Error("Nothing to compress.");

  const attempt = async (scale, q) => {
    const canvas = drawScaled(item, scale, type === JPEG);
    if (type === PNG) posterize(canvas, q);
    return toBlob(canvas, type, q / 100);
  };

  let scale = 1;
  let q = quality;
  let blob = await attempt(scale, q);
  let note = "";

  if (limit && blob.size > limit) {
    let reached = false;
    for (let round = 0; round < 8 && !reached; round++) {
      const low = await attempt(scale, 5);
      if (low.size <= limit) {
        let lo = 5, hi = q, best = { blob: low, q: 5 };
        for (let i = 0; i < 6; i++) {
          const mid = Math.round((lo + hi) / 2);
          if (mid === lo || mid === hi) break;
          const b = await attempt(scale, mid);
          if (b.size <= limit) { best = { blob: b, q: mid }; lo = mid; } else hi = mid;
        }
        blob = best.blob; q = best.q; reached = true;
      } else {
        blob = low; q = 5;
        scale *= 0.85; // quality alone is not enough: shrink the pixels a little
      }
    }
    if (!reached) note = "Could not reach " + settings.maxKB + " KB. This is the smallest result.";
    else if (scale < 1) note = "Resized to " + Math.round(item.width * scale) + "x" + Math.round(item.height * scale) + " to fit the limit.";
  }

  if (blob.type !== type) note = (note ? note + " " : "") + "This browser could not encode " + type.replace("image/", "").toUpperCase() + ", so " + blob.type.replace("image/", "").toUpperCase() + " was used.";

  const sameType = blob.type === item.file.type;
  if (blob.size >= item.size && scale === 1 && (sameType || format !== "original")) {
    return finish(item, item.file, item.file.type, 1, 100, "Already optimal, original kept.", true);
  }
  return finish(item, blob, blob.type, scale, q, note, false);
}

function finish(item, blob, type, scale, quality, note, kept) {
  return {
    blob,
    size: blob.size,
    type,
    scale,
    quality,
    note,
    kept,
    url: URL.createObjectURL(blob),
    width: Math.round(item.width * scale),
    height: Math.round(item.height * scale),
    name: kept ? item.name : baseName(item.name) + "-compressed." + extensionFor(kindForMime(type)),
  };
}
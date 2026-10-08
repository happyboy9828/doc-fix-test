// Favicon Generator: image loading, icon rendering, .ico building,
// .zip packaging and the HTML <head> snippet. Browser only, zero dependencies.

import { canvasToBytes, loadImage } from "../../../utils/shared/imageFile";
import { downloadBlob } from "../../../utils/shared/download";
import { createZip, encodeText } from "../../../utils/shared/zip";

// The widest icon this tool renders, and the fallback for SVGs with no size.
export const MAX_ICON_SIZE = 512;

export const ACCEPTED_KINDS = ["png", "jpg", "svg", "webp"];

// Every file the tool can output. `sizes` lists the pixel sizes drawn into it.
export const OUTPUT_FILES = [
  { key: "ico", name: "favicon.ico", label: "favicon.ico", detail: "16x16, 32x32, 48x48", sizes: [16, 32, 48] },
  { key: "png16", name: "favicon-16x16.png", label: "favicon-16x16.png", detail: "16x16", sizes: [16] },
  { key: "png32", name: "favicon-32x32.png", label: "favicon-32x32.png", detail: "32x32", sizes: [32] },
  { key: "apple", name: "apple-touch-icon.png", label: "apple-touch-icon.png", detail: "180x180", sizes: [180] },
  { key: "a192", name: "android-chrome-192x192.png", label: "android-chrome-192x192.png", detail: "192x192", sizes: [192] },
  { key: "a512", name: "android-chrome-512x512.png", label: "android-chrome-512x512.png", detail: "512x512", sizes: [512] },
  { key: "manifest", name: "site.webmanifest", label: "site.webmanifest", detail: "lists the Android icons", sizes: [] },
];

export const DEFAULT_SELECTION = {
  ico: true, png16: true, png32: true, apple: true, a192: true, a512: true, manifest: true,
};

// ---------- Rendering ----------

// Draws `src` (loaded image) to fit inside a box, halving step by step
// when the source is much larger than the target, so downscaling stays crisp.
function drawContain(ctx, src, sw, sh, x, y, boxW, boxH) {
  const scale = Math.min(boxW / sw, boxH / sh);
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const dx = x + (boxW - tw) / 2;
  const dy = y + (boxH - th) / 2;

  let current = src;
  let cw = sw;
  let ch = sh;
  while (cw / 2 > tw && ch / 2 > th) {
    const step = document.createElement("canvas");
    step.width = Math.floor(cw / 2);
    step.height = Math.floor(ch / 2);
    const sctx = step.getContext("2d");
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(current, 0, 0, step.width, step.height);
    current = step;
    cw = step.width;
    ch = step.height;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, dx, dy, tw, th);
}

// options: { shape: "square" | "circle", padding: 0-40 (percent), background: null | "#rrggbb" }
export function renderIcon(source, size, options, targetCanvas) {
  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.save();

  if (options.shape === "circle") {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, size, size);
  }

  const pad = Math.round((size * options.padding) / 100);
  const box = Math.max(1, size - pad * 2);
  drawContain(ctx, source.img, source.width, source.height, pad, pad, box, box);
  ctx.restore();
  return canvas;
}

// ---------- ICO ----------

// Builds an .ico that embeds PNG images (supported by all modern browsers).
function buildIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  const total = images.reduce((sum, i) => sum + i.bytes.length, headerSize);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, count, true);

  let offset = headerSize;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    out[e] = img.size >= 256 ? 0 : img.size;
    out[e + 1] = img.size >= 256 ? 0 : img.size;
    out[e + 2] = 0;
    out[e + 3] = 0;
    view.setUint16(e + 4, 1, true); // colour planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, img.bytes.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(img.bytes, offset);
    offset += img.bytes.length;
  });
  return out;
}

// ---------- Package + snippet ----------

function buildManifest(selection) {
  const icons = [];
  if (selection.a192) icons.push({ src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" });
  if (selection.a512) icons.push({ src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" });
  return JSON.stringify(
    { name: "", short_name: "", icons, theme_color: "#ffffff", background_color: "#ffffff", display: "standalone" },
    null,
    2
  );
}

export function buildHeadSnippet(selection) {
  const lines = [];
  if (selection.ico) lines.push('<link rel="icon" type="image/x-icon" href="/favicon.ico">');
  if (selection.png16) lines.push('<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">');
  if (selection.png32) lines.push('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">');
  if (selection.apple) lines.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">');
  if (selection.manifest) lines.push('<link rel="manifest" href="/site.webmanifest">');
  return lines.join("\n");
}

// Returns a Blob (.zip) with every selected file.
export async function buildFaviconZip(source, options, selection) {
  const files = [];
  for (const spec of OUTPUT_FILES) {
    if (!selection[spec.key]) continue;
    if (spec.key === "manifest") {
      files.push({ name: spec.name, data: encodeText(buildManifest(selection)) });
    } else if (spec.key === "ico") {
      const images = [];
      for (const size of spec.sizes) {
        images.push({ size, bytes: await canvasToBytes(renderIcon(source, size, options), "image/png") });
      }
      files.push({ name: spec.name, data: buildIco(images) });
    } else {
      files.push({ name: spec.name, data: await canvasToBytes(renderIcon(source, spec.sizes[0], options), "image/png") });
    }
  }
  if (!files.length) throw new Error("Select at least one file to download.");
  files.push({ name: "head-snippet.html", data: encodeText(buildHeadSnippet(selection) + "\n") });
  return createZip(files);
}
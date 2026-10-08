// Shared image file handling: kind detection, validation and decoding.

export const PNG = "image/png";
export const JPEG = "image/jpeg";
export const WEBP = "image/webp";
export const SVG = "image/svg+xml";

// Short kind is the internal currency of the tools; MIME types only cross the
// boundary when talking to canvas.toBlob and <input accept>.
export const MIME_FOR_KIND = { png: PNG, jpg: JPEG, webp: WEBP, svg: SVG };

const KIND_FOR_EXTENSION = { png: "png", jpg: "jpg", jpeg: "jpg", webp: "webp", svg: "svg" };

const extensionOf = (name) => (name.split(".").pop() || "").toLowerCase();

export const extensionFor = (kind) => KIND_FOR_EXTENSION[kind === "jpg" ? "jpg" : kind] || "bin";

export const mimeFor = (kind) => MIME_FOR_KIND[kind] || "application/octet-stream";

// Some systems hand over files with an empty MIME type, so fall back to the
// extension before rejecting.
export function kindOf(file) {
  if (!file) return null;
  if (file.type && kindForMime(file.type)) return kindForMime(file.type);
  return KIND_FOR_EXTENSION[extensionOf(file.name || "")] || null;
}

export function kindForMime(mime) {
  return Object.keys(MIME_FOR_KIND).find((kind) => MIME_FOR_KIND[kind] === mime) || null;
}

// kinds: array of "png" | "jpg" | "webp" | "svg".
export function isAcceptedFile(file, kinds) {
  const kind = kindOf(file);
  return !!kind && kinds.includes(kind);
}

export const ACCEPT_ATTR = (kinds) => kinds.map((kind) => MIME_FOR_KIND[kind]).filter(Boolean).join(",");

// SVG sources without an intrinsic size report 0 in some browsers, so callers
// that need real pixels pass a fallback (Favicon Generator uses 512).
export function loadImage(file, fallbackSize = 0) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        img,
        url,
        name: file.name,
        size: file.size,
        width: img.naturalWidth || fallbackSize,
        height: img.naturalHeight || fallbackSize,
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error((file.name || "This image") + " could not be read."));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image could not be exported."))), type, quality)
  );
}

export function canvasToBytes(canvas, type, quality) {
  return canvasToBlob(canvas, type, quality).then((blob) => blob.arrayBuffer()).then((buf) => new Uint8Array(buf));
}

// Lets a browser tell us whether it can encode a format at all before offering
// it in the UI (Safari historically refused image/webp).
export async function canEncode(mime) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.5));
  return !!blob && blob.type === mime;
}
// PNG to JPG Converter: plain JS, no dependencies, no JSX.
// Usage: const unmount = mountPngToJpgTool(domElement);  later: unmount();

import { downloadBlob } from "../../../utils/shared/download";
import { formatBytes, withExtension } from "../../../utils/shared/format";
import { JPEG, PNG, canvasToBlob, kindOf, loadImage } from "../../../utils/shared/imageFile";
import { createZipFromBlobs } from "../../../utils/shared/zip";

const QUALITY_MIN = 10;
const QUALITY_MAX = 100;
const PREVIEW_SIZE = 240;
const RECOMPRESS_DEBOUNCE_MS = 200;

/* ---------- tiny helpers ---------- */
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => c != null && c !== false && e.append(c));
  return e;
};
const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const jpgName = (name) => withExtension(name, "jpg");
// Drop-zone glyph, matching the other tools: a 36px stroked icon in an accent span.
const dropIcon = () => {
  const span = document.createElement("span");
  span.className = "tool-drop-icon";
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/>' +
    '<path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>';
  return span;
};

/* ---------- the tool ---------- */
export function mountPngToJpgTool(root) {
  if (!root) return () => {};
  const state = { mode: "white", hex: "#FFFFFF", quality: 85, items: [] };
  let uid = 0;
  const globalFill = () => (state.mode === "white" ? "#FFFFFF" : state.mode === "black" ? "#000000" : state.hex);

  /* --- image processing --- */
  const detectAlpha = (img) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
  };

  function paint(canvas, item, maxW) {
    const s = maxW ? Math.min(1, maxW / item.w) : 1;
    canvas.width = Math.max(1, Math.round(item.w * s));
    canvas.height = Math.max(1, Math.round(item.h * s));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = item.fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(item.img, 0, 0, canvas.width, canvas.height);
  }

  const paintToJpeg = (item) => {
    const canvas = document.createElement("canvas");
    paint(canvas, item, 0);
    return canvasToBlob(canvas, JPEG, item.quality / 100);
  };

  function updateStats(item) {
    const ui = item.ui;
    if (!item.blob) {
      ui.stats.textContent = "Calculating…";
      return;
    }
    const saved = Math.round((1 - item.blob.size / item.file.size) * 100);
    const diff = (saved >= 0 ? "-" : "+") + Math.abs(saved) + "%";
    ui.stats.textContent = "";
    ui.stats.append(
      "PNG " + formatBytes(item.file.size) + " \u2192 JPG ~" + formatBytes(item.blob.size) + " ",
      h("strong", { class: saved >= 0 ? "p2j-good" : "p2j-dim" }, "(" + diff + ")")
    );
  }

  // Re-encodes after a short debounce so dragging the quality slider stays smooth.
  function refresh(item) {
    paint(item.ui.canvas, item, PREVIEW_SIZE); // instant, low-res preview
    item.blob = null;
    updateStats(item);
    clearTimeout(item.timer);
    const token = ++item.token;
    item.timer = setTimeout(async () => {
      const blob = await paintToJpeg(item);
      if (token !== item.token || !state.items.includes(item)) return;
      item.blob = blob;
      updateStats(item);
    }, RECOMPRESS_DEBOUNCE_MS);
  }

  async function ensureBlob(item) {
    if (!item.blob) item.blob = await paintToJpeg(item);
    return item.blob;
  }

  /* --- item card --- */
  function syncCard(item) {
    const ui = item.ui;
    ui.color.value = item.fill;
    ui.hex.textContent = item.fill.toUpperCase();
    ui.q.value = item.quality;
    ui.q.style.setProperty("--fill", ((item.quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100 + "%");
    ui.qVal.textContent = item.quality + "%";
    ui.fillRow.style.display = item.hasAlpha ? "" : "none";
    ui.na.style.display = item.hasAlpha ? "none" : "";
  }

  function createCard(item) {
    const ui = {};
    ui.canvas = h("canvas", { class: "p2j-thumb" });
    ui.stats = h("div", { class: "p2j-stats tool-mono" });
    ui.color = h("input", {
      type: "color", class: "tool-color", value: item.fill,
      onInput: (e) => { item.fill = e.target.value; item.custom = true; syncCard(item); refresh(item); },
    });
    ui.hex = h("code", { class: "tool-mono" });
    ui.fillRow = h("div", { class: "tool-inline" }, h("span", { class: "tool-label" }, "Background fill"), ui.color, ui.hex);
    ui.na = h("div", { class: "tool-inline" }, h("span", { class: "tool-label" }, "Background fill"), h("span", { class: "tool-muted" }, "Not needed"));
    ui.qVal = h("span", { class: "tool-value" });
    ui.q = h("input", {
      type: "range", min: QUALITY_MIN, max: QUALITY_MAX, value: item.quality,
      class: "tool-range tool-range-inline",
      onInput: (e) => { item.quality = Number(e.target.value); item.custom = true; syncCard(item); refresh(item); },
    });
    item.ui = ui;

    item.card = h("div", { class: "p2j-card" },
      h("div", { class: "tool-checker p2j-thumbwrap" }, ui.canvas),
      h("div", { class: "p2j-info" },
        h("div", { class: "p2j-title" },
          h("span", { class: "p2j-name", title: item.file.name }, item.file.name),
          h("span", { class: "tool-badge " + (item.hasAlpha ? "tool-badge-ok" : "") }, item.hasAlpha ? "Alpha detected" : "Opaque"),
          h("span", { class: "tool-muted p2j-dim" }, item.w + " \u00d7 " + item.h)),
        ui.stats, ui.fillRow, ui.na,
        h("div", { class: "tool-inline" }, h("span", { class: "tool-label" }, "Quality"), ui.q, ui.qVal),
        h("div", { class: "p2j-actions" },
          h("button", { class: "tool-btn tool-btn-small tool-btn-accent", "data-download": "true", onClick: async () => downloadBlob(await ensureBlob(item), jpgName(item.file.name)) }, "Download JPG"),
          h("button", { class: "tool-btn tool-btn-small tool-btn-ghost", onClick: () => removeItem(item) }, "Remove"))));

    syncCard(item);
    refresh(item);
    return item.card;
  }

  function removeItem(item) {
    clearTimeout(item.timer);
    URL.revokeObjectURL(item.url);
    state.items = state.items.filter((other) => other !== item);
    item.card.remove();
    renderEmpty();
  }

  /* --- adding files --- */
  async function addFiles(fileList) {
    const files = Array.from(fileList);
    const pngs = files.filter((file) => kindOf(file) === "png");
    showMessage(pngs.length < files.length ? "Skipped " + (files.length - pngs.length) + " non-PNG file(s)." : "");
    for (const file of pngs) {
      try {
        const { img, url } = await loadImage(file);
        const item = {
          id: ++uid, file, img, url,
          w: img.naturalWidth, h: img.naturalHeight,
          hasAlpha: detectAlpha(img),
          fill: globalFill(), quality: state.quality,
          custom: false, blob: null, token: 0, timer: 0,
        };
        state.items.push(item);
        queue.append(createCard(item));
      } catch (err) {
        showMessage(err.message);
      }
    }
    renderEmpty();
  }

  function showMessage(text) {
    msg.textContent = text;
    msg.hidden = !text;
  }

  function renderEmpty() {
    empty.hidden = state.items.length > 0;
    zipBtn.disabled = clearBtn.disabled = !state.items.length;
    count.textContent = state.items.length ? state.items.length + " file(s)" : "";
  }

  /* --- global settings --- */
  function applyGlobalLive() {
    state.items
      .filter((item) => !item.custom)
      .forEach((item) => {
        item.fill = globalFill();
        item.quality = state.quality;
        syncCard(item);
        refresh(item);
      });
  }

  const setMode = (mode) => {
    state.mode = mode;
    customBox.hidden = mode !== "custom";
    applyGlobalLive();
  };

  const radio = (value, label) =>
    h("label", { class: "tool-pill" },
      h("input", { type: "radio", name: "p2j-fill", value, checked: value === state.mode, onChange: () => setMode(value) }),
      h("span", {}, label));

  const picker = h("input", {
    type: "color", class: "tool-color", value: state.hex,
    onInput: (e) => { state.hex = e.target.value; hexInput.value = state.hex.toUpperCase(); applyGlobalLive(); },
  });
  const hexInput = h("input", {
    type: "text", class: "tool-input tool-input-hex", value: state.hex, maxlength: 7,
    onInput: (e) => { if (isHex(e.target.value)) { state.hex = e.target.value; picker.value = state.hex; applyGlobalLive(); } },
  });
  const customBox = h("div", { class: "tool-inline", hidden: true }, picker, hexInput);

  const qLabel = h("span", { class: "tool-value" }, state.quality + "%");
  const qSlider = h("input", {
    type: "range", min: QUALITY_MIN, max: QUALITY_MAX, value: state.quality,
    class: "tool-range tool-range-inline",
    style: "--fill:" + ((state.quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100 + "%",
    onInput: (e) => {
      state.quality = Number(e.target.value);
      qLabel.textContent = state.quality + "%";
      qSlider.style.setProperty("--fill", ((state.quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100 + "%");
      applyGlobalLive();
    },
  });

  /* --- layout --- */
  const msg = h("div", { class: "tool-alert", hidden: true, role: "status" });
  const fileInput = h("input", {
    type: "file", accept: PNG, multiple: true, hidden: true,
    onChange: (e) => { addFiles(e.target.files); e.target.value = ""; },
  });
  const drop = h("div", {
    class: "tool-drop", tabindex: 0, role: "button", "aria-label": "Add PNG images",
    onClick: () => fileInput.click(),
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } },
    onDragOver: (e) => { e.preventDefault(); drop.classList.add("is-dragging"); },
    onDragLeave: () => drop.classList.remove("is-dragging"),
    onDrop: (e) => { e.preventDefault(); drop.classList.remove("is-dragging"); addFiles(e.dataTransfer.files); },
  },
    dropIcon(),
    h("strong", {}, "Drag PNG files here or browse"),
    h("span", { class: "tool-drop-hint" }, "Batch upload supported \u00b7 processed locally in your browser"));

  const applyAll = h("button", {
    class: "tool-btn tool-btn-ghost",
    onClick: () => { state.items.forEach((item) => { item.custom = false; }); applyGlobalLive(); },
  }, "Apply to All Items");

  const left = h("section", { class: "tool-col" },
    drop, fileInput, msg,
    h("div", { class: "tool-card" },
      h("h2", { class: "tool-card-title" }, "Background replacement"),
      h("div", { class: "tool-row" },
        h("span", { class: "tool-label" }, "Transparent areas fill"),
        h("div", { class: "tool-pills" }, radio("white", "White"), radio("black", "Black"), radio("custom", "Custom hex")),
        customBox)),
    h("div", { class: "tool-card" },
      h("h2", { class: "tool-card-title" }, "JPG quality"),
      h("div", { class: "tool-inline" }, h("span", { class: "tool-label" }, "Quality"), qSlider, qLabel),
      h("p", { class: "tool-hint" }, "Optimal balance: high quality / low file size at 80\u201390%."),
      h("div", { class: "tool-actions", style: "margin-top:14px" }, applyAll)));

  const queue = h("div", { class: "p2j-queue" });
  const empty = h("div", { class: "tool-empty" }, "No files yet. Add PNG images to see a live preview here.");
  const count = h("span", { class: "tool-muted" });

  const zipBtn = h("button", { class: "tool-btn tool-btn-primary", "data-download": "true", disabled: true, onClick: async () => {
    zipBtn.disabled = true;
    const label = zipBtn.textContent;
    zipBtn.textContent = "Building ZIP…";
    try {
      const files = [];
      for (const item of state.items) {
        files.push({ name: jpgName(item.file.name), blob: await ensureBlob(item) });
      }
      downloadBlob(await createZipFromBlobs(files), "converted-jpgs.zip");
    } finally {
      zipBtn.textContent = label;
      zipBtn.disabled = !state.items.length;
    }
  } }, "Convert & Download All (.ZIP)");

  const clearBtn = h("button", {
    class: "tool-btn tool-btn-ghost", disabled: true,
    onClick: () => { state.items.slice().forEach(removeItem); showMessage(""); },
  }, "Clear Queue");

  const right = h("section", { class: "tool-col" },
    h("div", { class: "tool-card" },
      h("div", { class: "p2j-qhead" }, h("h2", { class: "tool-card-title" }, "File queue & preview"), count),
      empty, queue),
    h("div", { class: "tool-actions-column" }, zipBtn, clearBtn));

  root.append(
    h("header", { class: "tool-head" },
      h("h1", {}, "PNG to JPG Converter"),
      h("p", {}, "Convert PNG graphics and transparent assets into lightweight, high-quality JPGs.")),
    h("div", { class: "tool-grid tool-grid--sidebar" }, left, right));

  /* --- cleanup --- */
  return function unmount() {
    state.items.forEach((item) => {
      clearTimeout(item.timer);
      URL.revokeObjectURL(item.url);
    });
    state.items = [];
    root.innerHTML = "";
  };
}
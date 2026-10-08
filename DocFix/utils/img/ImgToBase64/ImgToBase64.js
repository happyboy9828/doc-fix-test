// Image to Base64 Converter: plain JS, no libraries, no JSX.
// Usage: const destroy = initImageToBase64(containerElement);
//        destroy();   // call this when the tool leaves the page
// Nothing touches `document` or `window` at import time, so it is safe to
// import from a server component.

import { downloadBlob } from "../../../utils/shared/download";
import { baseName, formatBytes } from "../../../utils/shared/format";

const SPINNER_THRESHOLD = 2 * 1024 * 1024; // show a spinner for files over 2 MB
const PREVIEW_LIMIT = 3000; // characters shown on screen (copy/download always use the full string)

const FORMATS = [
  { id: "dataurl", label: "Data URL", file: "data-url" },
  { id: "html", label: "HTML Tag", file: "html-tag" },
  { id: "css", label: "CSS Background", file: "css-background" },
  { id: "raw", label: "Raw Base64", file: "raw-base64" },
];

const svg = (d) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";

const ICONS = {
  upload: svg('<path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 .5 9H17"/><path d="M12 21v-8m0 0-3 3m3-3 3 3"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  download: svg('<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
};

/* ---------- small helpers ---------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === false || value == null) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : value);
  });
  children.flat().forEach((child) => child != null && node.append(child));
  return node;
}

function icon(name, className) {
  const span = el("span", { class: className || "itb-icon" });
  span.innerHTML = ICONS[name];
  return span;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers or non-secure contexts
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/* ---------- the tool ---------- */

export function initImageToBase64(container) {
  if (!container) return () => {};

  const state = { file: null, dataUrl: "", base64: "", format: "dataurl" };
  let loadToken = 0; // lets us ignore results from a file that was replaced or removed
  let copyTimer = 0;

  /* --- build the DOM --- */

  const fileInput = el("input", {
    type: "file",
    accept: "image/*",
    class: "tool-file-input",
    tabindex: "-1",
    "aria-label": "Choose an image file",
    onchange: (e) => handleFile(e.target.files && e.target.files[0]),
  });

  const spinner = el(
    "div",
    { class: "itb-spinner-wrap", hidden: true, role: "status" },
    el("span", { class: "itb-spinner" }),
    el("span", { text: "Encoding image…" })
  );

  const dropzone = el(
    "div",
    {
      class: "tool-drop",
      role: "button",
      tabindex: "0",
      "aria-label": "Upload an image. Drag one here, press Enter to browse, or paste from your clipboard.",
    },
    icon("upload", "tool-drop-icon"),
    el("strong", { class: "tool-drop-title", text: "Drag an image here or browse" }),
    el("p", {
      class: "tool-drop-hint",
      text: "PNG, JPG, WEBP, GIF and SVG work. Your image is encoded in your browser and never uploaded.",
    }),
    spinner
  );

  const errorEl = el("p", { class: "tool-alert", role: "alert", hidden: true });

  const thumb = el("img", { class: "tool-checker itb-thumb", alt: "" });
  const nameEl = el("p", { class: "itb-file-name" });
  const dimsEl = el("dd");
  const sizeEl = el("dd");
  const typeEl = el("dd");
  const removeBtn = el("button", { type: "button", class: "tool-btn tool-btn-small tool-btn-ghost", onclick: reset }, icon("close", "tool-btn-icon"), "Remove file");

  const card = el(
    "div",
    { class: "itb-card", hidden: true },
    thumb,
    el(
      "div",
      { class: "itb-card-body" },
      nameEl,
      el(
        "dl",
        { class: "itb-meta" },
        el("dt", { text: "Dimensions" }), dimsEl,
        el("dt", { text: "File size" }), sizeEl,
        el("dt", { text: "Type" }), typeEl
      ),
      removeBtn
    )
  );

  const tabList = el("div", { class: "itb-tabs", role: "tablist", "aria-label": "Output format" });
  const tabButtons = FORMATS.map((format) =>
    el("button", {
      type: "button",
      role: "tab",
      class: "itb-tab",
      text: format.label,
      "data-format": format.id,
      onclick: () => setFormat(format.id),
    })
  );
  tabButtons.forEach((btn) => tabList.append(btn));
  tabList.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const current = FORMATS.findIndex((f) => f.id === state.format);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (current + step + FORMATS.length) % FORMATS.length;
    setFormat(FORMATS[next].id);
    tabButtons[next].focus();
  });

  const emptyEl = el("div", { class: "tool-empty", text: "Add an image and its Base64 output will appear here." });
  const codeEl = el("pre", { class: "tool-code itb-code", tabindex: "0", role: "tabpanel", "aria-label": "Generated output", hidden: true });
  const noteEl = el("p", { class: "tool-hint", hidden: true });

  const copyIconSlot = icon("copy", "tool-btn-icon");
  const copyLabel = el("span", { text: "Copy to Clipboard", "aria-live": "polite" });
  const copyBtn = el("button", { type: "button", class: "tool-btn tool-btn-primary", disabled: true, onclick: onCopy }, copyIconSlot, copyLabel);
  const downloadBtn = el("button", { type: "button", class: "tool-btn tool-btn-ghost", "data-download": "true", disabled: true, onclick: onDownload }, icon("download", "tool-btn-icon"), "Download .txt");

  const statChars = el("dd", { text: "–" });
  const statOutput = el("dd", { text: "–" });
  const statOriginal = el("dd", { text: "–" });
  const statOverhead = el("dd", { text: "–" });

  const stats = el(
    "dl",
    { class: "itb-stats" },
    el("div", {}, el("dt", { text: "String length" }), statChars),
    el("div", {}, el("dt", { text: "Output size" }), statOutput),
    el("div", {}, el("dt", { text: "Original file" }), statOriginal),
    el("div", {}, el("dt", { text: "Base64 overhead" }), statOverhead)
  );

  container.append(
    el(
      "header",
      { class: "tool-head" },
      el("h1", { text: "Image to Base64 Converter" }),
      el("p", { text: "Convert any image file into a Base64 string for inline HTML and CSS." })
    ),
    el(
      "div",
      { class: "tool-grid" },
      el(
        "section",
        { class: "tool-col", "aria-label": "Image input" },
        el("div", { class: "tool-card" },
          el("h2", { class: "tool-card-title", text: "Your image" }),
          dropzone, fileInput, errorEl, card)
      ),
      el(
        "section",
        { class: "tool-col", "aria-label": "Base64 output" },
        el("div", { class: "tool-card" },
          el("h2", { class: "tool-card-title", text: "Output" }),
          tabList, emptyEl, codeEl, noteEl,
          el("div", { class: "tool-actions" }, copyBtn, downloadBtn),
          stats)
      )
    )
  );

  /* --- events --- */

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  ["dragenter", "dragover"].forEach((type) =>
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragging");
    })
  );
  dropzone.addEventListener("dragleave", (e) => {
    if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove("is-dragging");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragging");
    handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  // Paste an image straight from the clipboard (e.g. a screenshot)
  const onPaste = (e) => {
    const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
    const image = files.find((f) => f.type.startsWith("image/"));
    if (image) handleFile(image);
  };
  document.addEventListener("paste", onPaste);

  /* --- behaviour --- */

  function showError(message) {
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }

  function setBusy(busy) {
    spinner.hidden = !busy;
    dropzone.classList.toggle("is-busy", busy);
    dropzone.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      showError("That file isn't an image. Choose a PNG, JPG, WEBP, GIF or SVG file.");
      return;
    }
    showError("");
    const token = ++loadToken;
    if (file.size > SPINNER_THRESHOLD) setBusy(true);

    const reader = new FileReader();
    reader.onerror = () => {
      if (token !== loadToken) return;
      setBusy(false);
      showError("This file couldn't be read. Try again or choose a different image.");
    };
    reader.onload = () => {
      if (token !== loadToken) return;
      const dataUrl = String(reader.result);
      const probe = new Image();
      probe.onload = () => finish(file, dataUrl, probe.naturalWidth, probe.naturalHeight, token);
      probe.onerror = () => finish(file, dataUrl, 0, 0, token);
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function finish(file, dataUrl, width, height, token) {
    if (token !== loadToken) return;
    state.file = file;
    state.dataUrl = dataUrl;
    state.base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

    thumb.src = dataUrl;
    thumb.alt = "Preview of " + file.name;
    nameEl.textContent = file.name;
    dimsEl.textContent = width && height ? width + " × " + height + " px" : "Not available";
    sizeEl.textContent = formatBytes(file.size);
    typeEl.textContent = file.type;

    setBusy(false);
    render();
  }

  function reset() {
    loadToken += 1; // cancels any read still in progress
    state.file = null;
    state.dataUrl = "";
    state.base64 = "";
    fileInput.value = ""; // lets the same file be chosen again
    thumb.removeAttribute("src");
    setBusy(false);
    showError("");
    render();
  }

  function setFormat(id) {
    state.format = id;
    render();
  }

  function getOutput() {
    switch (state.format) {
      case "html":
        return '<img src="' + state.dataUrl + '" alt="Embedded Image" />';
      case "css":
        return 'background-image: url("' + state.dataUrl + '");';
      case "raw":
        return state.base64;
      default:
        return state.dataUrl;
    }
  }

  function render() {
    const hasFile = Boolean(state.file);

    tabButtons.forEach((btn) => {
      const selected = btn.dataset.format === state.format;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
    });

    card.hidden = !hasFile;
    emptyEl.hidden = hasFile;
    codeEl.hidden = !hasFile;
    copyBtn.disabled = !hasFile;
    downloadBtn.disabled = !hasFile;

    if (!hasFile) {
      noteEl.hidden = true;
      codeEl.textContent = "";
      [statChars, statOutput, statOriginal, statOverhead].forEach((dd) => (dd.textContent = "–"));
      return;
    }

    const text = getOutput();
    const truncated = text.length > PREVIEW_LIMIT;
    codeEl.textContent = truncated ? text.slice(0, PREVIEW_LIMIT) + "…" : text;
    noteEl.hidden = !truncated;
    if (truncated) {
      noteEl.textContent =
        "Showing the first " + PREVIEW_LIMIT.toLocaleString() + " of " + text.length.toLocaleString() +
        " characters. Copy and Download include the full string.";
    }

    const overhead = state.file.size ? Math.round((state.base64.length / state.file.size - 1) * 100) : 0;
    statChars.textContent = text.length.toLocaleString() + " chars";
    statOutput.textContent = formatBytes(text.length);
    statOriginal.textContent = formatBytes(state.file.size);
    statOverhead.textContent = "+" + overhead + "%";
  }

  function setCopyState(done, label) {
    copyBtn.classList.toggle("is-done", done);
    copyIconSlot.innerHTML = done ? ICONS.check : ICONS.copy;
    copyLabel.textContent = label;
  }

  async function onCopy() {
    if (!state.file) return;
    const ok = await copyText(getOutput());
    setCopyState(ok, ok ? "Copied!" : "Copy failed. Use Download instead.");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopyState(false, "Copy to Clipboard"), 1800);
  }

  function onDownload() {
    if (!state.file) return;
    const format = FORMATS.find((f) => f.id === state.format);
    const blob = new Blob([getOutput()], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, baseName(state.file.name) + "-" + format.file + ".txt");
  }

  render();

  /* --- cleanup --- */
  return function destroy() {
    loadToken += 1;
    clearTimeout(copyTimer);
    document.removeEventListener("paste", onPaste);
    container.replaceChildren();
  };
}
// WebP to PNG Converter: plain JS, no dependencies, no JSX.
// Usage: const unmount = mountWebpToPng(domElement);  later: unmount();

import { downloadBlob } from "../../../utils/shared/download";
import { MAX_FILES, formatBytes, withExtension } from "../../../utils/shared/format";
import { PNG, canvasToBlob, kindOf, loadImage } from "../../../utils/shared/imageFile";
import { createZipFromBlobs } from "../../../utils/shared/zip";

const pngName = (name) => withExtension(name, "png");
// Yields to the browser so a long batch keeps painting its progress list.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/* ---------- tiny helpers ---------- */
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "checked" || key === "disabled" || key === "value") node[key] = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  kids.flat().forEach((child) => child != null && node.append(child));
  return node;
}

/* ---------- the tool ---------- */
export function mountWebpToPng(root) {
  if (!root) return () => {};

  const items = [];
  const settings = { mode: "preserve", color: "#ffffff" };
  let uid = 0;
  let warnTimer = null;
  let busy = false;

  /* static shell */
  const fileInput = el("input", { type: "file", accept: "image/webp", multiple: true, hidden: true });
  const dropZone = el(
    "div",
    { class: "tool-drop", tabindex: "0", role: "button", "aria-label": "Add WebP images" },
    el("span", {
      class: "tool-drop-icon",
      html:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/>' +
        '<circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5-5L5 21"/></svg>',
    }),
    el("strong", { class: "tool-drop-title", text: "Drag WEBP files here or browse" }),
    el("span", { class: "tool-drop-hint", text: "Supports up to " + MAX_FILES + " files at once" }),
    fileInput
  );
  const warnBox = el("div", { class: "tool-alert", role: "status", hidden: true });

  const radioPreserve = el("input", { type: "radio", name: "w2p-alpha", checked: true });
  const radioSolid = el("input", { type: "radio", name: "w2p-alpha" });
  const colorInput = el("input", { type: "color", value: settings.color, class: "tool-color" });
  const colorRow = el("div", { class: "tool-inline", hidden: true }, el("span", { class: "tool-label" }, "Fill colour"), colorInput);

  const btnConvert = el("button", { class: "tool-btn tool-btn-primary", text: "Convert All Files" });
  const btnClear = el("button", { class: "tool-btn tool-btn-ghost", text: "Clear Queue" });
  const btnZip = el("button", { class: "tool-btn tool-btn-primary", text: "Download All (.ZIP)", "data-download": "true" });
  const summary = el("div", { class: "tool-mono tool-muted" });
  const list = el("div", { class: "w2p-list" });

  const left = el(
    "section",
    { class: "tool-col" },
    dropZone,
    warnBox,
    el(
      "div",
      { class: "tool-card" },
      el("h2", { class: "tool-card-title", text: "Settings & Preferences" }),
      el("div", { class: "tool-row" },
        el("span", { class: "tool-label" }, "Transparency (alpha channel)"),
        el("div", { class: "tool-pills" },
          el("label", { class: "tool-pill" }, radioPreserve, el("span", { text: "Preserve" })),
          el("label", { class: "tool-pill" }, radioSolid, el("span", { text: "Replace with solid" })))),
      el("div", { class: "tool-row" },
        el("span", { class: "tool-label" }, "Colour depth"),
        el("span", { class: "tool-chip", text: "24-bit TrueColor + Alpha" })),
      colorRow
    ),
    el("div", { class: "tool-card" },
      el("h2", { class: "tool-card-title", text: "Batch Action" }),
      el("div", { class: "tool-actions-column" }, btnConvert, btnClear))
  );

  const right = el(
    "section",
    { class: "tool-col" },
    el("div", { class: "tool-card" }, el("h2", { class: "tool-card-title", text: "Batch Queue" }), list),
    el("div", { class: "tool-card" },
      el("h2", { class: "tool-card-title", text: "Download" }),
      el("div", { class: "tool-actions-column" }, btnZip, summary))
  );

  root.append(
    el(
      "header",
      { class: "tool-head" },
      el("h1", { text: "WEBP to PNG Converter" }),
      el("p", { text: "Convert modern WebP images to broadly compatible, lossless PNG assets." })
    ),
    el("div", { class: "tool-grid tool-grid--queue" }, left, right)
  );

  /* ---------- rendering ---------- */
  function render() {
    list.textContent = "";
    if (!items.length) {
      list.append(el("div", { class: "tool-empty", text: "No files yet. Add WebP images to start." }));
    }
    items.forEach((item) => {
      const badgeText =
        item.status === "queued" ? "Queued" :
        item.status === "converting" ? "Converting..." :
        item.status === "done" ? "Completed - " + formatBytes(item.blob.size) :
        "Error: " + item.error;
      const badgeKind =
        item.status === "done" ? "tool-badge tool-badge-ok" :
        item.status === "error" ? "tool-badge tool-badge-error" : "tool-badge";

      const dl = el("button", {
        class: "tool-btn tool-btn-small tool-btn-accent",
        text: "Download PNG",
        "data-download": "true",
        disabled: item.status !== "done",
        onClick: () => downloadBlob(item.blob, pngName(item.name)),
      });
      const rm = el("button", {
        class: "tool-btn tool-btn-small tool-btn-ghost",
        text: "Remove",
        onClick: () => {
          URL.revokeObjectURL(item.url);
          items.splice(items.indexOf(item), 1);
          render();
        },
      });

      list.append(
        el(
          "div",
          { class: "w2p-item" },
          el("div", { class: "tool-checker w2p-thumb" }, el("img", { src: item.url, alt: "" })),
          el(
            "div",
            { class: "w2p-info" },
            el("div", { class: "w2p-name", text: item.name, title: item.name }),
            el("div", { class: "w2p-meta", text: (item.width ? item.width + " × " + item.height + " px" : "-") + " | " + formatBytes(item.file.size) }),
            el("div", { class: "w2p-meta", text: "Format: WEBP → PNG" }),
            el("span", { class: badgeKind, text: badgeText })
          ),
          el("div", { class: "w2p-item-actions" }, dl, rm)
        )
      );
    });

    const done = items.filter((item) => item.status === "done");
    const totalSize = done.length ? done.reduce((sum, item) => sum + item.blob.size, 0) : items.reduce((sum, item) => sum + item.file.size, 0);
    summary.textContent = "Total files: " + items.length + " | Total size: " + formatBytes(totalSize);
    btnZip.disabled = !done.length || busy;
    btnConvert.disabled = !items.length || busy;
    btnClear.disabled = !items.length || busy;
    colorRow.hidden = settings.mode !== "solid";
  }

  function warn(message) {
    warnBox.textContent = message;
    warnBox.hidden = false;
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => (warnBox.hidden = true), 6000);
  }

  /* ---------- conversion ---------- */
  async function convertItem(item) {
    item.status = "converting";
    render();
    await tick();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = item.width;
      canvas.height = item.height;
      const ctx = canvas.getContext("2d");
      if (settings.mode === "solid") {
        ctx.fillStyle = settings.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(item.img, 0, 0);
      item.blob = await canvasToBlob(canvas, PNG);
      item.status = "done";
    } catch (err) {
      item.status = "error";
      item.error = err.message;
    }
    render();
  }

  async function convertAll(queue) {
    busy = true;
    render();
    for (const item of queue) await convertItem(item);
    busy = false;
    render();
  }

  async function addFiles(fileList) {
    const added = [];
    for (const file of Array.from(fileList)) {
      if (kindOf(file) !== "webp") {
        warn("\"" + file.name + "\" rejected: not a WebP file.");
        continue;
      }
      if (items.length >= MAX_FILES) {
        warn("Limit of " + MAX_FILES + " files reached. Extra files were skipped.");
        break;
      }
      try {
        const loaded = await loadImage(file);
        const item = {
          id: ++uid,
          file,
          name: file.name,
          url: loaded.url,
          img: loaded.img,
          width: loaded.width,
          height: loaded.height,
          status: "queued",
        };
        items.push(item);
        added.push(item);
      } catch (err) {
        warn(err.message);
      }
    }
    render();
    await convertAll(added);
  }

  /* ---------- events ---------- */
  const on = (target, event, handler) => target.addEventListener(event, handler);

  on(dropZone, "click", () => fileInput.click());
  on(dropZone, "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  on(fileInput, "change", () => { addFiles(fileInput.files); fileInput.value = ""; });
  on(dropZone, "dragover", (e) => { e.preventDefault(); dropZone.classList.add("is-dragging"); });
  on(dropZone, "dragleave", () => dropZone.classList.remove("is-dragging"));
  on(dropZone, "drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-dragging");
    addFiles(e.dataTransfer.files);
  });

  on(radioPreserve, "change", () => { settings.mode = "preserve"; render(); });
  on(radioSolid, "change", () => { settings.mode = "solid"; render(); });
  on(colorInput, "input", () => { settings.color = colorInput.value; });

  on(btnConvert, "click", () => convertAll(items.slice()));
  on(btnClear, "click", () => {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    items.length = 0;
    render();
  });
  on(btnZip, "click", async () => {
    busy = true;
    render();
    const files = items.filter((item) => item.status === "done").map((item) => ({ name: pngName(item.name), blob: item.blob }));
    downloadBlob(await createZipFromBlobs(files), "webp-to-png.zip");
    busy = false;
    render();
  });

  render();

  /* cleanup */
  return function unmount() {
    clearTimeout(warnTimer);
    items.forEach((item) => URL.revokeObjectURL(item.url));
    items.length = 0;
    root.textContent = "";
  };
}
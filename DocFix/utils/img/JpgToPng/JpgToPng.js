// JPG to PNG Converter: plain JS, no dependencies, no JSX.
// Usage: const unmount = mountJpgToPng(domElement);  later: unmount();

import { downloadBlob } from "../../../utils/shared/download";
import { MAX_FILES, formatBytes, withExtension } from "../../../utils/shared/format";
import { PNG, canvasToBlob, kindOf } from "../../../utils/shared/imageFile";
import { crc32, createZipFromBlobs, deflate } from "../../../utils/shared/zip";

let uid = 0;

const pngName = (file) => withExtension(file.name, "png");
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

/* ---------- shell markup ---------- */
// Kept as one template so the layout stays readable; MAX_FILES is interpolated
// so the copy can never drift from the enforced limit. Every class comes from
// app/tool.css so this route matches the rest of the tools.
const shell = (gid) => `
    <header class="tool-head">
      <h1>JPG to PNG Converter</h1>
      <p>Convert compressed JPEG images to high-quality, lossless PNG format instantly.</p>
    </header>
    <div class="tool-grid tool-grid--stack">
      <div class="tool-col">
        <div class="tool-alert" role="alert" hidden></div>
        <label class="tool-drop" tabindex="0">
          <span class="tool-drop-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5-5L5 21"/></svg>
          </span>
          <strong>Drag & drop JPG / JPEG files here or click to browse</strong>
          <span class="tool-drop-hint">Supports single file or batch processing (up to ${MAX_FILES} files at once)</span>
          <input type="file" accept="image/jpeg" multiple hidden />
        </label>
        <section class="tool-card" hidden>
          <div class="j2p-queue-head"><h2 class="tool-card-title">Conversion queue</h2><span class="tool-muted j2p-count"></span></div>
          <ul class="j2p-list"></ul>
        </section>
        <section class="tool-card">
          <h2 class="tool-card-title">Global settings</h2>
          <div class="tool-row">
            <span class="tool-label">Color palette</span>
            <div class="tool-pills">
              <label class="tool-pill"><input type="radio" name="depth-${gid}" value="24" checked /><span>Full 24-bit TrueColor</span></label>
              <label class="tool-pill"><input type="radio" name="depth-${gid}" value="8" /><span>8-bit Indexed Color</span></label>
            </div>
          </div>
          <div class="tool-row">
            <span class="tool-label">Background fill</span>
            <div class="tool-pills">
              <label class="tool-pill"><input type="radio" name="bg-${gid}" value="white" checked /><span>White (keep as is)</span></label>
              <label class="tool-pill"><input type="radio" name="bg-${gid}" value="transparent" /><span>Transparent (clear white edges)</span></label>
            </div>
          </div>
          <div class="tool-row j2p-tol" hidden>
            <span class="tool-label">White tolerance</span>
            <input class="tool-range tool-range-inline" type="range" min="0" max="60" value="20" aria-label="White tolerance" style="--fill: 33.333%" />
            <output class="tool-mono">20</output>
          </div>
        </section>
        <div class="tool-actions">
          <button type="button" class="tool-btn tool-btn-primary" data-act="convert">Convert All to PNG</button>
          <button type="button" class="tool-btn tool-btn-ghost" data-act="clear">Clear Queue</button>
          <button type="button" class="tool-btn tool-btn-ghost" data-act="zip" data-download hidden>Download All (.ZIP)</button>
          <button type="button" class="tool-btn tool-btn-ghost" data-act="sel" data-download hidden>Download Selected</button>
        </div>
      </div>
    </div>`;

/* ---------- 8-bit indexed PNG encoder ---------- */
function chunk(type, data) {
  const b = new Uint8Array(12 + data.length);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
  b.set(data, 8);
  dv.setUint32(8 + data.length, crc32(b.subarray(4, 8 + data.length)));
  return b;
}

// Median-cut colour quantiser. Returns [[r,g,b], ...] with at most n colours.
function quantize(px, n) {
  const hist = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const k = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const first = [];
  hist.forEach((c, k) => first.push({ r: ((k >> 10) << 3) | 4, g: (((k >> 5) & 31) << 3) | 4, b: ((k & 31) << 3) | 4, c }));
  const boxes = [first];
  while (boxes.length < n) {
    let bi = -1;
    let best = 0;
    let ch = "r";
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (const k of ["r", "g", "b"]) {
        let lo = 255;
        let hi = 0;
        for (const p of bx) {
          if (p[k] < lo) lo = p[k];
          if (p[k] > hi) hi = p[k];
        }
        if (hi - lo > best) {
          best = hi - lo;
          bi = i;
          ch = k;
        }
      }
    });
    if (bi < 0) break;
    const bx = boxes[bi].sort((a, b) => a[ch] - b[ch]);
    const half = bx.reduce((s, p) => s + p.c, 0) / 2;
    let acc = 0;
    let cut = 0;
    while (cut < bx.length - 1 && (acc += bx[cut].c) < half) cut++;
    cut = Math.min(Math.max(cut + 1, 1), bx.length - 1);
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  return boxes
    .filter((bx) => bx.length)
    .map((bx) => {
      let t = 0, r = 0, g = 0, b = 0;
      for (const p of bx) {
        t += p.c;
        r += p.r * p.c;
        g += p.g * p.c;
        b += p.b * p.c;
      }
      return [Math.round(r / t), Math.round(g / t), Math.round(b / t)];
    });
}

async function encodeIndexed(imageData) {
  const { width: w, height: h, data: px } = imageData;
  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 128) {
      hasAlpha = true;
      break;
    }
  }
  const off = hasAlpha ? 1 : 0;
  const pal = quantize(px, 256 - off);
  const cache = new Map();
  const nearest = (r, g, b) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = cache.get(k);
    if (v !== undefined) return v;
    let bd = Infinity;
    v = 0;
    for (let i = 0; i < pal.length; i++) {
      const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2;
      if (d < bd) {
        bd = d;
        v = i;
      }
    }
    v += off;
    cache.set(k, v);
    return v;
  };
  const raw = new Uint8Array((w + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[y * (w + 1) + 1 + x] = px[i + 3] < 128 ? 0 : nearest(px[i], px[i + 1], px[i + 2]);
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = new Uint8Array((pal.length + off) * 3);
  pal.forEach((c, i) => plte.set(c, (i + off) * 3));
  const out = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
  ];
  if (hasAlpha) out.push(chunk("tRNS", new Uint8Array([0])));
  out.push(chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array(0)));
  return new Blob(out, { type: PNG });
}

/* ---------- Conversion ---------- */
// Makes near-white pixels connected to the image edge transparent (removes white padding).
function clearEdgeBackground(id, tol) {
  const { width: w, height: h, data: d } = id;
  const t = 255 - tol;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (p) => {
    if (!seen[p] && d[p * 4] >= t && d[p * 4 + 1] >= t && d[p * 4 + 2] >= t) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    d[p * 4 + 3] = 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
}

// options: { depth: "24" | "8", bg: "white" | "transparent", tol: number }
async function convert(file, o) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();
  let image = null;
  if (o.bg === "transparent") {
    image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    clearEdgeBackground(image, o.tol);
    ctx.putImageData(image, 0, 0);
  }
  if (o.depth === "8") {
    image = image || ctx.getImageData(0, 0, canvas.width, canvas.height);
    return encodeIndexed(image);
  }
  return canvasToBlob(canvas, PNG);
}

/* ---------- UI ---------- */
export function mountJpgToPng(root) {
  if (!root) return () => {};
  const gid = ++uid;
  let items = [];
  let busy = false;
  let dead = false;
  let errTimer = null;

  root.innerHTML = shell(gid);

  const $ = (selector) => root.querySelector(selector);
  const drop = $(".tool-drop");
  const input = $(".tool-drop input");
  const errBox = $(".tool-alert");
  const queue = $(".j2p-list").closest("section");
  const list = $(".j2p-list");
  const btn = (action) => $(`[data-act="${action}"]`);
  const depth = () => $(`input[name="depth-${gid}"]:checked`).value;
  const bg = () => $(`input[name="bg-${gid}"]:checked`).value;
  const tolInput = $(".j2p-tol input");
  const opts = () => ({ depth: depth(), bg: bg(), tol: Number(tolInput.value) });

  const showError = (msg) => {
    errBox.textContent = msg;
    errBox.hidden = false;
    clearTimeout(errTimer);
    errTimer = setTimeout(() => (errBox.hidden = true), 6000);
  };

  // Duplicate output names are disambiguated inside createZipFromBlobs.
  // `busy` keeps one click to exactly one download: building the ZIP
  // is async, so a second click would otherwise queue a second build
  // and a second file.
  const zipOf = async (queue, trigger) => {
    if (busy || !queue.length) return;
    busy = true;
    updateBar();
    const label = trigger ? trigger.textContent : "";
    if (trigger) trigger.textContent = "Building ZIP…";
    try {
      downloadBlob(
        await createZipFromBlobs(queue.map((item) => ({ name: pngName(item.file), blob: item.blob }))),
        "jpg-to-png.zip"
      );
    } finally {
      if (trigger) trigger.textContent = label;
      busy = false;
      updateBar();
    }
  };

  const updateBar = () => {
    const done = items.filter((i) => i.status === "done");
    const selected = done.filter((i) => i.selected);
    btn("convert").disabled = busy || !items.length || done.length === items.length;
    btn("clear").disabled = busy || !items.length;
    btn("zip").hidden = btn("sel").hidden = !done.length;
    btn("zip").disabled = busy;
    btn("sel").disabled = busy || !selected.length;
    $(".j2p-count").textContent = `${items.length} file${items.length === 1 ? "" : "s"} · ${done.length} converted`;
  };

  const render = () => {
    queue.hidden = !items.length;
    list.textContent = "";
    const label = depth() === "8" ? "8-bit indexed" : "Lossless";
    items.forEach((it) => {
      const li = el("li", "j2p-item j2p-" + it.status);
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = it.selected;
      cb.disabled = it.status !== "done";
      cb.setAttribute("aria-label", "Select " + it.file.name);
      cb.onchange = () => {
        it.selected = cb.checked;
        updateBar();
      };
      const img = el("img", "tool-checker j2p-thumb");
      img.src = it.url;
      img.alt = "";
      const info = el("div", "j2p-info");
      info.append(
        el("strong", "j2p-name", it.file.name),
        el("span", "tool-mono j2p-meta", `${it.w ? it.w + " × " + it.h + " px" : "…"} | ${formatBytes(it.file.size)}`)
      );
      const out = el("span", "j2p-out", it.status === "done" ? `PNG · ${formatBytes(it.blob.size)}` : `→ PNG (${label})`);
      const badge = el("span", "j2p-badge tool-badge" + (it.status === "done" ? " tool-badge-ok" : it.status === "error" ? " tool-badge-error" : ""), { idle: "Ready to convert", processing: "Converting…", done: "✓ Done", error: "Failed" }[it.status]);
      const dl = el("button", "tool-btn tool-btn-small tool-btn-accent", "↓");
      dl.type = "button";
      dl.title = "Download PNG";
      dl.setAttribute("aria-label", "Download " + it.file.name);
      dl.setAttribute("data-download", "true");
      dl.hidden = it.status !== "done";
      dl.onclick = () => downloadBlob(it.blob, pngName(it.file));
      const rm = el("button", "tool-btn tool-btn-small tool-btn-ghost", "×");
      rm.type = "button";
      rm.title = "Remove";
      rm.setAttribute("aria-label", "Remove " + it.file.name);
      rm.disabled = it.status === "processing";
      rm.onclick = () => {
        URL.revokeObjectURL(it.url);
        items = items.filter((x) => x !== it);
        render();
      };
      li.append(cb, img, info, out, badge, dl, rm);
      if (it.status === "processing") li.append(el("div", "j2p-progress"));
      list.appendChild(li);
    });
    updateBar();
  };

  const addFiles = (fileList) => {
    const all = Array.from(fileList);
    const valid = all.filter((file) => kindOf(file) === "jpg");
    const messages = [];
    if (valid.length < all.length) {
      messages.push(`${all.length - valid.length} file(s) skipped. Only JPG and JPEG files are supported.`);
    }
    const room = MAX_FILES - items.length;
    if (valid.length > room) {
      messages.push(`The limit is ${MAX_FILES} files. ${valid.length - room} file(s) were not added.`);
    }
    valid.slice(0, Math.max(room, 0)).forEach((file) => {
      const it = { file, url: URL.createObjectURL(file), status: "idle", selected: false, w: 0, h: 0, blob: null };
      items.push(it);
      const img = new Image();
      img.onload = () => {
        it.w = img.naturalWidth;
        it.h = img.naturalHeight;
        if (!dead) render();
      };
      img.src = it.url;
    });
    if (messages.length) showError(messages.join(" "));
    render();
  };

  const convertAll = async () => {
    if (busy) return;
    busy = true;
    const o = opts();
    for (const it of items) {
      if (it.status === "done") continue;
      it.status = "processing";
      render();
      await new Promise((r) => setTimeout(r, 30));
      try {
        it.blob = await convert(it.file, o);
        it.status = "done";
        it.selected = true;
      } catch {
        it.status = "error";
      }
      if (dead) return;
    }
    busy = false;
    render();
  };

  /* events */
  const onDragOver = (e) => {
    e.preventDefault();
    drop.classList.add("is-dragging");
  };
  const onDragLeave = () => drop.classList.remove("is-dragging");
  const onDrop = (e) => {
    e.preventDefault();
    drop.classList.remove("is-dragging");
    addFiles(e.dataTransfer.files);
  };
  drop.addEventListener("dragover", onDragOver);
  drop.addEventEventListener("dragleave", onDragLeave);
  drop.addEventListener("drop", onDrop);
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });

  const settings = $(".j2p-tol").closest("section");
  const onSettingsChange = () => {
    $(".j2p-tol").hidden = bg() !== "transparent";
    tolInput.nextElementSibling.textContent = tolInput.value;
    tolInput.style.setProperty("--fill", `${(Number(tolInput.value) / Number(tolInput.max)) * 100}%`);
    if (busy) return;
    items.forEach((it) => {
      // Settings changed, so anything already converted is now stale.
      if (it.status === "done" || it.status === "error") {
        it.status = "idle";
        it.blob = null;
      }
    });
    render();
  };
  settings.addEventListener("change", onSettingsChange);
  tolInput.addEventListener("input", onSettingsChange);
  btn("convert").onclick = convertAll;
  btn("clear").onclick = () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    items = [];
    render();
  };
  btn("zip").onclick = () => zipOf(items.filter((i) => i.status === "done"), btn("zip"));
  btn("sel").onclick = () => {
    const selected = items.filter((i) => i.status === "done" && i.selected);
    if (selected.length === 1) downloadBlob(selected[0].blob, pngName(selected[0].file));
    else if (selected.length) zipOf(selected, btn("sel"));
  };

  render();

  return function unmount() {
    dead = true;
    clearTimeout(errTimer);
    items.forEach((it) => URL.revokeObjectURL(it.url));
    items = [];
    root.innerHTML = "";
  };
}
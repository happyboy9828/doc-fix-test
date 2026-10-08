"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../../utils/shared/download";
import { clamp, formatBytes, savingsPercent } from "../../../utils/shared/format";
import { ACCEPT_ATTR, WEBP, canEncode, isAcceptedFile } from "../../../utils/shared/imageFile";
import { createZipFromBlobs } from "../../../utils/shared/zip";
import { ACCEPTED_KINDS, compressItem, loadItem } from "../../../utils/img/ImgCompresser/ImgCompresser";
import "../../../utils/img/ImgCompresser/ImgCompresser.css";

const QUALITY_MIN = 5;
const QUALITY_MAX = 100;
const RECOMPRESS_DEBOUNCE_MS = 250;
const MODES = [{ v: "balanced", l: "Balanced" }, { v: "maximum", l: "Maximum" }];
const FORMATS = [
  { v: "original", l: "Keep original" },
  { v: "webp", l: "WebP" },
  { v: "jpg", l: "JPG" },
];
const ZOOMS = [{ v: "fit", l: "Fit" }, { v: 1, l: "100%" }, { v: 2, l: "200%" }];

let nextId = 1;

function Pane({ item, url, zoom, pan, onPan, children }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [box, setBox] = useState({ w: 300, h: 300 });

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const measure = () => setBox({ w: element.clientWidth, h: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = zoom === "fit" ? Math.min(box.w / item.width, box.h / item.height) : zoom;
  const imageWidth = item.width * scale;
  const imageHeight = item.height * scale;
  const maxX = Math.max(0, (imageWidth - box.w) / 2);
  const maxY = Math.max(0, (imageHeight - box.h) / 2);
  const offsetX = clamp(pan.x, -maxX, maxX);
  const offsetY = clamp(pan.y, -maxY, maxY);
  const canPan = maxX > 0 || maxY > 0;

  return (
    <div
      ref={ref}
      className={`ci-pane tool-checker${canPan ? " can-pan" : ""}`}
      style={{ touchAction: canPan ? "none" : "auto" }}
      onPointerDown={(event) => {
        if (!canPan) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, offsetX, offsetY };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start) onPan({ x: start.offsetX + event.clientX - start.x, y: start.offsetY + event.clientY - start.y });
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: imageWidth, height: imageHeight, maxWidth: "none",
            transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
            imageRendering: scale >= 2 ? "pixelated" : "auto",
          }}
        />
      )}
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="tool-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.v}
          type="button"
          disabled={option.disabled}
          className={`tool-seg-btn${value === option.v ? " is-active" : ""}`}
          aria-pressed={value === option.v}
          onClick={() => onChange(option.v)}
        >
          {option.l}
        </button>
      ))}
    </div>
  );
}

export default function CompressImagePage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("balanced");
  const [quality, setQuality] = useState(80);
  const [maxKB, setMaxKB] = useState("");
  const [format, setFormat] = useState("original");
  const [webpOk, setWebpOk] = useState(true);
  const [zoom, setZoom] = useState("fit");
  const [panState, setPanState] = useState({ view: "fit|null", pan: { x: 0, y: 0 } });
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [busyZip, setBusyZip] = useState(false);
  const [toast, setToast] = useState("");

  const fileInput = useRef(null);
  const toastTimer = useRef(null);
  const itemsRef = useRef(items);
  const tokens = useRef({});

  useEffect(() => { itemsRef.current = items; }, [items]);

  const limitKB = Number(maxKB) > 0 ? Number(maxKB) : 0;
  const settings = { quality, format, maxKB: limitKB };
  const key = `${quality}|${format}|${limitKB}`;
  const selected = items.find((item) => item.id === selectedId) || null;
  const result = selected && selected.result;

  const view = `${zoom}|${selectedId}`;
  if (panState.view !== view) setPanState({ view, pan: { x: 0, y: 0 } });
  const pan = panState.pan;

  const setPan = (nextPan) => setPanState((prev) => ({ ...prev, pan: nextPan }));

  useEffect(() => { canEncode(WEBP).then(setWebpOk); }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }

  const patch = (id, changes) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  async function runOne(id, runKey, runSettings) {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item) return null;
    const token = (tokens.current[id] = (tokens.current[id] || 0) + 1);
    patch(id, { status: "working" });
    try {
      const compressed = await compressItem(item, runSettings);
      if (tokens.current[id] !== token) {
        URL.revokeObjectURL(compressed.url);
        return null;
      }
      if (item.result) URL.revokeObjectURL(item.result.url);
      patch(id, { result: compressed, key: runKey, status: "done", error: "" });
      return compressed;
    } catch (err) {
      if (tokens.current[id] === token) patch(id, { status: "error", error: err.message || "Compression failed." });
      return null;
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    const item = itemsRef.current.find((entry) => entry.id === selectedId);
    if (!item || (item.result && item.key === key)) return;
    const timer = setTimeout(() => runOne(selectedId, key, settings), RECOMPRESS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, selectedId]);

  async function addFiles(fileList) {
    const files = Array.from(fileList);
    const good = files.filter((file) => isAcceptedFile(file, ACCEPTED_KINDS));
    if (good.length < files.length) showToast("Some files were skipped. Only PNG, JPG, WEBP and SVG work here.");
    const loaded = [];
    for (const file of good) {
      try {
        loaded.push({
          ...(await loadItem(file)),
          id: nextId++,
          status: "queued",
          result: null,
          key: null,
          error: "",
        });
      } catch (err) {
        showToast(err.message);
      }
    }
    if (!loaded.length) return;
    setItems((list) => list.concat(loaded));
    if (!selectedId) setSelectedId(loaded[0].id);
  }

  function removeItem(id) {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      if (item.result) URL.revokeObjectURL(item.result.url);
    }
    tokens.current[id] = (tokens.current[id] || 0) + 1;
    const rest = itemsRef.current.filter((entry) => entry.id !== id);
    setItems(rest);
    if (selectedId === id) setSelectedId(rest.length ? rest[0].id : null);
  }

  function chooseMode(next) {
    setMode(next);
    setQuality(next === "balanced" ? 80 : 55);
  }

  async function compressAll() {
    const todo = itemsRef.current.filter((item) => !(item.result && item.key === key));
    if (!todo.length) {
      showToast("Everything is already compressed with these settings.");
      return;
    }
    setProgress({ done: 0, total: todo.length });
    for (let n = 0; n < todo.length; n++) {
      await runOne(todo[n].id, key, settings);
      setProgress({ done: n + 1, total: todo.length });
    }
    setTimeout(() => setProgress(null), 900);
  }

  async function downloadZip() {
    if (!items.length) return;
    setBusyZip(true);
    try {
      const files = [];
      for (const item of itemsRef.current) {
        let compressed = item.result && item.key === key ? item.result : await runOne(item.id, key, settings);
        if (!compressed) compressed = (itemsRef.current.find((entry) => entry.id === item.id) || {}).result;
        if (compressed) files.push({ name: compressed.name, blob: compressed.blob });
      }
      if (!files.length) throw new Error("Nothing to download yet.");
      downloadBlob(await createZipFromBlobs(files), "compressed-images.zip");
    } catch (err) {
      showToast(err.message);
    }
    setBusyZip(false);
  }

  function downloadOne() {
    if (result) downloadBlob(result.blob, result.name);
  }

  function onPickFiles(event) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  const doneItems = items.filter((item) => item.result);
  const totalOrigDone = doneItems.reduce((sum, item) => sum + item.size, 0);
  const totalNew = doneItems.reduce((sum, item) => sum + item.result.size, 0);

  const metric = result
    ? `${formatBytes(selected.size)} \u2794 ${formatBytes(result.size)} (${result.size > selected.size ? "+" : ""}${savingsPercent(selected.size, result.size)}%)`
    : selected
    ? selected.status === "working" ? "Calculating..." : "Waiting..."
    : "Add an image to see the estimate";

  const sub = (text, good) => <span className={`tool-mono ci-sub${good ? " ci-good" : ""}`}>{text}</span>;

  return (
    <div className="tool-page">
      <header className="tool-head">
        <h1>Compress Image</h1>
        <p>Shrink photo file sizes up to 80% without losing visual quality.</p>
      </header>

      <div className="tool-grid tool-grid--queue">
        <div className="tool-col">
          <div
            className={`tool-drop${dragging ? " is-dragging" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInput.current.click();
              }
            }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept={ACCEPT_ATTR(ACCEPTED_KINDS)}
              onChange={onPickFiles}
            />
            <span className="tool-drop-icon">
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
              </svg>
            </span>
            <strong>Drag images here or browse</strong>
            <span className="tool-drop-hint">Supports PNG, JPG, WEBP, SVG. Add as many as you like.</span>
          </div>

          <section className="tool-card">
            <h2 className="tool-card-title">Global compression level</h2>
            <div className="tool-row">
              <span className="tool-label">Mode</span>
              <Segmented label="Mode" value={mode} onChange={chooseMode} options={MODES} />
            </div>
            <div className="tool-field">
              <label className="tool-label tool-label-between" htmlFor="ci-quality">
                <span>
                  Quality <span className="tool-value">{quality}%</span>
                </span>
              </label>
              <input
                id="ci-quality"
                type="range"
                min={QUALITY_MIN}
                max={QUALITY_MAX}
                value={quality}
                className="tool-range"
                style={{ "--fill": `${((quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100}%` }}
                onChange={(event) => setQuality(Number(event.target.value))}
              />
            </div>
            <div className="ci-metric" aria-live="polite">
              <span className="tool-muted">{selected ? selected.name : "Estimated size"}</span>
              <span className={`tool-mono ci-metric-value${selected && selected.status === "working" ? " is-busy" : ""}`}>{metric}</span>
            </div>
            <div className="tool-row">
              <label className="tool-label" htmlFor="ci-max">Max file size limit</label>
              <span className="tool-inline">
                <input
                  id="ci-max"
                  type="number"
                  min={1}
                  placeholder="500"
                  value={maxKB}
                  className="tool-input tool-input-num"
                  onChange={(event) => setMaxKB(event.target.value)}
                />
                <span className="tool-muted">KB</span>
              </span>
            </div>
            <div className="tool-row">
              <span className="tool-label">Output format</span>
              <Segmented
                label="Output format"
                value={format}
                onChange={setFormat}
                options={FORMATS.map((option) => (option.v === "webp" ? { ...option, disabled: !webpOk } : option))}
              />
            </div>
            <p className="tool-hint">
              Leave the limit empty to use the quality slider only. PNG files shrink most when converted to
              WebP. Transparent areas turn white in JPG.
            </p>
            <div className="ci-actions">
              <button
                type="button"
                className="tool-btn tool-btn-primary"
                disabled={!items.length || !!progress}
                onClick={compressAll}
              >
                {progress ? `Compressing ${progress.done} of ${progress.total}...` : "Compress all images"}
              </button>
              {progress && (
                <div
                  className="tool-progress"
                  role="progressbar"
                  aria-valuenow={progress.done}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                >
                  <div className="tool-progress-bar" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="tool-col">
          <section className="tool-card">
            <h2 className="tool-card-title">Before vs after</h2>
            {selected ? (
              <div className="ci-compare">
                <div className="ci-side">
                  <div className="ci-side-head">
                    <strong>Original</strong>
                    <span className="tool-mono ci-size">{formatBytes(selected.size)}</span>
                    {sub("(100% quality)")}
                  </div>
                  <Pane item={selected} url={selected.url} zoom={zoom} pan={pan} onPan={setPan} />
                </div>
                <div className="ci-side">
                  <div className="ci-side-head">
                    <strong>Compressed</strong>
                    <span className="tool-mono ci-size">{result ? formatBytes(result.size) : "--"}</span>
                    {result
                      ? sub(
                          `(${result.size > selected.size ? "+" : "-"}${Math.abs(savingsPercent(selected.size, result.size))}% size)`,
                          result.size < selected.size
                        )
                      : sub("(working)")}
                  </div>
                  <Pane item={selected} url={result && result.url} zoom={zoom} pan={pan} onPan={setPan}>
                    {(!result || selected.status === "working") && (
                      <div className="ci-busy">{selected.status === "error" ? selected.error : "Compressing..."}</div>
                    )}
                  </Pane>
                </div>
              </div>
            ) : (
              <p className="tool-empty">Add an image to compare it with its compressed version.</p>
            )}
            {selected && (
              <p className="tool-hint">
                {zoom === "fit"
                  ? "Pick 100% or 200%, then drag an image to inspect details. Both sides move together."
                  : "Drag either image to pan. Both sides move together."}
              </p>
            )}
            <div className="ci-zoom">
              <span className="tool-label">Zoom inspector</span>
              <Segmented label="Zoom" value={zoom} onChange={setZoom} options={ZOOMS} />
            </div>
            {result && result.note && <p className="tool-note">{result.note}</p>}
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">Queue items{items.length ? ` (${items.length})` : ""}</h2>
            {items.length ? (
              <ul className="ci-queue">
                {items.map((item) => (
                  <li key={item.id} className={`ci-qitem${item.id === selectedId ? " is-selected" : ""}`}>
                    <button type="button" className="ci-qbtn" onClick={() => setSelectedId(item.id)}>
                      <span className="ci-qname">{item.name}</span>
                      <span className="tool-mono ci-qsize">
                        {formatBytes(item.size)}
                        {item.result && (
                          <>
                            {" \u2192 "}
                            <span className={item.result.size < item.size ? "ci-good" : ""}>
                              {formatBytes(item.result.size)}
                            </span>
                          </>
                        )}
                        {item.status === "working"
                          ? " ..."
                          : item.status === "error"
                            ? " failed"
                            : item.result && item.key !== key
                              ? " (old settings)"
                              : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ci-x"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      {"\u00d7"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tool-empty">No images yet.</p>
            )}
            {doneItems.length > 1 && (
              <p className="ci-total tool-mono">
                Total: {formatBytes(totalOrigDone)} \u2794 {formatBytes(totalNew)} (-{Math.max(0, savingsPercent(totalOrigDone, totalNew))}%)
              </p>
            )}
          </section>

          <div className="tool-actions-column">
            <button
              type="button"
              className="tool-btn tool-btn-primary"
              data-download="true"
              disabled={!items.length || busyZip || !!progress}
              onClick={downloadZip}
            >
              {busyZip ? "Building ZIP..." : "Download compressed (.zip)"}
            </button>
            <button type="button" className="tool-btn tool-btn-ghost" data-download="true" disabled={!result} onClick={downloadOne}>
              Download selected image
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="tool-toast" role="status">{toast}</div>}
    </div>
  );
}
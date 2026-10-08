"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../../utils/shared/download";
import { clamp } from "../../../utils/shared/format";
import { ACCEPT_ATTR, WEBP, canEncode, isAcceptedFile, loadImage } from "../../../utils/shared/imageFile";
import {
  ACCEPTED_KINDS,
  MAX_DIM,
  PRESETS,
  createSession,
  exportBlob,
  fitRatioRect,
  moveCrop,
  resizeCrop,
  simplifyRatio,
  transformCanvas,
  transformCrop,
} from "../../../utils/img/ImageResizer/ImageResizer";
import "../../../utils/img/ImageResizer/ImageResizer.css";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const GRIDS = [{ v: "off", l: "Off" }, { v: "thirds", l: "Thirds" }, { v: "grid", l: "Grid" }, { v: "center", l: "Center" }];
const GRID_LINES = { thirds: [100 / 3, 200 / 3], grid: [25, 50, 75], center: [50], off: [] };

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="tool-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.v)}
          type="button"
          disabled={option.disabled}
          className={"tool-seg-btn" + (value === option.v ? " is-active" : "")}
          aria-pressed={value === option.v}
          onClick={() => onChange(option.v)}
        >
          {option.l}
        </button>
      ))}
    </div>
  );
}

export default function ImageResizerPage() {
  const [work, setWork] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [ratio, setRatio] = useState(null);
  const [target, setTarget] = useState(null);
  const [lock, setLock] = useState(true);
  const [unit, setUnit] = useState("px");
  const [dpi, setDpi] = useState(300);
  const [draft, setDraft] = useState(null);
  const [grid, setGrid] = useState("thirds");
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(92);
  const [webpOk, setWebpOk] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const previewRef = useRef(null);
  const stageRef = useRef(null);
  const fileInput = useRef(null);
  const drag = useRef(null);
  const toastTimer = useRef(null);
  const photoUrl = useRef(null);

  useEffect(() => { canEncode(WEBP).then(setWebpOk); }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => () => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); }, []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }

  useEffect(() => {
    if (!work || !previewRef.current) return;
    const k = Math.min(1, 1400 / Math.max(work.W, work.H));
    const c = previewRef.current;
    c.width = Math.max(1, Math.round(work.W * k));
    c.height = Math.max(1, Math.round(work.H * k));
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(work.canvas, 0, 0, c.width, c.height);
  }, [work]);

  async function handleFile(file) {
    if (!isAcceptedFile(file, ACCEPTED_KINDS)) { showToast("Only PNG, JPG, WEBP and SVG images work here."); return; }
    try {
      const loaded = await loadImage(file);
      const session = createSession(loaded);
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
      photoUrl.current = loaded.url;
      setWork(session);
      setCrop({ x: 0, y: 0, w: session.W, h: session.H });
      setRatio(null);
      setTarget(null);
      setDraft(null);
      if (loaded.width > MAX_DIM || loaded.height > MAX_DIM) {
        showToast("This image is larger than " + MAX_DIM + " px, so it was scaled down to fit.");
      }
    } catch (err) { showToast(err.message); }
  }

  const cw = Math.max(1, Math.round(crop.w));
  const ch = Math.max(1, Math.round(crop.h));
  let eff = { w: cw, h: ch };
  if (target) {
    eff = lock
      ? { w: target.w, h: Math.max(1, Math.round((target.w * crop.h) / crop.w)) }
      : { w: target.w, h: target.h };
  }
  eff = { w: clamp(eff.w, 1, MAX_DIM), h: clamp(eff.h, 1, MAX_DIM) };

  const axisBase = (axis) => (axis === "w" ? cw : ch);
  const toUnit = (px, axis) => (unit === "px" ? px : unit === "%" ? (px / axisBase(axis)) * 100 : px / dpi);
  const fromUnit = (v, axis) => (unit === "px" ? v : unit === "%" ? (v / 100) * axisBase(axis) : v * dpi);
  const fmt = (v) => (unit === "px" ? String(Math.round(v)) : unit === "%" ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100));

  function onDim(axis, text) {
    setDraft({ axis, text });
    const v = parseFloat(text);
    if (!(v > 0)) return;
    const px = clamp(Math.round(fromUnit(v, axis)), 1, MAX_DIM);
    if (axis === "w") {
      setTarget(lock ? { w: px, h: Math.round((px * crop.h) / crop.w) } : { w: px, h: eff.h });
    } else {
      setTarget(lock ? { w: Math.round((px * crop.w) / crop.h), h: px } : { w: eff.w, h: px });
    }
  }

  function choosePreset(value) {
    setRatio(value);
    setTarget(null);
    setDraft(null);
    if (value && work) setCrop(fitRatioRect(value, work.W, work.H, crop.x + crop.w / 2, crop.y + crop.h / 2));
  }

  function transform(op) {
    if (!work) return;
    const canvas = transformCanvas(work.canvas, op);
    setCrop(transformCrop(crop, work.W, work.H, op));
    setWork(Object.assign({}, work, { canvas, W: canvas.width, H: canvas.height }));
    if (op === "rotate") {
      if (ratio) setRatio(1 / ratio);
      if (target) setTarget({ w: target.h, h: target.w });
    }
  }

  function resetCrop() {
    if (!work) return;
    setCrop({ x: 0, y: 0, w: work.W, h: work.H });
    setRatio(null);
    setTarget(null);
    setDraft(null);
  }

  function imagePoint(e) {
    const r = stageRef.current.getBoundingClientRect();
    const k = work.W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  }
  function onDown(e) {
    const handle = e.target.getAttribute("data-handle") || "move";
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = imagePoint(e);
    const refX = handle.includes("w") ? crop.x : handle.includes("e") ? crop.x + crop.w : p.x;
    const refY = handle.includes("n") ? crop.y : handle.includes("s") ? crop.y + crop.h : p.y;
    drag.current = { handle, start: Object.assign({}, crop), gx: p.x, gy: p.y, ox: p.x - refX, oy: p.y - refY };
  }
  function onMove(e) {
    const d = drag.current;
    if (!d) return;
    const p = imagePoint(e);
    if (d.handle === "move") {
      setCrop(moveCrop(d.start, p.x - d.gx, p.y - d.gy, work.W, work.H));
    } else {
      setCrop(resizeCrop(d.handle, d.start, p.x - d.ox, p.y - d.oy, work.W, work.H, ratio, 8));
    }
    setDraft(null);
  }
  function onUp() { drag.current = null; }
  function onKey(e) {
    const step = e.shiftKey ? 10 : 1;
    const dir = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!dir) return;
    e.preventDefault();
    setCrop(moveCrop(crop, dir[0], dir[1], work.W, work.H));
  }

  async function download() {
    if (!work) return;
    setBusy(true);
    try {
      const blob = await exportBlob(work.canvas, crop, eff.w, eff.h, format, quality);
      const base = work.name.replace(/\.[^.]+$/, "") || "image";
      downloadBlob(blob, base + "-" + eff.w + "x" + eff.h + "." + format);
    } catch (err) { showToast(err.message); }
    setBusy(false);
  }

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); },
  };

  const aspect = work ? work.W / work.H : 1;
  const frameStyle = work && {
    left: (crop.x / work.W) * 100 + "%", top: (crop.y / work.H) * 100 + "%",
    width: (crop.w / work.W) * 100 + "%", height: (crop.h / work.H) * 100 + "%",
  };

  const dimField = (axis, label) => {
    const value = draft && draft.axis === axis ? draft.text : fmt(toUnit(axis === "w" ? eff.w : eff.h, axis));
    return (
      <div className="ir-dim">
        <label className="tool-label" htmlFor={"ir-" + axis}>{label}</label>
        <span className="ir-inline">
          <input
            id={"ir-" + axis}
            type="number"
            inputMode="decimal"
            min={0}
            step={unit === "px" ? 1 : 0.1}
            value={value}
            disabled={!work}
            className="ir-num"
            onChange={(e) => onDim(axis, e.target.value)}
            onBlur={() => setDraft(null)}
          />
          <span className="ir-unit">{unit === "px" ? "px" : unit === "%" ? "%" : "in"}</span>
        </span>
      </div>
    );
  };

  return (
    <div className="tool-page">
      <header className="tool-head">
        <h1>Image Resizer & Aspect Ratio Cropper</h1>
        <p>Resize pixel dimensions and crop photos to exact social/print aspect ratios.</p>
      </header>

      <div className="tool-grid tool-grid--stage">
        <div className="tool-col">
          {work ? (
            <>
              <div className="ir-stage-wrap" {...dropProps}>
                <div
                  ref={stageRef}
                  className="ir-stage"
                  style={{ aspectRatio: work.W + " / " + work.H, width: "min(100%, calc(60vh * " + aspect + "))" }}
                >
                  <div className="ir-clip">
                    <canvas ref={previewRef} className="ir-preview" />
                    <div className="ir-shade" style={frameStyle} />
                  </div>
                  <div
                    className="ir-frame"
                    style={frameStyle}
                    tabIndex={0}
                    role="group"
                    aria-label="Crop area. Drag to move, use arrow keys to nudge."
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    onKeyDown={onKey}
                  >
                    {GRID_LINES[grid].flatMap((p) => [
                      <i key={"v" + p} className="ir-line ir-v" style={{ left: p + "%" }} />,
                      <i key={"h" + p} className="ir-line ir-h" style={{ top: p + "%" }} />,
                    ])}
                    <span className="ir-badge">{cw + " × " + ch}</span>
                    {HANDLES.map((k) => (
                      <span key={k} className={"ir-handle ir-h-" + k} data-handle={k} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="ir-stats">
                <div>
                  <span className="ir-stat-l">Original</span>
                  <span className="ir-stat-v">{work.originalWidth + " × " + work.originalHeight}</span>
                </div>
                <div>
                  <span className="ir-stat-l">{"Crop (" + simplifyRatio(cw, ch) + ")"}</span>
                  <span className="ir-stat-v">{cw + " × " + ch}</span>
                </div>
                <div className="ir-stat-main">
                  <span className="ir-stat-l">Output</span>
                  <span className="ir-stat-v">{eff.w + " × " + eff.h}</span>
                </div>
              </div>

              <section className="tool-card">
                <h2 className="tool-card-title">Canvas actions</h2>
                <div className="tool-row">
                  <span className="tool-label">Grid overlay</span>
                  <Segmented label="Grid overlay" value={grid} onChange={setGrid} options={GRIDS} />
                </div>
                <div className="tool-actions">
                  <button type="button" className="tool-btn tool-btn-ghost" onClick={() => transform("rotate")}>Rotate 90°</button>
                  <button type="button" className="tool-btn tool-btn-ghost" onClick={() => transform("flipH")}>Flip H</button>
                  <button type="button" className="tool-btn tool-btn-ghost" onClick={() => transform("flipV")}>Flip V</button>
                  <button type="button" className="tool-btn tool-btn-ghost" onClick={resetCrop}>Reset crop</button>
                  <button type="button" className="tool-btn tool-btn-ghost" onClick={() => fileInput.current.click()}>New image</button>
                </div>
              </section>
            </>
          ) : (
            <div
              className={"tool-drop tool-drop--tall" + (dragging ? " is-dragging" : "")}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.current.click(); } }}
              {...dropProps}
            >
              <span className="tool-drop-icon">
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 2v14a2 2 0 002 2h14" />
                  <path d="M2 6h14a2 2 0 012 2v14" />
                </svg>
              </span>
              <strong>Drop an image here, or browse</strong>
              <span className="tool-drop-hint">PNG, JPG, WEBP, SVG</span>
            </div>
          )}
        </div>

        <div className="tool-col">
          <section className="tool-card">
            <h2 className="tool-card-title">Aspect ratio presets</h2>
            <div className="ir-presets">
              {PRESETS.map((p) => {
                const active = p.value === null ? ratio === null : ratio !== null && Math.abs(ratio - p.value) < 1e-6;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={!work}
                    className={"ir-preset" + (active ? " is-active" : "")}
                    aria-pressed={active}
                    onClick={() => choosePreset(p.value)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {ratio && !PRESETS.some((p) => p.value && Math.abs(ratio - p.value) < 1e-6) && (
              <p className="tool-hint">{"Ratio locked at " + simplifyRatio(Math.round(ratio * 1000), 1000) + " after rotating."}</p>
            )}
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">Dimension controls</h2>
            <div className="tool-row">
              <span className="tool-label">Units</span>
              <Segmented
                label="Units"
                value={unit}
                onChange={(u) => { setUnit(u); setDraft(null); }}
                options={[{ v: "px", l: "Pixels" }, { v: "%", l: "%" }, { v: "in", l: "Inches" }]}
              />
            </div>
            {unit === "in" && (
              <div className="tool-row">
                <label className="tool-label" htmlFor="ir-dpi">DPI (pixels per inch)</label>
                <input
                  id="ir-dpi"
                  type="number"
                  min={1}
                  max={1200}
                  value={dpi}
                  className="tool-input tool-input-num"
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) setDpi(Math.min(1200, v)); }}
                />
              </div>
            )}
            <div className="ir-dims">{dimField("w", "Width")}{dimField("h", "Height")}</div>
            <label className="tool-check">
              <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
              Maintain aspect ratio
            </label>
            {!lock && target && <p className="tool-hint">Unlocked: the result may look stretched if the new ratio differs from the crop.</p>}
            {target && (
              <button type="button" className="ir-link" onClick={() => { setTarget(null); setDraft(null); }}>
                Use the crop size as output
              </button>
            )}
            {work && eff.w > cw && <p className="tool-hint">The output is larger than the crop, so it will be upscaled and may look soft.</p>}
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">Export options</h2>
            <div className="tool-row">
              <span className="tool-label">Format</span>
              <Segmented
                label="Format"
                value={format}
                onChange={setFormat}
                options={[{ v: "jpg", l: "JPG" }, { v: "png", l: "PNG" }, { v: "webp", l: "WEBP", disabled: !webpOk }]}
              />
            </div>
            {format !== "png" && (
              <div className="tool-field">
                <label className="tool-label tool-label-between" htmlFor="ir-q">
                  Quality <span className="tool-value">{quality}%</span>
                </label>
                <input
                  id="ir-q"
                  type="range"
                  min={40}
                  max={100}
                  value={quality}
                  className="tool-range"
                  style={{ "--fill": ((quality - 40) / 60) * 100 + "%" }}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </div>
            )}
            {format === "jpg" && <p className="tool-hint">JPG has no transparency. Transparent areas turn white.</p>}
            <button type="button" className="tool-btn tool-btn-primary" data-download="true" disabled={!work || busy} onClick={download}>
              {busy ? "Preparing..." : "Apply crop & download"}
            </button>
          </section>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR(ACCEPTED_KINDS)}
        hidden
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
      />

      {toast && <div className="tool-toast" role="status">{toast}</div>}
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../../utils/shared/download";
import { baseName, clamp, nextFrame, sleep } from "../../../utils/shared/format";
import { ACCEPT_ATTR, isAcceptedFile, loadImage } from "../../../utils/shared/imageFile";
import {
  ACCEPTED_KINDS,
  applySoftness,
  createSession,
  exportBlob,
  finishStroke,
  paintStroke,
  render,
  runDetection,
  snapshot,
  undo,
  updateBackdrop,
} from "../../../utils/img/BGRemove/BGRemove";
import "../../../utils/img/BGRemove/BGRemove.css";

const IDLE = "idle";
const PROCESSING = "processing";
const READY = "ready";
const TOAST_MS = 3600;
const MIN_SCAN_MS = 1200;
const RESENSITIZE_DEBOUNCE_MS = 450;
const MAX_BRUSH = 120;
const COVERAGE_MIN = 0.02;
const COVERAGE_MAX = 0.97;

export default function RemoveBgPage() {
  const [sess, setSess] = useState(null);
  const [status, setStatus] = useState(IDLE);
  const [viewMode, setViewMode] = useState("transparent");
  const [splitPos, setSplitPos] = useState(50);
  const [tool, setTool] = useState(null);
  const [brushSize, setBrushSize] = useState(15);
  const [softness, setSoftness] = useState(5);
  const [sensitivity, setSensitivity] = useState(50);
  const [backdropMode, setBackdropMode] = useState("transparent");
  const [solidColor, setSolidColor] = useState("#ffffff");
  const [bgImg, setBgImg] = useState(null);
  const [bgName, setBgName] = useState("");
  const [blurAmount, setBlurAmount] = useState(12);
  const [format, setFormat] = useState("png");
  const [undoCount, setUndoCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");

  const resultRef = useRef(null);
  const originalRef = useRef(null);
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const fileInput = useRef(null);
  const bgInput = useRef(null);
  const toastTimer = useRef(null);
  const painting = useRef(false);
  const last = useRef(null);
  const runId = useRef(0);
  const firstSens = useRef(true);

  const showSplit = viewMode === "split" && !tool;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), TOAST_MS);
  }

  async function detect(session, id) {
    setStatus(PROCESSING);
    const startedAt = performance.now();
    await sleep(60);
    const info = runDetection(session, { sensitivity, softness });
    await sleep(Math.max(0, MIN_SCAN_MS - (performance.now() - startedAt)));
    if (id !== runId.current) return;
    render(session, resultRef.current);
    setUndoCount(0);
    setStatus(READY);
    if (info.coverage < COVERAGE_MIN || info.coverage > COVERAGE_MAX) {
      showToast("The subject could not be separated cleanly. Try the detection strength slider or the brushes.");
    }
  }

  async function processFile(file) {
    if (!isAcceptedFile(file, ACCEPTED_KINDS)) {
      showToast("Only PNG, JPG and WEBP images work here.");
      return;
    }
    const id = ++runId.current;
    try {
      const loaded = await loadImage(file);
      const session = createSession(loaded);
      URL.revokeObjectURL(loaded.url);
      setTool(null);
      setStatus(PROCESSING);
      setSess(session);
      await nextFrame();
      await nextFrame();
      await detect(session, id);
    } catch (err) {
      showToast(err.message);
      setStatus(sess ? READY : IDLE);
    }
  }

  async function handleBgFile(file) {
    if (!isAcceptedFile(file, ACCEPTED_KINDS)) {
      showToast("Choose a PNG, JPG or WEBP image for the backdrop.");
      return;
    }
    try {
      const loaded = await loadImage(file);
      if (bgImg) URL.revokeObjectURL(bgImg.__url);
      setBgImg({ img: loaded.img, __url: loaded.url });
      setBgName(file.name);
      setBackdropMode("image");
    } catch (err) {
      showToast(err.message);
    }
  }

  useEffect(() => {
    if (!sess || !originalRef.current) return;
    const canvas = originalRef.current;
    canvas.width = sess.W;
    canvas.height = sess.H;
    canvas.getContext("2d").drawImage(sess.canvas, 0, 0);
  }, [sess]);

  useEffect(() => {
    if (!sess || !resultRef.current) return;
    updateBackdrop(sess, { mode: backdropMode, color: solidColor, image: bgImg && bgImg.img, blur: blurAmount });
    render(sess, resultRef.current);
  }, [sess, backdropMode, solidColor, bgImg, blurAmount]);

  useEffect(() => {
    if (!sess || status !== READY) return;
    applySoftness(sess, softness);
    render(sess, resultRef.current);
  }, [softness]);

  useEffect(() => {
    if (firstSens.current) {
      firstSens.current = false;
      return;
    }
    if (!sess || status !== READY) return;
    const timer = setTimeout(() => detect(sess, ++runId.current), RESENSITIZE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [sensitivity]);

  function point(event) {
    const rect = resultRef.current.getBoundingClientRect();
    const scale = sess.W / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale, scale };
  }

  function moveCursor(event) {
    const rect = stageRef.current.getBoundingClientRect();
    if (cursorRef.current) {
      cursorRef.current.style.transform =
        `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
    }
  }

  function moveSplit(event) {
    const rect = stageRef.current.getBoundingClientRect();
    setSplitPos(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100));
  }

  function stroke(from, to) {
    const rect = paintStroke(sess, from.x, from.y, to.x, to.y, (brushSize / 2) * from.scale, tool);
    render(sess, resultRef.current, rect);
  }

  function onDown(event) {
    if (status !== READY) return;
    if (tool) {
      event.currentTarget.setPointerCapture(event.pointerId);
      snapshot(sess);
      painting.current = true;
      const position = point(event);
      last.current = position;
      stroke(position, position);
    } else if (showSplit) {
      moveSplit(event);
    }
  }

  function onMove(event) {
    if (tool) {
      moveCursor(event);
      if (painting.current) {
        const position = point(event);
        stroke(last.current, position);
        last.current = position;
      }
    } else if (showSplit && (event.pointerType === "mouse" || event.buttons === 1)) {
      moveSplit(event);
    }
  }

  function onUp() {
    if (!painting.current) return;
    painting.current = false;
    finishStroke(sess);
    render(sess, resultRef.current);
    setUndoCount(sess.history.length);
  }

  function doUndo() {
    if (sess && undo(sess)) {
      render(sess, resultRef.current);
      setUndoCount(sess.history.length);
    }
  }

  async function download() {
    if (!sess || status !== READY) return;
    const blob = await exportBlob(sess, resultRef.current, format);
    downloadBlob(blob, `${baseName(sess.name)}-no-bg.${format}`);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onPickImage(event) {
    if (event.target.files[0]) processFile(event.target.files[0]);
    event.target.value = "";
  }

  function onPickBackdrop(event) {
    if (event.target.files[0]) handleBgFile(event.target.files[0]);
    event.target.value = "";
  }

  const dropProps = {
    onDragOver: (event) => { event.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  const dropZone = (
    <div
      className={`tool-drop tool-drop--tall${dragging ? " is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => fileInput.current.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInput.current.click();
        }
      }}
      {...dropProps}
    >
      <span className="tool-drop-icon">
        <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx={12} cy={8} r={3.5} />
          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
          <path d="M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4" />
        </svg>
      </span>
      <strong>Drop a photo here, or browse</strong>
      <span className="tool-drop-hint">PNG, JPG, WEBP. The background is removed automatically.</span>
    </div>
  );

  const aspect = sess ? sess.W / sess.H : 1;

  const stage = sess && (
    <div className="rb-stage-wrap" {...dropProps}>
      <div
        ref={stageRef}
        className={`rb-stage${status === READY ? " is-ready" : ""}${tool ? " has-tool" : ""}`}
        style={{
          aspectRatio: `${sess.W} / ${sess.H}`,
          width: `min(100%, calc(66vh * ${aspect}))`,
          touchAction: tool || showSplit ? "none" : "auto",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerEnter={() => { if (cursorRef.current) cursorRef.current.style.opacity = 1; }}
        onPointerLeave={() => { if (cursorRef.current) cursorRef.current.style.opacity = 0; }}
      >
        <canvas ref={originalRef} className="rb-layer rb-original" style={{ visibility: showSplit ? "visible" : "hidden" }} />
        <canvas
          ref={resultRef}
          className={`rb-layer rb-result${backdropMode === "transparent" ? " tool-checker" : ""}`}
          style={showSplit ? { clipPath: `inset(0 0 0 ${splitPos}%)` } : undefined}
        />
        {showSplit && <div className="rb-divider" style={{ left: `${splitPos}%` }}><span className="rb-handle">{"\u2194"}</span></div>}
        {showSplit && <span className="rb-chip rb-chip-l">Original</span>}
        {showSplit && <span className="rb-chip rb-chip-r">Removed</span>}
        {status === PROCESSING && (
          <div className="rb-scan">
            <div className="rb-scan-line" />
            <span className="rb-chip rb-chip-status">Finding the subject...</span>
          </div>
        )}
        {tool && (
          <div
            ref={cursorRef}
            className={`rb-cursor rb-cursor-${tool}`}
            style={{ width: brushSize, height: brushSize, marginLeft: -brushSize / 2, marginTop: -brushSize / 2 }}
          />
        )}
      </div>
    </div>
  );

  const viewToggle = sess && (
    <div className="rb-bar">
      <div className="tool-seg" role="group" aria-label="Preview mode">
        {[{ v: "transparent", l: "Transparent" }, { v: "split", l: "Split view" }].map((option) => (
          <button
            key={option.v}
            type="button"
            className={`tool-seg-btn${viewMode === option.v ? " is-active" : ""}`}
            aria-pressed={viewMode === option.v}
            onClick={() => setViewMode(option.v)}
          >
            {option.l}
          </button>
        ))}
      </div>
      <button type="button" className="tool-btn tool-btn-ghost" onClick={() => fileInput.current.click()}>
        Upload new image
      </button>
    </div>
  );

  function slider(id, label, value, min, max, unit, onChange) {
    return (
      <div className="tool-field">
        <label className="tool-label tool-label-between" htmlFor={id}>
          <span>
            {label} <span className="tool-value">{value}{unit}</span>
          </span>
        </label>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          className="tool-range"
          style={{ "--fill": `${((value - min) / (max - min)) * 100}%` }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    );
  }

  function radio(value, label, extra) {
    return (
      <label className={`tool-choice${backdropMode === value ? " is-active" : ""}`}>
        <input
          type="radio"
          name="rb-backdrop"
          checked={backdropMode === value}
          onChange={() => setBackdropMode(value)}
        />
        <span className="tool-choice-text">{label}</span>
        {extra}
      </label>
    );
  }

  const backdropPanel = (
    <section className="tool-card">
      <h2 className="tool-card-title">Backdrop replacement</h2>
      {radio("transparent", "Transparent checkerboard")}
      {radio("solid", "Solid colour", backdropMode === "solid" && (
        <span className="tool-inline">
          <input
            type="color"
            value={solidColor}
            className="tool-color"
            aria-label="Backdrop colour"
            onChange={(event) => setSolidColor(event.target.value)}
          />
          <input
            type="text"
            value={solidColor}
            maxLength={7}
            spellCheck={false}
            className="tool-input tool-input-hex"
            aria-label="Hex value"
            onChange={(event) => { if (/^#[0-9a-fA-F]{0,6}$/.test(event.target.value)) setSolidColor(event.target.value); }}
            onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(solidColor)) setSolidColor("#ffffff"); }}
          />
        </span>
      ))}
      {radio("image", "Backdrop image", backdropMode === "image" && (
        <button type="button" className="tool-btn tool-btn-small tool-btn-accent" onClick={() => bgInput.current.click()}>
          {bgImg ? `Change (${bgName.length > 14 ? bgName.slice(0, 12) + "..." : bgName})` : "Upload image"}
        </button>
      ))}
      {radio("blur", "Blurred original photo")}
      {backdropMode === "blur" && slider("rb-blur", "Blur amount", blurAmount, 4, 40, "", setBlurAmount)}
    </section>
  );

  const toolButton = (key, label) => (
    <button
      type="button"
      className={`rb-tool${tool === key ? " is-active" : ""}`}
      aria-pressed={tool === key}
      disabled={status !== READY}
      onClick={() => setTool(tool === key ? null : key)}
    >
      {label}
    </button>
  );

  const refinePanel = (
    <section className="tool-card">
      <h2 className="tool-card-title">Edge refinement tools</h2>
      <div className="rb-tools">
        {toolButton("erase", "Erase brush")}
        {toolButton("restore", "Restore brush")}
        <button type="button" className="tool-btn tool-btn-ghost" disabled={!undoCount} onClick={doUndo}>Undo</button>
      </div>
      {slider("rb-brush", "Brush size", brushSize, 4, MAX_BRUSH, "px", setBrushSize)}
      {slider("rb-soft", "Edge softness", softness, 0, 20, "px", setSoftness)}
      {slider("rb-sens", "Detection strength", sensitivity, 0, 100, "%", setSensitivity)}
      <p className="tool-hint">Changing detection strength runs the detection again and clears brush touch-ups.</p>
    </section>
  );

  const resolution = sess
    ? `${sess.W}x${sess.H}px` +
      (sess.W === sess.originalWidth ? " (Original)" : ` (scaled down from ${sess.originalWidth}x${sess.originalHeight})`)
    : "No image yet";

  const exportPanel = (
    <section className="tool-card">
      <h2 className="tool-card-title">Export options</h2>
      <div className="tool-row">
        <span className="tool-label">Format</span>
        <div className="tool-seg" role="group" aria-label="Export format">
          {[{ v: "png", l: "PNG (Lossless)" }, { v: "jpg", l: "JPG" }].map((option) => (
            <button
              key={option.v}
              type="button"
              className={`tool-seg-btn${format === option.v ? " is-active" : ""}`}
              aria-pressed={format === option.v}
              onClick={() => setFormat(option.v)}
            >
              {option.l}
            </button>
          ))}
        </div>
      </div>
      {format === "jpg" && <p className="tool-hint">JPG has no transparency. Transparent areas are filled white.</p>}
      <div className="tool-row">
        <span className="tool-label">Resolution</span>
        <span className="tool-muted">{resolution}</span>
      </div>
      <div className="tool-actions-column">
        <button type="button" className="tool-btn tool-btn-primary" disabled={status !== READY} onClick={download}>
          Download high-res image
        </button>
      </div>
    </section>
  );

  return (
    <div className="tool-page">
      <header className="tool-head">
        <h1>Remove BG: automatic background remover</h1>
        <p>Instantly isolate subjects and generate transparent PNG graphics.</p>
      </header>

      <div className="tool-grid tool-grid--stage">
        <div className="tool-col">
          {sess ? (
            <>
              {stage}
              {viewToggle}
            </>
          ) : (
            dropZone
          )}
        </div>
        <div className="tool-col">
          {backdropPanel}
          {refinePanel}
          {exportPanel}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR(ACCEPTED_KINDS)}
        hidden
        onChange={onPickImage}
      />
      <input
        ref={bgInput}
        type="file"
        accept={ACCEPT_ATTR(ACCEPTED_KINDS)}
        hidden
        onChange={onPickBackdrop}
      />

      {toast && <div className="tool-toast" role="status">{toast}</div>}
    </div>
  );
}
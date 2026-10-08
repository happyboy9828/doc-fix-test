"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { downloadBlob } from "../../../utils/shared/download";
import { ACCEPT_ATTR, isAcceptedFile, loadImage } from "../../../utils/shared/imageFile";
import {
  ACCEPTED_KINDS,
  DEFAULT_SELECTION,
  MAX_ICON_SIZE,
  OUTPUT_FILES,
  buildFaviconZip,
  buildHeadSnippet,
  renderIcon,
} from "../../../utils/img/FavIcon/FavIcon";
import "../../../utils/img/FavIcon/FavIcon.css";

const PREVIEW_SIZES = [16, 32, 180];
const MAX_PADDING = 40;
const HEX_IN_PROGRESS = /^#[0-9a-fA-F]{0,6}$/;
const HEX_COMPLETE = /^#[0-9a-fA-F]{6}$/;

function IconCanvas({ source, options, size }) {
  const ref = useRef(null);

  useEffect(() => {
    if (source && ref.current) renderIcon(source, size, options, ref.current);
  }, [source, options, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="fg-canvas"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${size}x${size} icon preview`}
    />
  );
}

function BrowserTab({ theme, source, options }) {
  return (
    <div className={`fg-tab fg-tab-${theme}`}>
      <span className="fg-tab-dots"><i /><i /><i /></span>
      <div className="fg-tab-item">
        {source ? <IconCanvas source={source} options={options} size={16} /> : <span className="fg-tab-placeholder" />}
        <span className="fg-tab-title">My Website | Page</span>
        <span className="fg-tab-close">{"\u00d7"}</span>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="tool-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`tool-seg-btn${value === option.value ? " is-active" : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function FaviconGeneratorPage() {
  const [source, setSource] = useState(null);
  const [shape, setShape] = useState("square");
  const [padding, setPadding] = useState(10);
  const [fillMode, setFillMode] = useState("transparent");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const toastTimer = useRef(null);

  const background = fillMode === "custom" ? fillColor : null;

  const options = useMemo(() => ({ shape, padding, background }), [shape, padding, background]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  async function handleFile(file) {
    if (!isAcceptedFile(file, ACCEPTED_KINDS)) {
      showToast("Only PNG, JPG, SVG and WEBP images work here.");
      return;
    }
    try {
      const loaded = await loadImage(file, MAX_ICON_SIZE);
      setSource((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return loaded;
      });
    } catch (err) {
      showToast(err.message);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function toggleFile(key) {
    setSelection((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  function onPickFile(event) {
    if (event.target.files[0]) handleFile(event.target.files[0]);
    event.target.value = "";
  }

  const snippet = buildHeadSnippet(selection);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Copy failed. Select the code and copy it manually.");
    }
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    try {
      downloadBlob(await buildFaviconZip(source, options, selection), "favicon-package.zip");
    } catch (err) {
      showToast(err.message);
    }
    setBusy(false);
  }

  const openPicker = () => fileInput.current && fileInput.current.click();
  const lowRes = source && Math.min(source.width, source.height) < MAX_ICON_SIZE;

  return (
    <div className="tool-page">
      <header className="tool-head">
        <h1>Favicon Generator</h1>
        <p>Generate multi-size favicons and web application icons from any image.</p>
      </header>

      <div className="tool-grid">
        <div className="tool-col">
          <div
            className={`tool-drop${dragging ? " is-dragging" : ""}${source ? " has-image" : ""}`}
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicker();
              }
            }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT_ATTR(ACCEPTED_KINDS)}
              hidden
              onChange={onPickFile}
            />
            {source ? (
              <div className="fg-drop-loaded">
                <img src={source.url} alt="Source" className="fg-thumb" />
                <div>
                  <strong className="fg-file-name">{source.name}</strong>
                  <span className="tool-muted">{source.width} &times; {source.height} px. Click or drop to replace.</span>
                </div>
              </div>
            ) : (
              <div className="tool-drop-empty">
                <span className="tool-drop-icon">
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x={3} y={3} width={18} height={18} rx={3} />
                    <circle cx={8.5} cy={8.5} r={1.5} />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </span>
                <strong>Drag a source image here, or browse</strong>
                <span className="tool-drop-hint">PNG, JPG, SVG, WEBP</span>
              </div>
            )}
          </div>

          <section className="tool-card">
            <h2 className="tool-card-title">Crop and alignment</h2>
            <div className="tool-row">
              <span className="tool-label">Shape</span>
              <Segmented label="Shape" value={shape} onChange={setShape} options={[{ value: "circle", label: "Circle" }, { value: "square", label: "Square" }]} />
            </div>
            <div className="tool-field">
              <label className="tool-label tool-label-between" htmlFor="fg-padding">
                <span>
                  Padding <span className="tool-value">{padding}%</span>
                </span>
              </label>
              <input
                id="fg-padding"
                type="range"
                min={0}
                max={MAX_PADDING}
                value={padding}
                className="tool-range"
                style={{ "--fill": `${(padding / MAX_PADDING) * 100}%` }}
                onChange={(event) => setPadding(Number(event.target.value))}
              />
            </div>
            <div className="tool-row">
              <span className="tool-label">Background fill</span>
              <div className="tool-inline">
                <Segmented label="Background fill" value={fillMode} onChange={setFillMode} options={[{ value: "transparent", label: "Transparent" }, { value: "custom", label: "Custom hex" }]} />
                {fillMode === "custom" && (
                  <input
                    type="color"
                    value={fillColor}
                    className="tool-color"
                    aria-label="Background colour"
                    onChange={(event) => setFillColor(event.target.value)}
                  />
                )}
                {fillMode === "custom" && (
                  <input
                    type="text"
                    value={fillColor}
                    maxLength={7}
                    spellCheck={false}
                    className="tool-input tool-input-hex"
                    aria-label="Hex value"
                    onChange={(event) => { if (HEX_IN_PROGRESS.test(event.target.value)) setFillColor(event.target.value); }}
                    onBlur={() => { if (!HEX_COMPLETE.test(fillColor)) setFillColor("#ffffff"); }}
                  />
                )}
              </div>
            </div>
            {lowRes && (
              <p className="tool-note">
                This image is under {MAX_ICON_SIZE} px, so the {MAX_ICON_SIZE}x{MAX_ICON_SIZE} icon will be
                scaled up. Use a larger source for the sharpest result.
              </p>
            )}
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">Preview matrix</h2>
            {source ? (
              <div className="fg-matrix">
                {PREVIEW_SIZES.map((size) => (
                  <figure key={size} className="fg-fig">
                    <div className="tool-checker fg-checker">
                      <IconCanvas source={source} options={options} size={size} />
                    </div>
                    <figcaption>{size}x{size}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="tool-empty">Add an image to see every size.</p>
            )}
          </section>
        </div>

        <div className="tool-col">
          <section className="tool-card">
            <h2 className="tool-card-title">Browser tab preview</h2>
            <BrowserTab theme="dark" source={source} options={options} />
            <BrowserTab theme="light" source={source} options={options} />
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">Files to generate</h2>
            <ul className="fg-checklist">
              {OUTPUT_FILES.map((file) => (
                <li key={file.key}>
                  <label className="fg-check">
                    <input
                      type="checkbox"
                      checked={!!selection[file.key]}
                      onChange={() => toggleFile(file.key)}
                    />
                    <span className="fg-check-name">{file.label}</span>
                    <span className="tool-muted">{file.detail}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="tool-card">
            <h2 className="tool-card-title">HTML head code</h2>
            <pre className="tool-code fg-code"><code>{snippet || "<!-- Select at least one file -->"}</code></pre>
            <button type="button" className="tool-btn tool-btn-ghost" onClick={copyCode} disabled={!snippet}>
              {copied ? (
                <span className="fg-copied">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  Copied
                </span>
              ) : (
                "Copy code"
              )}
            </button>
          </section>

          <div className="tool-actions-column">
            <button
              type="button"
              className="tool-btn tool-btn-primary"
              data-download="true"
              onClick={download}
              disabled={!source || busy}
            >
              {busy ? "Building ZIP..." : "Download favicon package (.zip)"}
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="tool-toast" role="status">{toast}</div>}
    </div>
  );
}
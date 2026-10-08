"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../../utils/shared/download";
import { clamp } from "../../../utils/shared/format";
import { ACCEPT_ATTR, isAcceptedFile, kindOf, loadImage } from "../../../utils/shared/imageFile";
import { createZipFromBlobs } from "../../../utils/shared/zip";
import {
  ANCHORS,
  DEFAULT_SETTINGS,
  FONTS,
  LOGO_KINDS,
  PHOTO_KINDS,
  createSample,
  exportPhoto,
  loadFont,
  renderWatermarked,
} from "../../../utils/img/Watermark/Watermark";
import "../../../utils/img/Watermark/Watermark.css";

let nextId = 1;

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="tool-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.v}
          type="button"
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

function Slider({ id, label, value, min, max, unit, onChange }) {
  return (
    <div className="tool-field">
      <label className="tool-label tool-label-between" htmlFor={id}>
        {label} <span className="tool-value">{value}{unit}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        className="tool-range"
        style={{ "--fill": ((value - min) / (max - min)) * 100 + "%" }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default function WatermarkPage() {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [logo, setLogo] = useState(null);
  const [sample, setSample] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState("");

  const previewRef = useRef(null);
  const rectRef = useRef(null);
  const dragRef = useRef(null);
  const photoInput = useRef(null);
  const logoInput = useRef(null);
  const toastTimer = useRef(null);

  const patch = (changes) => setS((prev) => Object.assign({}, prev, changes));
  const selected = items.find((i) => i.id === selectedId) || null;
  const photo = selected || sample;
  const font = FONTS.find((f) => f.id === s.fontId) || FONTS[0];

  useEffect(() => { setSample(createSample()); }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }

  useEffect(() => {
    if (!photo || !previewRef.current) return;
    let dead = false;
    loadFont(font).then(() => {
      if (dead || !previewRef.current) return;
      rectRef.current = renderWatermarked(previewRef.current, photo, s, logo, 1400);
    });
    return () => { dead = true; };
  }, [photo, s, logo, font]);

  async function addPhotos(fileList) {
    const files = Array.from(fileList);
    const good = files.filter((f) => isAcceptedFile(f, PHOTO_KINDS));
    if (good.length < files.length) showToast("Some files were skipped. Photos must be PNG, JPG or WEBP.");
    const loaded = [];
    for (const f of good) {
      try {
        const l = await loadImage(f);
        loaded.push({ id: nextId++, name: l.name, kind: kindOf(f), img: l.img, width: l.width, height: l.height, url: l.url });
      } catch (err) { showToast(err.message); }
    }
    if (!loaded.length) return;
    setItems((list) => list.concat(loaded));
    if (!selectedId) setSelectedId(loaded[0].id);
  }

  function removeItem(id) {
    const it = items.find((i) => i.id === id);
    if (it) URL.revokeObjectURL(it.url);
    const rest = items.filter((i) => i.id !== id);
    setItems(rest);
    if (selectedId === id) setSelectedId(rest.length ? rest[0].id : null);
  }

  async function addLogo(file) {
    if (!isAcceptedFile(file, LOGO_KINDS)) { showToast("Logos must be PNG, JPG, WEBP or SVG."); return; }
    try {
      const l = await loadImage(file);
      setLogo({ img: l.img, width: l.width, height: l.height, name: l.name, url: l.url });
      patch({ type: "logo" });
    } catch (err) { showToast(err.message); }
  }

  function changeMode(mode) {
    const angle = mode === "tile" && s.angle === 0 ? -30 : mode === "single" && s.angle === -30 ? 0 : s.angle;
    patch({ mode, angle });
  }

  function norm(e) {
    const r = previewRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function onDown(e) {
    if (s.mode !== "single") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = norm(e), box = rectRef.current, c = previewRef.current;
    let ox = 0, oy = 0;
    if (box) {
      const bx = box.x / c.width, by = box.y / c.height, bw = box.w / c.width, bh = box.h / c.height;
      if (p.x >= bx && p.x <= bx + bw && p.y >= by && p.y <= by + bh) { ox = p.x - (bx + bw / 2); oy = p.y - (by + bh / 2); }
    }
    dragRef.current = { ox, oy };
    patch({ custom: { x: clamp(p.x - ox, 0, 1), y: clamp(p.y - oy, 0, 1) }, anchor: null });
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const p = norm(e);
    patch({ custom: { x: clamp(p.x - d.ox, 0, 1), y: clamp(p.y - d.oy, 0, 1) }, anchor: null });
  }
  function onUp() { dragRef.current = null; }

  async function downloadAll() {
    if (!items.length) return;
    try {
      await loadFont(font);
      setProgress({ done: 0, total: items.length });
      const files = [];
      for (let n = 0; n < items.length; n++) {
        files.push(await exportPhoto(items[n], s, logo));
        setProgress({ done: n + 1, total: items.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      downloadBlob(await createZipFromBlobs(files), "watermarked-photos.zip");
    } catch (err) { showToast(err.message); }
    setProgress(null);
  }

  async function downloadOne() {
    if (!selected) return;
    try {
      await loadFont(font);
      const f = await exportPhoto(selected, s, logo);
      downloadBlob(f.blob, f.name);
    } catch (err) { showToast(err.message); }
  }

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e) => { e.preventDefault(); setDragging(false); addPhotos(e.dataTransfer.files); },
  };

  const needsStamp = s.type === "logo" && !logo;
  const aspect = photo ? photo.width / photo.height : 1.5;

  return (
    <div className="tool-page">
      <header className="tool-head">
        <h1>Image Watermark Tool</h1>
        <p>Protect your media assets with custom text or image logo overlays.</p>
      </header>

      <div className="tool-grid tool-grid--stage">
        <div className="tool-col">
          <div className={"wm-stage-wrap" + (dragging ? " is-dragging" : "")} {...dropProps}>
            <div
              className={"wm-stage" + (s.mode === "single" ? " is-draggable" : "")}
              style={{ aspectRatio: String(aspect), width: `min(100%, calc(62vh * ${aspect}))` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <canvas ref={previewRef} className="wm-canvas" aria-label="Watermark preview" />
              {!selected && <span className="wm-chip">Sample photo. Add yours below.</span>}
              {needsStamp && <span className="wm-chip wm-chip-warn">Upload a logo to see it here</span>}
            </div>
            {s.mode === "single" && (
              <p className="tool-hint wm-center">Drag the watermark anywhere on the photo, or pick a spot on the 9-point grid.</p>
            )}
          </div>

          <div className="tool-row">
            <span className="tool-label">Mode</span>
            <Segmented
              value={s.mode}
              onChange={changeMode}
              options={[{ v: "single", l: "Single overlay" }, { v: "tile", l: "Tile" }]}
              label="Watermark mode"
            />
          </div>

          <section className="tool-card">
            <div className="wm-card-head">
              <h2 className="tool-card-title">Batch upload status</h2>
              <button type="button" className="tool-btn tool-btn-small" onClick={() => photoInput.current?.click()}>
                + Add photos
              </button>
            </div>
            <input
              ref={photoInput}
              type="file"
              multiple
              hidden
              accept={ACCEPT_ATTR(PHOTO_KINDS)}
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
            />
            <p className="wm-status">
              {items.length ? items.length + (items.length === 1 ? " photo" : " photos") + " queued" : "No photos queued. You can also drop files onto the preview."}
            </p>
            {items.length > 0 && (
              <ul className="wm-thumbs">
                {items.map((it) => (
                  <li key={it.id} className={"wm-thumb" + (it.id === selectedId ? " is-selected" : "")}>
                    <button
                      type="button"
                      className="wm-thumb-btn"
                      onClick={() => setSelectedId(it.id)}
                      aria-label={"Preview " + it.name}
                      title={it.name}
                    >
                      <img src={it.url} alt="" />
                    </button>
                    <button
                      type="button"
                      className="wm-thumb-x"
                      aria-label={"Remove " + it.name}
                      onClick={() => removeItem(it.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="tool-col">
          <section className="tool-card">
            <h2 className="tool-card-title">Watermark type</h2>
            <Segmented
              value={s.type}
              onChange={(v) => patch({ type: v })}
              options={[{ v: "text", l: "Text watermark" }, { v: "logo", l: "Logo image" }]}
              label="Watermark type"
            />
          </section>

          {s.type === "text" && (
            <section className="tool-card">
              <h2 className="tool-card-title">Text options</h2>
              <label className="tool-label" htmlFor="wm-text">Text</label>
              <textarea
                id="wm-text"
                rows={2}
                className="tool-input"
                spellCheck={false}
                value={s.text}
                onChange={(e) => patch({ text: e.target.value })}
              />
              <p className="tool-label" style={{ margin: "14px 0 8px" }}>Font</p>
              <div className="wm-fonts" role="group" aria-label="Font">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={"wm-font" + (s.fontId === f.id ? " is-active" : "")}
                    aria-pressed={s.fontId === f.id}
                    style={{ fontFamily: f.family, fontWeight: f.weight, fontStyle: f.style }}
                    onClick={() => patch({ fontId: f.id })}
                  >
                    <span className="wm-font-sample">Aa</span>
                    <span className="wm-font-name">{f.label}</span>
                  </button>
                ))}
              </div>

              <div className="tool-row">
                <span className="tool-label">Colour</span>
                <span className="tool-inline">
                  <input
                    type="color"
                    className="tool-color"
                    aria-label="Text colour"
                    value={s.color}
                    onChange={(e) => patch({ color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="tool-input tool-input-hex"
                    maxLength={7}
                    spellCheck={false}
                    aria-label="Hex colour"
                    value={s.color}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) patch({ color: e.target.value }); }}
                    onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(s.color)) patch({ color: "#ffffff" }); }}
                  />
                </span>
              </div>

              <Slider id="wm-size-t" label="Size (percent of photo width)" value={s.sizeText} min={1} max={30} unit="%" onChange={(v) => patch({ sizeText: v })} />
              <label className="tool-check">
                <input type="checkbox" checked={s.shadow} onChange={(e) => patch({ shadow: e.target.checked })} />
                Soft shadow for readability
              </label>
            </section>
          )}

          {s.type === "logo" && (
            <section className="tool-card">
              <h2 className="tool-card-title">Logo options</h2>
              <input
                ref={logoInput}
                type="file"
                hidden
                accept={ACCEPT_ATTR(LOGO_KINDS)}
                onChange={(e) => { if (e.target.files[0]) addLogo(e.target.files[0]); e.target.value = ""; }}
              />
              <div className="wm-logo-row">
                {logo && (
                  <img src={logo.url} alt="" className="wm-logo-thumb" />
                )}
                <button type="button" className="tool-btn tool-btn-ghost" onClick={() => logoInput.current?.click()}>
                  {logo ? "Change logo" : "Upload logo"}
                </button>
              </div>
              {logo && <p className="tool-hint">{logo.name + " (" + logo.width + " \u00d7 " + logo.height + ")"}</p>}
              {!logo && <p className="tool-hint">PNG with a transparent background works best.</p>}
              <Slider id="wm-size-l" label="Size (percent of photo width)" value={s.sizeLogo} min={3} max={80} unit="%" onChange={(v) => patch({ sizeLogo: v })} />
            </section>
          )}

          <section className="tool-card">
            <h2 className="tool-card-title">Placement & opacity</h2>
            <Slider id="wm-opacity" label="Opacity" value={s.opacity} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v })} />
            {s.mode === "single" && (
              <p className="tool-label" style={{ margin: "14px 0 8px" }}>9-point alignment grid</p>
            )}
            {s.mode === "single" && (
              <div
                className={"wm-anchors" + (s.mode === "tile" ? " is-off" : "")}
                role="group"
                aria-label="9-point alignment grid"
              >
                {ANCHORS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={s.mode === "tile"}
                    aria-label={a.aria}
                    aria-pressed={s.anchor === a.id}
                    className={"wm-anchor" + (s.anchor === a.id ? " is-active" : "")}
                    onClick={() => patch({ anchor: a.id, custom: null })}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {s.mode === "single" && (
              <Slider id="wm-margin" label="Margin from edge" value={s.margin} min={0} max={15} unit="%" onChange={(v) => patch({ margin: v })} />
            )}
            {s.mode === "tile" && (
              <Slider id="wm-spacing" label="Tile spacing" value={s.spacing} min={0} max={300} unit="%" onChange={(v) => patch({ spacing: v })} />
            )}
            <Slider id="wm-angle" label="Rotation" value={s.angle} min={-90} max={90} unit="\u00b0" onChange={(v) => patch({ angle: v })} />
          </section>

          <div className="tool-actions-column">
            <button
              type="button"
              className="tool-btn tool-btn-primary"
              data-download="true"
              disabled={!items.length || !!progress || needsStamp}
              onClick={downloadAll}
            >
              {progress ? "Processing " + progress.done + " of " + progress.total + "..." : "Apply to all & download (.zip)"}
            </button>
            {progress && (
              <div className="tool-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total}>
                <div className="tool-progress-bar" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            )}
            <button
              type="button"
              className="tool-btn tool-btn-ghost"
              data-download="true"
              style={{ width: "100%" }}
              disabled={!selected || !!progress || needsStamp}
              onClick={downloadOne}
            >
              Download selected photo
            </button>
            {!items.length && <p className="tool-hint">Add photos to enable downloads. Your originals stay untouched.</p>}
            {needsStamp && <p className="tool-hint">Upload a logo first.</p>}
          </div>
        </div>
      </div>

      {toast && <div className="tool-toast" role="status">{toast}</div>}
    </div>
  );
}
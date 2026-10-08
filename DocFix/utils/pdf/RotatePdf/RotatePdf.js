/* ==========================================================================
   RotatePdf.js — Rotate PDF utility
   Plain JavaScript. No JSX, no dependencies, no wrapper component.

   Exports:
     createRotatePdf(container, options) -> { destroy }
   ========================================================================== */

import { downloadBlob } from "../../shared/download";

function h(tag, props, children) {
  const node = document.createElement(tag);
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

export function createRotatePdf(container, userOptions) {
  if (!container) throw new Error("createRotatePdf: a container element is required");

  const ac = new AbortController();
  const opts = Object.assign({}, userOptions);
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ac.signal });

  let activeFile = null;
  let pdfJsDoc = null;
  let totalPages = 0;
  // Map page numbers (1-indexed) to orientation angles: 0, 90, 180, 270
  let pageRotations = new Map();
  let generatedBlobUrl = null;

  /* ---- build DOM ---- */
  const dropZone = h("div", { className: "rp-drop-zone", id: "rp-drop-zone" }, [
    h("div", { className: "rp-drop-zone-icon", text: "📁" }),
    h("p", {}, [
      "Drag & Drop a PDF file here or click ",
      h("strong", {}, "Upload PDF"),
      " above",
    ]),
  ]);

  const fileInput = h("input", { type: "file", id: "rp-pdf-file-input", accept: "application/pdf", style: "display: none;" });

  const uploadBtn = h("label", { for: "rp-pdf-file-input", className: "rp-btn-upload" }, "📄 Upload PDF");

  const batchActions = h("div", { className: "rp-batch-actions", id: "rp-batch-actions", style: "display: none;" }, [
    h("button", { type: "button", id: "rp-btn-rotate-all-left", className: "rp-btn-secondary" }, "⎌ Rotate All Left"),
    h("button", { type: "button", id: "rp-btn-rotate-all-right", className: "rp-btn-secondary" }, "Rotate All Right ↷"),
    h("button", { type: "button", id: "rp-btn-reset-all", className: "rp-btn-secondary-danger" }, "Reset All"),
  ]);

  const globalActionsBar = h("div", { className: "rp-global-actions-bar" }, [uploadBtn, fileInput, batchActions]);

  const workspaceCard = h("div", { className: "rp-workspace-card" }, [dropZone]);

  const thumbnailWorkspace = h("div", { className: "rp-thumbnail-grid", id: "rp-thumbnail-workspace", style: "display: none;" });

  workspaceCard.appendChild(thumbnailWorkspace);

  const btnSaveDownload = h("button", { type: "button", id: "rp-btn-save-download", className: "rp-btn-primary-lg", disabled: true }, "Save & Download Rotated PDF");

  const progressContainer = h("div", { className: "rp-progress-container", id: "rp-progress-container", style: "display: none;" }, [
    h("div", { className: "rp-progress-bar", id: "rp-progress-bar" }),
  ]);

  const exportPanel = h("div", { className: "rp-export-panel", id: "rp-export-panel", style: "display: none;" }, [btnSaveDownload, progressContainer]);

  const header = h("header", { className: "rp-header" }, [
    h("h1", { text: "Rotate PDF" }),
    h("p", { text: "Permanently fix page orientation for entire PDFs or individual pages." }),
  ]);

  const root = h("div", { className: "rp-container" }, [header, globalActionsBar, workspaceCard, exportPanel]);

  container.innerHTML = "";
  container.appendChild(root);

  /* ---- event handlers ---- */
  const fileInputEl = container.querySelector("#rp-pdf-file-input");
  const dropZoneEl = container.querySelector("#rp-drop-zone");
  const batchActionsEl = container.querySelector("#rp-batch-actions");
  const thumbnailWorkspaceEl = container.querySelector("#rp-thumbnail-workspace");
  const exportPanelEl = container.querySelector("#rp-export-panel");
  const btnRotateAllLeft = container.querySelector("#rp-btn-rotate-all-left");
  const btnRotateAllRight = container.querySelector("#rp-btn-rotate-all-right");
  const btnResetAll = container.querySelector("#rp-btn-reset-all");
  const btnSaveDownloadEl = container.querySelector("#rp-btn-save-download");
  const progressContainerEl = container.querySelector("#rp-progress-container");
  const progressBarEl = container.querySelector("#rp-progress-bar");

  async function handleFile(file) {
    if (file.type !== "application/pdf") {
      alert("Please select a valid PDF file.");
      return;
    }

    activeFile = file;
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    pageRotations.clear();
    for (let i = 1; i <= totalPages; i++) {
      pageRotations.set(i, 0);
    }

    dropZoneEl.style.display = "none";
    thumbnailWorkspaceEl.style.display = "grid";
    batchActionsEl.style.display = "flex";
    exportPanelEl.style.display = "block";
    btnSaveDownloadEl.disabled = false;

    await renderWorkspace();
  }

  async function renderWorkspace() {
    thumbnailWorkspaceEl.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
      const card = h("div", { className: "rp-thumb-card", "data-page": i });

      const header = h("div", { className: "rp-card-header" }, [
        h("span", { text: `Page ${i}` }),
        h("span", { className: "rp-badge-deg", id: `rp-deg-badge-${i}`, text: "0°" }),
      ]);

      const previewWrapper = h("div", { className: "rp-preview-wrapper" });

      const canvas = h("canvas", { id: `rp-canvas-page-${i}` });

      previewWrapper.appendChild(canvas);

      // Action Overlay
      const overlay = h("div", { className: "rp-action-overlay" }, [
        h("button", { type: "button", className: "rp-btn-overlay rp-btn-rotate-left", title: "Rotate 90° Left" }, "⎌ 90°L"),
        h("button", { type: "button", className: "rp-btn-overlay rp-btn-rotate-right", title: "Rotate 90° Right" }, "↷ 90°R"),
      ]);

      card.appendChild(header);
      card.appendChild(previewWrapper);
      card.appendChild(overlay);
      thumbnailWorkspaceEl.appendChild(card);

      // Render PDF page to canvas
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: canvas.getContext("2d"), viewport };
      await page.render(renderContext).promise;

      // Event listeners for individual rotation
      overlay.querySelector(".rp-btn-rotate-left").addEventListener("click", () => rotatePage(i, -90));
      overlay.querySelector(".rp-btn-rotate-right").addEventListener("click", () => rotatePage(i, 90));
    }
  }

  function rotatePage(pageNum, degrees) {
    let current = pageRotations.get(pageNum) || 0;
    let updated = (current + degrees) % 360;
    if (updated < 0) updated += 360;
    pageRotations.set(pageNum, updated);

    updatePageUI(pageNum);
  }

  function rotateAll(degrees) {
    for (let i = 1; i <= totalPages; i++) {
      rotatePage(i, degrees);
    }
  }

  function resetRotations() {
    for (let i = 1; i <= totalPages; i++) {
      pageRotations.set(i, 0);
      updatePageUI(i);
    }
  }

  function updatePageUI(pageNum) {
    const deg = pageRotations.get(pageNum);
    const canvas = container.querySelector(`#rp-canvas-page-${pageNum}`);
    const badge = container.querySelector(`#rp-deg-badge-${pageNum}`);

    if (canvas) {
      canvas.style.transform = `rotate(${deg}deg)`;
    }

    if (badge) {
      badge.textContent = `${deg}°`;
      badge.className = deg !== 0 ? "rp-badge-deg active" : "rp-badge-deg";
    }
  }

  async function processAndDownload() {
    if (!activeFile) return;

    progressContainerEl.style.display = "block";
    progressBarEl.style.width = "30%";

    try {
      const { PDFDocument, degrees } = window.PDFLib;
      const arrayBuffer = await activeFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      progressBarEl.style.width = "60%";

      pages.forEach((page, index) => {
        const pageNum = index + 1;
        const additionalRotation = pageRotations.get(pageNum) || 0;
        if (additionalRotation !== 0) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + additionalRotation) % 360));
        }
      });

      progressBarEl.style.width = "90%";

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl);
      generatedBlobUrl = URL.createObjectURL(blob);

      const downloadLink = document.createElement("a");
      downloadLink.href = generatedBlobUrl;
      downloadLink.download = `Rotated_${activeFile.name}`;
      downloadLink.click();

      progressBarEl.style.width = "100%";
      setTimeout(() => {
        progressContainerEl.style.display = "none";
        progressBarEl.style.width = "0%";
      }, 500);
    } catch (err) {
      console.error("Error rotating PDF:", err);
      alert("An error occurred while rotating the PDF.");
      progressContainerEl.style.display = "none";
    }
  }

  /* ---- events ---- */
  on(fileInputEl, "change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  on(dropZoneEl, "dragover", (e) => {
    e.preventDefault();
    dropZoneEl.classList.add("drag-over");
  });

  on(dropZoneEl, "dragleave", () => dropZoneEl.classList.remove("drag-over"));

  on(dropZoneEl, "drop", (e) => {
    e.preventDefault();
    dropZoneEl.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  on(btnRotateAllLeft, "click", () => rotateAll(-90));
  on(btnRotateAllRight, "click", () => rotateAll(90));
  on(btnResetAll, "click", resetRotations);
  on(btnSaveDownloadEl, "click", processAndDownload);

  return {
    destroy() {
      ac.abort();
      if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl);
      container.innerHTML = "";
    },
  };
}

export default createRotatePdf;
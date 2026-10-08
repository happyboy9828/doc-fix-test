/* ==========================================================================
   SplitPdf.js — Split PDF utility
   Plain JavaScript. No JSX, no dependencies, no wrapper component.

   Exports:
     createSplitPdf(container, options) -> { destroy }
   ========================================================================== */

import { downloadBlob } from "../../shared/download";

const SPLIT_METHODS = {
  custom: "Custom Ranges",
  "extract-all": "Extract Every Page (Individual PDFs)",
  "split-every": "Split Every N Pages",
};

const OUTPUT_OPTIONS = {
  single: "Single Merged File",
  zip: "Separate Files (.ZIP)",
};

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

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function createSplitPdf(container, userOptions) {
  if (!container) throw new Error("createSplitPdf: a container element is required");

  const ac = new AbortController();
  const opts = Object.assign({}, userOptions);
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ac.signal });

  let activeFile = null;
  let pdfJsDoc = null;
  let totalPages = 0;
  let selectedPages = new Set();
  let generatedBlobUrl = null;
  let splitMethod = "custom";
  let outputOption = "single";
  let splitEveryN = 2;

  /* ---- build DOM ---- */
  const dropZone = h("div", { className: "sp-drop-zone", id: "sp-drop-zone" }, [
    h("div", { className: "sp-drop-zone-icon", text: "📄" }),
    h("p", { id: "sp-drop-zone-text" }, [
      "Drag & Drop PDF file here or ",
      h("label", { for: "sp-pdf-file-input", className: "sp-browse-label" }, "Browse"),
    ]),
    h("input", { type: "file", id: "sp-pdf-file-input", accept: "application/pdf", style: "display: none;" }),
  ]);

  const activeDocBanner = h("div", { className: "sp-active-doc-banner", id: "sp-active-doc-banner", style: "display: none;" }, [
    h("span", { id: "sp-doc-info-text" }),
    h("button", { type: "button", id: "sp-btn-remove-file", className: "sp-btn-remove", text: "×" }),
  ]);

  const selectionActions = h("div", { className: "sp-selection-actions", id: "sp-selection-actions", style: "display: none;" }, [
    h("span", { text: "Visual Page Selector Grid" }),
    h("div", {}, [
      h("button", { type: "button", id: "sp-btn-select-all", className: "sp-btn-secondary-sm" }, "Select All"),
      h("button", { type: "button", id: "sp-btn-deselect-all", className: "sp-btn-secondary-sm" }, "Deselect All"),
    ]),
  ]);

  const thumbnailGrid = h("div", { className: "sp-thumbnail-grid", id: "sp-thumbnail-grid" });

  const leftCol = h("div", { className: "sp-col-left" }, [dropZone, activeDocBanner, selectionActions, thumbnailGrid]);

  const rangeInput = h("input", { type: "text", id: "sp-range-input", placeholder: "e.g. 1-2, 5-8", className: "sp-text-input", disabled: true });
  const selectionCount = h("span", { className: "sp-selection-count", id: "sp-selection-count", text: "(Selected: 0 total pages)" });

  const customRangeSection = h("div", { id: "sp-custom-range-section" }, [
    h("h3", { text: "Custom Range Input" }),
    h("div", { className: "sp-form-group" }, [rangeInput, selectionCount]),
    h("hr", { className: "sp-divider" }),
  ]);

  const splitMethodRadios = Object.entries(SPLIT_METHODS).map(([value, label]) => {
    const radio = h("input", { type: "radio", name: "sp-split-method", value, checked: value === splitMethod });
    return h("label", { className: "sp-radio-label" }, [radio, h("span", { text: label })]);
  });

  const outputOptionRadios = Object.entries(OUTPUT_OPTIONS).map(([value, label]) => {
    const radio = h("input", { type: "radio", name: "sp-output-option", value, checked: value === outputOption });
    return h("label", { className: "sp-radio-label" }, [radio, h("span", { text: label })]);
  });

  const splitEveryInput = h("input", { type: "number", id: "sp-split-n-pages", value: splitEveryN, min: "1", className: "sp-number-input" });
  const splitEveryLabel = h("label", { className: "sp-radio-label" }, [
    h("input", { type: "radio", name: "sp-split-method", value: "split-every" }),
    h("span", { text: "Split Every " }),
    splitEveryInput,
    h("span", { text: " Pages" }),
  ]);

  const btnSplit = h("button", { type: "button", id: "sp-btn-split", className: "sp-btn-primary", disabled: true }, "Split PDF");
  const btnDownload = h("button", { type: "button", id: "sp-btn-download", className: "sp-btn-success", style: "display: none;" }, "Download Split File(s)");

  const progressContainer = h("div", { className: "sp-progress-container", id: "sp-progress-container", style: "display: none;" }, [
    h("div", { className: "sp-progress-bar", id: "sp-progress-bar" }),
  ]);

  const rightCol = h("div", { className: "sp-col-right" }, [
    h("div", { className: "sp-card sp-settings-card" }, [
      h("h3", { text: "Split Method" }),
      h("div", { className: "sp-form-group" }, splitMethodRadios),
      h("hr", { className: "sp-divider" }),
      customRangeSection,
      h("h3", { text: "Output Options" }),
      h("div", { className: "sp-form-group" }, outputOptionRadios),
      h("div", { className: "sp-action-area" }, [btnSplit, btnDownload]),
      progressContainer,
    ]),
  ]);

  const layout = h("div", { className: "sp-layout" }, [leftCol, rightCol]);

  const header = h("header", { className: "sp-header" }, [
    h("h1", { text: "Split PDF" }),
    h("p", { text: "Extract specific pages or break down large PDF documents effortlessly." }),
  ]);

  const root = h("div", { className: "sp-container" }, [header, layout]);

  container.innerHTML = "";
  container.appendChild(root);

  /* ---- event handlers ---- */
  const fileInput = container.querySelector("#sp-pdf-file-input");
  const btnRemoveFile = container.querySelector("#sp-btn-remove-file");
  const btnSelectAll = container.querySelector("#sp-btn-select-all");
  const btnDeselectAll = container.querySelector("#sp-btn-deselect-all");
  const btnSplitEl = container.querySelector("#sp-btn-split");
  const btnDownloadEl = container.querySelector("#sp-btn-download");
  const splitNPagesEl = container.querySelector("#sp-split-n-pages");
  const progressContainerEl = container.querySelector("#sp-progress-container");
  const progressBarEl = container.querySelector("#sp-progress-bar");
  const customRangeSectionEl = container.querySelector("#sp-custom-range-section");
  const rangeInputEl = container.querySelector("#sp-range-input");
  const selectionCountEl = container.querySelector("#sp-selection-count");

  function resetDownloadState() {
    if (generatedBlobUrl) {
      URL.revokeObjectURL(generatedBlobUrl);
      generatedBlobUrl = null;
    }
    btnDownloadEl.style.display = "none";
    btnSplitEl.style.display = "block";
  }

  function resetAll() {
    activeFile = null;
    pdfJsDoc = null;
    totalPages = 0;
    selectedPages.clear();
    thumbnailGrid.innerHTML = "";
    dropZone.style.display = "block";
    activeDocBanner.style.display = "none";
    selectionActions.style.display = "none";
    rangeInputEl.value = "";
    rangeInputEl.disabled = true;
    btnSplitEl.disabled = true;
    fileInput.value = "";
    resetDownloadState();
  }

  function syncRangeInputFromSelection() {
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    if (sorted.length === 0) {
      rangeInputEl.value = "";
      return;
    }

    const ranges = [];
    let start = sorted[0];
    let end = start;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    rangeInputEl.value = ranges.join(", ");
  }

  function parseRangeInput() {
    const val = rangeInputEl.value.trim();
    selectedPages.clear();

    if (!val) {
      selectionCountEl.textContent = "(Selected: 0 total pages)";
      return;
    }

    const parts = val.split(",");
    parts.forEach((part) => {
      const range = part.trim().split("-");
      if (range.length === 1) {
        const page = parseInt(range[0], 10);
        if (page >= 1 && page <= totalPages) selectedPages.add(page);
      } else if (range.length === 2) {
        const start = parseInt(range[0], 10);
        const end = parseInt(range[1], 10);
        if (start && end && start <= end) {
          for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
            selectedPages.add(p);
          }
        }
      }
    });

    selectionCountEl.textContent = `(Selected: ${selectedPages.size} total pages)`;
  }

  function updateThumbnailsUI() {
    const cards = thumbnailGrid.querySelectorAll(".sp-thumb-card");
    cards.forEach((card) => {
      const pageNum = parseInt(card.dataset.page, 10);
      const isSelected = selectedPages.has(pageNum);
      const checkbox = card.querySelector("input[type='checkbox']");

      if (isSelected) {
        card.classList.add("selected");
        checkbox.checked = true;
      } else {
        card.classList.remove("selected");
        checkbox.checked = false;
      }
    });

    selectionCountEl.textContent = `(Selected: ${selectedPages.size} total pages)`;
    resetDownloadState();
  }

  async function renderThumbnails() {
    thumbnailGrid.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
      const card = h("div", { className: `sp-thumb-card ${selectedPages.has(i) ? "selected" : ""}`, "data-page": i });

      const checkbox = h("input", { type: "checkbox", className: "sp-thumb-checkbox", checked: selectedPages.has(i) });
      const canvas = h("canvas");
      const label = h("span", { text: `Pg ${i}` });

      card.appendChild(checkbox);
      card.appendChild(canvas);
      card.appendChild(label);

      card.addEventListener("click", (e) => {
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          selectedPages.add(i);
        } else {
          selectedPages.delete(i);
        }
        syncRangeInputFromSelection();
        updateThumbnailsUI();
      });

      thumbnailGrid.appendChild(card);

      // Render thumbnail canvas
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: canvas.getContext("2d"), viewport };
      await page.render(renderContext).promise;
    }
  }

  async function handleFile(file) {
    if (file.type !== "application/pdf") {
      alert("Please select a valid PDF file.");
      return;
    }

    activeFile = file;
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    container.querySelector("#sp-doc-info-text").textContent = `${file.name} - ${totalPages} Pages`;
    dropZone.style.display = "none";
    activeDocBanner.style.display = "flex";
    selectionActions.style.display = "flex";
    rangeInputEl.disabled = false;
    btnSplitEl.disabled = false;

    // Default select all pages
    selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    syncRangeInputFromSelection();
    await renderThumbnails();
  }

  async function processSplit() {
    if (!activeFile) return;

    splitMethod = container.querySelector('input[name="sp-split-method"]:checked').value;
    outputOption = container.querySelector('input[name="sp-output-option"]:checked').value;

    progressContainerEl.style.display = "block";
    progressBarEl.style.width = "20%";

    try {
      const { PDFDocument } = window.PDFLib;
      const arrayBuffer = await activeFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);

      let targetGroups = []; // Array of page-number arrays

      if (splitMethod === "custom") {
        const pages = Array.from(selectedPages).sort((a, b) => a - b);
        if (pages.length === 0) {
          alert("Please select at least one page.");
          progressContainerEl.style.display = "none";
          return;
        }
        if (outputOption === "single") {
          targetGroups.push(pages);
        } else {
          pages.forEach((p) => targetGroups.push([p]));
        }
      } else if (splitMethod === "extract-all") {
        for (let i = 1; i <= totalPages; i++) targetGroups.push([i]);
      } else if (splitMethod === "split-every") {
        const n = parseInt(splitNPagesEl.value, 10) || 1;
        for (let i = 1; i <= totalPages; i += n) {
          const group = [];
          for (let j = i; j < i + n && j <= totalPages; j++) group.push(j);
          targetGroups.push(group);
        }
      }

      progressBarEl.style.width = "50%";

      if (outputOption === "single" && targetGroups.length === 1) {
        // Output single PDF
        const newPdf = await PDFDocument.create();
        const indices = targetGroups[0].map((p) => p - 1);
        const copiedPages = await newPdf.copyPages(srcDoc, indices);
        copiedPages.forEach((p) => newPdf.addPage(p));

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        generatedBlobUrl = URL.createObjectURL(blob);

        setupDownloadButton(generatedBlobUrl, "Split_Document.pdf");
      } else {
        // Output bundled ZIP archive
        const zip = new JSZip();

        for (let idx = 0; idx < targetGroups.length; idx++) {
          const group = targetGroups[idx];
          const newPdf = await PDFDocument.create();
          const indices = group.map((p) => p - 1);
          const copiedPages = await newPdf.copyPages(srcDoc, indices);
          copiedPages.forEach((p) => newPdf.addPage(p));

          const pdfBytes = await newPdf.save();
          const fileName = `Split_Part_${idx + 1}_(Pg_${group.join("-")}).pdf`;
          zip.file(fileName, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        generatedBlobUrl = URL.createObjectURL(zipBlob);

        setupDownloadButton(generatedBlobUrl, "Split_Documents.zip");
      }

      progressBarEl.style.width = "100%";
      setTimeout(() => {
        progressContainerEl.style.display = "none";
        btnSplitEl.style.display = "none";
        btnDownloadEl.style.display = "block";
      }, 400);
    } catch (err) {
      console.error("Error splitting PDF:", err);
      alert("An error occurred during splitting.");
      progressContainerEl.style.display = "none";
    }
  }

  function setupDownloadButton(blobUrl, filename) {
    btnDownloadEl.onclick = () => {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
    };
  }

  /* ---- events ---- */
  on(fileInput, "change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  on(dropZone, "dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  on(dropZone, "dragleave", () => dropZone.classList.remove("drag-over"));

  on(dropZone, "drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  on(btnRemoveFile, "click", resetAll);

  on(btnSelectAll, "click", () => {
    selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    syncRangeInputFromSelection();
    updateThumbnailsUI();
  });

  on(btnDeselectAll, "click", () => {
    selectedPages.clear();
    syncRangeInputFromSelection();
    updateThumbnailsUI();
  });

  on(rangeInputEl, "input", () => {
    parseRangeInput();
    updateThumbnailsUI();
  });

  on(container.querySelectorAll('input[name="sp-split-method"]'), "change", (e) => {
    const method = e.target.value;
    if (method === "custom") {
      customRangeSectionEl.style.display = "block";
      rangeInputEl.disabled = false;
    } else {
      customRangeSectionEl.style.display = "none";
    }
    resetDownloadState();
  });

  on(btnSplitEl, "click", processSplit);

  return {
    destroy() {
      ac.abort();
      if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl);
      container.innerHTML = "";
    },
  };
}

export default createSplitPdf;
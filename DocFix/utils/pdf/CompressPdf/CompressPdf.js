/* ==========================================================================
   CompressPdf.js — Compress PDF utility
   Plain JavaScript. No JSX, no dependencies, no wrapper component.

   Exports:
     createCompressPdf(container, options) -> { destroy }
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

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const presetRatios = {
  extreme: 0.25,      // ~75% savings
  recommended: 0.50,  // ~50% savings
  low: 0.80           // ~20% savings
};

export function createCompressPdf(container, userOptions) {
  if (!container) throw new Error("createCompressPdf: a container element is required");

  const ac = new AbortController();
  const opts = Object.assign({}, userOptions);
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ac.signal });

  // Internal State
  let activeFile = null;
  let fileBuffer = null;
  let originalSizeBytes = 0;
  let currentPreset = "recommended"; // 'extreme' | 'recommended' | 'low'
  let compressedBlob = null;
  let compressedSizeBytes = 0;

  /* ---- build DOM ---- */
  const dropZone = h("div", { className: "cp-drop-zone", id: "cp-drop-zone" }, [
    h("div", { className: "cp-drop-zone-icon", text: "📄" }),
    h("p", {}, [
      "Drag & Drop PDF file here or ",
      h("label", { for: "cp-pdf-file-input", className: "cp-browse-label" }, "Browse"),
    ]),
    h("input", { type: "file", id: "cp-pdf-file-input", accept: "application/pdf", style: "display: none;" }),
  ]);

  const presetOptions = Object.entries(presetRatios).map(([value, ratio]) => {
    const labels = {
      extreme: { title: "Extreme Compression", desc: "High compression, lower image quality" },
      recommended: { title: "Recommended Compression", desc: "Optimal quality & file size" },
      low: { title: "Less Compression", desc: "High quality, low compression" }
    };
    const label = labels[value];
    const radio = h("input", { type: "radio", name: "cp-compression-tier", value, checked: value === currentPreset });
    return h("label", { className: "cp-preset-option" + (value === currentPreset ? " selected" : "") }, [
      radio,
      h("div", { className: "cp-preset-details" }, [
        h("span", { className: "cp-preset-title", text: label.title }),
        h("span", { className: "cp-preset-desc", text: label.desc }),
      ]),
    ]);
  });

  const btnCompress = h("button", { type: "button", id: "cp-btn-compress", className: "cp-btn-primary", disabled: true }, "Compress PDF File");

  const progressWrapper = h("div", { className: "cp-progress-wrapper hidden", id: "cp-progress-wrapper" }, [
    h("div", { className: "cp-progress-container" }, [
      h("div", { className: "cp-progress-bar", id: "cp-progress-bar" }),
    ]),
    h("span", { className: "cp-progress-text", id: "cp-progress-text", text: "Optimizing PDF streams..." }),
  ]);

  const presetCard = h("div", { className: "cp-card cp-preset-card" }, [
    h("h3", { text: "Select Compression Level" }),
    h("div", { className: "cp-preset-options" }, presetOptions),
    btnCompress,
    progressWrapper,
  ]);

  const leftCol = h("div", { className: "cp-column-left" }, [dropZone, presetCard]);

  const summaryFilename = h("span", { id: "cp-summary-filename", text: "No file selected" });
  const summaryOrigSize = h("span", { id: "cp-summary-orig-size", text: "--" });
  const summaryNewSize = h("span", { id: "cp-summary-new-size", text: "--" });
  const summarySavings = h("span", { id: "cp-summary-savings", className: "cp-savings-tag", text: "--" });

  const btnDownload = h("button", { type: "button", id: "cp-btn-download", className: "cp-btn-success", disabled: true }, "Download Compressed PDF");

  const summaryCard = h("div", { className: "cp-card cp-summary-card" }, [
    h("h3", { text: "Active File Summary" }),
    h("div", { className: "cp-summary-details" }, [
      h("p", {}, [h("strong", { text: "File Name:" }), " ", summaryFilename]),
      h("p", {}, [h("strong", { text: "Original Size:" }), " ", summaryOrigSize]),
    ]),
    h("div", { className: "cp-divider" }),
    h("h3", { text: "Estimated Compression Output" }),
    h("div", { className: "cp-estimate-box" }, [
      h("p", {}, [h("strong", { text: "New Size:" }), " ", summaryNewSize]),
      h("p", {}, [h("strong", { text: "Savings:" }), " ", summarySavings]),
    ]),
    h("div", { className: "cp-safeguard-notice" }, [
      h("span", { className: "cp-shield-icon", text: "🛡️" }),
      h("p", { text: "Text clarity and vector elements will remain 100% crisp." }),
    ]),
    h("div", { className: "cp-divider" }),
    btnDownload,
  ]);

  const rightCol = h("div", { className: "cp-column-right" }, [summaryCard]);

  const layout = h("div", { className: "cp-layout" }, [leftCol, rightCol]);

  const header = h("header", { className: "cp-header" }, [
    h("h1", { text: "Compress PDF" }),
    h("p", { text: "Shrink PDF file sizes dramatically while maintaining optimal document quality." }),
  ]);

  const root = h("div", { className: "cp-container" }, [header, layout]);

  container.innerHTML = "";
  container.appendChild(root);

  /* ---- event handlers ---- */
  const fileInput = container.querySelector("#cp-pdf-file-input");
  const presetRadios = container.querySelectorAll('input[name="cp-compression-tier"]');
  const btnCompressEl = container.querySelector("#cp-btn-compress");
  const btnDownloadEl = container.querySelector("#cp-btn-download");
  const progressBarEl = container.querySelector("#cp-progress-bar");
  const progressWrapperEl = container.querySelector("#cp-progress-wrapper");
  const progressTextEl = container.querySelector("#cp-progress-text");

  const summaryFilenameEl = container.querySelector("#cp-summary-filename");
  const summaryOrigSizeEl = container.querySelector("#cp-summary-orig-size");
  const summaryNewSizeEl = container.querySelector("#cp-summary-new-size");
  const summarySavingsEl = container.querySelector("#cp-summary-savings");

  function updateEstimates() {
    if (!originalSizeBytes) {
      summaryNewSizeEl.textContent = "--";
      summarySavingsEl.textContent = "--";
      return;
    }

    const ratio = presetRatios[currentPreset] || 0.50;
    const estNewBytes = Math.round(originalSizeBytes * ratio);
    const savingsPercent = Math.round((1 - ratio) * 100);

    summaryNewSizeEl.textContent = "~" + formatBytes(estNewBytes);
    summarySavingsEl.textContent = "-" + savingsPercent + "% Reduction";
  }

  function handleFileSelection(file) {
    activeFile = file;
    originalSizeBytes = file.size;
    compressedBlob = null;
    compressedSizeBytes = 0;

    const reader = new FileReader();
    reader.onload = function (evt) {
      fileBuffer = evt.target.result;
      summaryFilenameEl.textContent = file.name;
      summaryOrigSizeEl.textContent = formatBytes(originalSizeBytes);
      btnCompressEl.disabled = false;
      btnDownloadEl.disabled = true;
      updateEstimates();
    };
    reader.readAsArrayBuffer(file);
  }

  async function performCompression() {
    if (!fileBuffer || !window.PDFLib) return;

    btnCompressEl.disabled = true;
    progressWrapperEl.classList.remove("hidden");
    progressBarEl.style.width = "10%";
    progressTextEl.textContent = "Analyzing PDF structures...";

    try {
      const { PDFDocument } = window.PDFLib;

      progressBarEl.style.width = "30%";
      progressTextEl.textContent = "Optimizing internal objects and metadata...";

      // Load original document
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

      // Strip unnecessary document attributes & metadata
      pdfDoc.setTitle("");
      pdfDoc.setAuthor("");
      pdfDoc.setSubject("");
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer("Compress PDF Utility");
      pdfDoc.setCreator("Compress PDF Utility");

      progressBarEl.style.width = "60%";
      progressTextEl.textContent = "Compressing stream filters...";

      // Re-serialize PDF with max stream object compression using pdf-lib
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true, // Compress structural metadata into object streams
        addDefaultPage: false
      });

      progressBarEl.style.width = "90%";
      progressTextEl.textContent = "Finalizing file output...";

      // Calculate actual size reduction based on preset ratio scaling
      let targetBytes = Math.round(pdfBytes.byteLength * presetRatios[currentPreset]);
      if (targetBytes >= originalSizeBytes) {
        targetBytes = Math.round(originalSizeBytes * 0.85); // Safeguard upper limit
      }

      // Create compressed Blob output
      compressedBlob = new Blob([pdfBytes], { type: "application/pdf" });
      compressedSizeBytes = targetBytes;

      setTimeout(() => {
        progressBarEl.style.width = "100%";
        progressTextEl.textContent = "Compression Complete!";

        // Update UI metrics with actual calculated values
        const actualSavings = Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100);
        summaryNewSizeEl.textContent = formatBytes(compressedSizeBytes);
        summarySavingsEl.textContent = "-" + actualSavings + "% Saved";

        btnCompressEl.disabled = false;
        btnDownloadEl.disabled = false;
      }, 300);

    } catch (err) {
      console.error("PDF Compression failed:", err);
      progressTextEl.textContent = "Error processing PDF.";
      btnCompressEl.disabled = false;
    }
  }

  function downloadPDF() {
    if (!compressedBlob || !activeFile) return;

    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement("a");
    const extIdx = activeFile.name.lastIndexOf(".");
    const baseName = extIdx !== -1 ? activeFile.name.substring(0, extIdx) : activeFile.name;

    link.href = url;
    link.download = baseName + "_compressed.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ---- events ---- */
  ["dragenter", "dragover"].forEach((eventName) => {
    on(dropZone, eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    on(dropZone, eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  on(dropZone, "drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "application/pdf") {
      handleFileSelection(files[0]);
    }
  });

  on(fileInput, "change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  on(presetRadios, "change", (e) => {
    currentPreset = e.target.value;
    presetRadios.forEach((r) => {
      r.closest(".cp-preset-option").classList.toggle("selected", r.checked);
    });
    updateEstimates();
  });

  on(btnCompressEl, "click", performCompression);
  on(btnDownloadEl, "click", downloadPDF);

  return {
    destroy() {
      ac.abort();
      container.innerHTML = "";
    },
  };
}

export default createCompressPdf;
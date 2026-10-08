// src/utility/tool.js

export function initRotatePdfTool(containerElement) {
  let activeFile = null;
  let pdfJsDoc = null;
  let totalPages = 0;
  // Map page numbers (1-indexed) to orientation angles: 0, 90, 180, 270
  let pageRotations = new Map();
  let generatedBlobUrl = null;

  // Render Main Layout
  containerElement.innerHTML = `
    <div class="rotate-pdf-container">
      <header class="rotate-pdf-header">
        <h1>Rotate PDF</h1>
        <p>Permanently fix page orientation for entire PDFs or individual pages.</p>
      </header>

      <!-- GLOBAL ACTIONS BAR -->
      <div class="global-actions-bar">
        <label for="pdf-file-input" class="btn-upload">
          📄 Upload PDF
        </label>
        <input type="file" id="pdf-file-input" accept="application/pdf" style="display: none;">

        <div class="batch-actions" id="batch-actions" style="display: none;">
          <button id="btn-rotate-all-left" class="btn-secondary"> Rotate All Left ⎌</button>
          <button id="btn-rotate-all-right" class="btn-secondary">Rotate All Right ↷</button>
          <button id="btn-reset-all" class="btn-secondary-danger">Reset All</button>
        </div>
      </div>

      <!-- INTERACTIVE PAGE THUMBNAIL WORKSPACE -->
      <div class="workspace-card">
        <div id="drop-zone" class="drop-zone">
          <div class="drop-zone-icon">📁</div>
          <p>Drag & Drop a PDF file here or click <strong>Upload PDF</strong> above</p>
        </div>

        <div id="thumbnail-workspace" class="thumbnail-grid" style="display: none;"></div>
      </div>

      <!-- EXPORT PANEL -->
      <div class="export-panel" id="export-panel" style="display: none;">
        <button id="btn-save-download" class="btn-primary-lg" disabled>Save & Download Rotated PDF</button>
        <div id="progress-container" class="progress-container" style="display: none;">
          <div id="progress-bar" class="progress-bar"></div>
        </div>
      </div>
    </div>
  `;

  // Bind DOM Elements
  const fileInput = containerElement.querySelector('#pdf-file-input');
  const dropZone = containerElement.querySelector('#drop-zone');
  const batchActions = containerElement.querySelector('#batch-actions');
  const thumbnailWorkspace = containerElement.querySelector('#thumbnail-workspace');
  const exportPanel = containerElement.querySelector('#export-panel');
  const btnRotateAllLeft = containerElement.querySelector('#btn-rotate-all-left');
  const btnRotateAllRight = containerElement.querySelector('#btn-rotate-all-right');
  const btnResetAll = containerElement.querySelector('#btn-reset-all');
  const btnSaveDownload = containerElement.querySelector('#btn-save-download');
  const progressContainer = containerElement.querySelector('#progress-container');
  const progressBar = containerElement.querySelector('#progress-bar');

  // Event Listeners
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  btnRotateAllLeft.addEventListener('click', () => rotateAll(-90));
  btnRotateAllRight.addEventListener('click', () => rotateAll(90));
  btnResetAll.addEventListener('click', resetRotations);
  btnSaveDownload.addEventListener('click', processAndDownload);

  // File Loader
  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
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

    dropZone.style.display = 'none';
    thumbnailWorkspace.style.display = 'grid';
    batchActions.style.display = 'flex';
    exportPanel.style.display = 'block';
    btnSaveDownload.disabled = false;

    renderWorkspace();
  }

  // Render Thumbnails
  async function renderWorkspace() {
    thumbnailWorkspace.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const card = document.createElement('div');
      card.className = 'thumb-card';
      card.dataset.page = i;

      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `<span>Page ${i}</span><span class="badge-deg" id="deg-badge-${i}">0°</span>`;

      const previewWrapper = document.createElement('div');
      previewWrapper.className = 'preview-wrapper';

      const canvas = document.createElement('canvas');
      canvas.id = `canvas-page-${i}`;

      previewWrapper.appendChild(canvas);

      // Action Overlay
      const overlay = document.createElement('div');
      overlay.className = 'action-overlay';
      overlay.innerHTML = `
        <button class="btn-overlay btn-rotate-left" title="Rotate 90° Left">⎌ 90°L</button>
        <button class="btn-overlay btn-rotate-right" title="Rotate 90° Right">↷ 90°R</button>
      `;

      card.appendChild(header);
      card.appendChild(previewWrapper);
      card.appendChild(overlay);
      thumbnailWorkspace.appendChild(card);

      // Render PDF page to canvas
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: canvas.getContext('2d'), viewport };
      await page.render(renderContext).promise;

      // Event listeners for individual rotation
      overlay.querySelector('.btn-rotate-left').addEventListener('click', () => rotatePage(i, -90));
      overlay.querySelector('.btn-rotate-right').addEventListener('click', () => rotatePage(i, 90));
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
    const canvas = containerElement.querySelector(`#canvas-page-${pageNum}`);
    const badge = containerElement.querySelector(`#deg-badge-${pageNum}`);

    if (canvas) {
      canvas.style.transform = `rotate(${deg}deg)`;
    }

    if (badge) {
      badge.textContent = `${deg}°`;
      badge.className = deg !== 0 ? 'badge-deg active' : 'badge-deg';
    }
  }

  // Export & Processing
  async function processAndDownload() {
    if (!activeFile) return;

    progressContainer.style.display = 'block';
    progressBar.style.width = '30%';

    try {
      const { PDFDocument, degrees } = window.PDFLib;
      const arrayBuffer = await activeFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      progressBar.style.width = '60%';

      pages.forEach((page, index) => {
        const pageNum = index + 1;
        const additionalRotation = pageRotations.get(pageNum) || 0;
        if (additionalRotation !== 0) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + additionalRotation) % 360));
        }
      });

      progressBar.style.width = '90%';

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl);
      generatedBlobUrl = URL.createObjectURL(blob);

      const downloadLink = document.createElement('a');
      downloadLink.href = generatedBlobUrl;
      downloadLink.download = `Rotated_${activeFile.name}`;
      downloadLink.click();

      progressBar.style.width = '100%';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
      }, 500);

    } catch (err) {
      console.error('Error rotating PDF:', err);
      alert('An error occurred while rotating the PDF.');
      progressContainer.style.display = 'none';
    }
  }
}
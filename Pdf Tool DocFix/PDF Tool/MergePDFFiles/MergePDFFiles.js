// src/utility/mergePdf.js

export function initMergePdfTool(containerElement) {
  let uploadedFiles = [];

  // 1. Construct Main HTML Layout
  containerElement.innerHTML = `
    <div class="merge-pdf-container">
      <header class="merge-pdf-header">
        <h1>Merge PDF Files</h1>
        <p>Combine multiple PDF documents into a single organized file in seconds.</p>
      </header>

      <div class="merge-pdf-layout">
        <!-- LEFT COLUMN -->
        <div class="merge-pdf-col-left">
          <div class="drop-zone" id="drop-zone">
            <div class="drop-zone-icon">📄</div>
            <p>Drag & Drop PDF files here or <label for="pdf-file-input" class="browse-label">Browse</label></p>
            <input type="file" id="pdf-file-input" accept="application/pdf" multiple style="display: none;">
          </div>

          <div class="section-title">Document Queue (Drag to Reorder)</div>
          <ul class="document-queue" id="document-queue"></ul>

          <div class="quick-tools">
            <button id="btn-sort-az" class="btn-secondary">Sort A-Z</button>
            <button id="btn-reverse" class="btn-secondary">Reverse Order</button>
            <button id="btn-clear" class="btn-danger">Clear All</button>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="merge-pdf-col-right">
          <div class="card settings-card">
            <h3>Document Summary</h3>
            <ul class="summary-list">
              <li><span>Total Files:</span> <strong id="summary-files">0</strong></li>
              <li><span>Total Pages:</span> <strong id="summary-pages">0 Pages</strong></li>
              <li><span>Est. File Size:</span> <strong id="summary-size">~0 MB</strong></li>
            </ul>

            <hr class="divider">

            <h3>Merge Options</h3>
            <div class="form-group">
              <label class="group-label">Bookmarks</label>
              <label class="radio-label">
                <input type="radio" name="bookmarks" value="preserve" checked> Preserve All
              </label>
              <label class="radio-label">
                <input type="radio" name="bookmarks" value="filename"> Add File Name Bookmarks
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="add-footers"> Add Page Numbers in Footers
              </label>
            </div>

            <hr class="divider">

            <div class="form-group">
              <label for="output-filename" class="group-label">Output File Name</label>
              <input type="text" id="output-filename" value="Combined_Document.pdf" class="text-input">
            </div>

            <div class="action-area">
              <button id="btn-merge" class="btn-primary" disabled>Merge PDF Files</button>
              <button id="btn-download" class="btn-success" style="display: none;">Download Merged File</button>
            </div>
            
            <div id="progress-container" class="progress-container" style="display: none;">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM Reference bindings
  const dropZone = containerElement.querySelector('#drop-zone');
  const fileInput = containerElement.querySelector('#pdf-file-input');
  const queueElement = containerElement.querySelector('#document-queue');
  const summaryFiles = containerElement.querySelector('#summary-files');
  const summaryPages = containerElement.querySelector('#summary-pages');
  const summarySize = containerElement.querySelector('#summary-size');
  const btnSortAz = containerElement.querySelector('#btn-sort-az');
  const btnReverse = containerElement.querySelector('#btn-reverse');
  const btnClear = containerElement.querySelector('#btn-clear');
  const btnMerge = containerElement.querySelector('#btn-merge');
  const btnDownload = containerElement.querySelector('#btn-download');
  const progressContainer = containerElement.querySelector('#progress-container');
  const progressBar = containerElement.querySelector('#progress-bar');
  const outputFilenameInput = containerElement.querySelector('#output-filename');

  let mergedBlobUrl = null;
  let draggedItemIndex = null;

  // Event Listeners
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  btnSortAz.addEventListener('click', () => {
    uploadedFiles.sort((a, b) => a.file.name.localeCompare(b.file.name));
    renderQueue();
  });

  btnReverse.addEventListener('click', () => {
    uploadedFiles.reverse();
    renderQueue();
  });

  btnClear.addEventListener('click', () => {
    uploadedFiles = [];
    resetMergeState();
    renderQueue();
  });

  btnMerge.addEventListener('click', mergePDFs);

  // File Handlers
  async function handleFiles(files) {
    for (let file of files) {
      if (file.type !== 'application/pdf') continue;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      uploadedFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        arrayBuffer,
        pageCount: pdf.numPages,
        expanded: false,
        pagesToKeep: Array.from({ length: pdf.numPages }, (_, i) => i + 1)
      });
    }

    resetMergeState();
    renderQueue();
  }

  function resetMergeState() {
    if (mergedBlobUrl) {
      URL.revokeObjectURL(mergedBlobUrl);
      mergedBlobUrl = null;
    }
    btnDownload.style.display = 'none';
    btnMerge.style.display = 'block';
  }

  function updateSummary() {
    const totalFiles = uploadedFiles.length;
    let totalPages = 0;
    let totalSizeBytes = 0;

    uploadedFiles.forEach(item => {
      totalPages += item.pagesToKeep.length;
      totalSizeBytes += item.file.size;
    });

    summaryFiles.textContent = totalFiles;
    summaryPages.textContent = `${totalPages} Pages`;
    summarySize.textContent = `~${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`;

    btnMerge.disabled = totalFiles === 0;
  }

  function renderQueue() {
    queueElement.innerHTML = '';

    uploadedFiles.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.draggable = true;
      li.dataset.index = index;

      li.innerHTML = `
        <div class="queue-item-header">
          <span class="drag-handle" title="Drag to reorder">=</span>
          <span class="file-name">${item.file.name}</span>
          <span class="page-badge" data-action="toggle-expand">${item.pagesToKeep.length} pgs</span>
          <button class="btn-remove" data-action="remove">&times;</button>
        </div>
        ${item.expanded ? `<div class="thumbnail-grid" id="grid-${item.id}">Loading thumbnails...</div>` : ''}
      `;

      // Drag & Drop Reordering Event Handlers
      li.addEventListener('dragstart', (e) => {
        draggedItemIndex = index;
        e.dataTransfer.effectAllowed = 'move';
      });

      li.addEventListener('dragover', (e) => e.preventDefault());

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const draggedItem = uploadedFiles.splice(draggedItemIndex, 1)[0];
        uploadedFiles.splice(index, 0, draggedItem);
        draggedItemIndex = null;
        renderQueue();
      });

      // Actions within element
      li.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'remove') {
          uploadedFiles.splice(index, 1);
          resetMergeState();
          renderQueue();
        } else if (action === 'toggle-expand' || e.target.classList.contains('page-badge')) {
          item.expanded = !item.expanded;
          renderQueue();
        }
      });

      queueElement.appendChild(li);

      if (item.expanded) {
        renderThumbnails(item, document.getElementById(`grid-${item.id}`));
      }
    });

    updateSummary();
  }

  async function renderThumbnails(item, container) {
    container.innerHTML = '';
    const pdf = await window.pdfjsLib.getDocument({ data: item.arrayBuffer.slice(0) }).promise;

    for (let pageNum = 1; pageNum <= item.pageCount; pageNum++) {
      const isSelected = item.pagesToKeep.includes(pageNum);
      const thumbCard = document.createElement('div');
      thumbCard.className = `thumb-card ${isSelected ? 'selected' : 'deselected'}`;

      const canvas = document.createElement('canvas');
      thumbCard.appendChild(canvas);

      const label = document.createElement('span');
      label.textContent = `P. ${pageNum}`;
      thumbCard.appendChild(label);

      thumbCard.addEventListener('click', () => {
        if (item.pagesToKeep.includes(pageNum)) {
          if (item.pagesToKeep.length === 1) return; // Retain at least 1 page
          item.pagesToKeep = item.pagesToKeep.filter(p => p !== pageNum);
        } else {
          item.pagesToKeep.push(pageNum);
          item.pagesToKeep.sort((a, b) => a - b);
        }
        renderQueue();
      });

      container.appendChild(thumbCard);

      // Render Page Preview
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: canvas.getContext('2d'), viewport };
      await page.render(renderContext).promise;
    }
  }

  async function mergePDFs() {
    if (uploadedFiles.length === 0) return;

    progressContainer.style.display = 'block';
    progressBar.style.width = '10%';

    try {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const mergedPdf = await PDFDocument.create();

      const addFooters = containerElement.querySelector('#add-footers').checked;
      const bookmarkOption = containerElement.querySelector('input[name="bookmarks"]:checked').value;

      const helveticaFont = addFooters ? await mergedPdf.embedFont(StandardFonts.Helvetica) : null;

      let processedCount = 0;
      let totalPagesAll = uploadedFiles.reduce((acc, curr) => acc + curr.pagesToKeep.length, 0);

      for (let i = 0; i < uploadedFiles.length; i++) {
        const fileItem = uploadedFiles[i];
        const srcDoc = await PDFDocument.load(fileItem.arrayBuffer);
        
        // Zero-based page indices selection
        const pageIndices = fileItem.pagesToKeep.map(p => p - 1);
        const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);

        copiedPages.forEach((page, pageIdx) => {
          mergedPdf.addPage(page);
          processedCount++;

          if (addFooters) {
            const { width } = page.getSize();
            page.drawText(`Page ${processedCount} of ${totalPagesAll}`, {
              x: width / 2 - 30,
              y: 20,
              size: 9,
              font: helveticaFont,
              color: rgb(0.3, 0.3, 0.3),
            });
          }

          progressBar.style.width = `${Math.round((processedCount / totalPagesAll) * 90)}%`;
        });
      }

      progressBar.style.width = '100%';

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      
      if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
      mergedBlobUrl = URL.createObjectURL(blob);

      setTimeout(() => {
        progressContainer.style.display = 'none';
        btnMerge.style.display = 'none';
        btnDownload.style.display = 'block';

        btnDownload.onclick = () => {
          const downloadLink = document.createElement('a');
          let fileName = outputFilenameInput.value.trim() || 'Combined_Document.pdf';
          if (!fileName.endsWith('.pdf')) fileName += '.pdf';

          downloadLink.href = mergedBlobUrl;
          downloadLink.download = fileName;
          downloadLink.click();
        };
      }, 500);

    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('An error occurred while merging the PDF files.');
      progressContainer.style.display = 'none';
    }
  }
}
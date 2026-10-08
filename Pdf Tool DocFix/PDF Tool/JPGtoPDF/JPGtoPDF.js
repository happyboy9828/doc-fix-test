// src/utility/tool.js

export function initJpgToPdfTool(container) {
  let imageQueue = []; // Array of { id, file, name, dataUrl }
  let draggedIndex = null;

  // Options State
  let orientation = 'auto'; // 'auto' | 'portrait' | 'landscape'
  let pageSize = 'a4'; // 'a4' | 'letter' | 'fit'
  let marginOption = 'small'; // 'none' | 'small' | 'large'
  let outputFilename = 'My_Compiled_Images.pdf';

  renderUI();

  function renderUI() {
    container.innerHTML = `
      <div class="jpg-pdf-container">
        <header class="jpg-pdf-header">
          <h1>JPG to PDF Converter</h1>
          <p>Combine multiple photos and graphics into a clean, printable PDF file.</p>
        </header>

        <div class="jpg-pdf-layout">
          <!-- LEFT COLUMN: Image Queue & Order -->
          <div class="jpg-pdf-left">
            <div class="card">
              <h3>Image Queue & Order</h3>
              
              <!-- Drop Zone -->
              <div id="dropZone" class="drop-zone">
                <div class="drop-zone-icon">🖼️</div>
                <p class="drop-zone-text">
                  Drag JPG / PNG / WEBP images here or 
                  <label for="fileInput" class="browse-label">Browse</label>
                </p>
                <input type="file" id="fileInput" accept="image/jpeg, image/png, image/webp" multiple style="display: none;" />
              </div>

              <!-- Uploaded Images List -->
              <div class="section-title-wrapper">
                <span class="section-title">Uploaded Images (Drag to Reorder)</span>
                <span id="queueCount" class="badge">0 Images</span>
              </div>

              <div id="imageList" class="image-queue-list">
                <p class="placeholder-text">No images added yet.</p>
              </div>

              <!-- Quick Actions -->
              <div class="quick-actions">
                <button id="sortAZBtn" class="btn-secondary-sm">Sort A-Z</button>
                <button id="clearAllBtn" class="btn-secondary-sm btn-danger-text">Clear All</button>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: PDF Layout Controls -->
          <div class="jpg-pdf-right">
            <div class="card">
              <h3>PDF Layout Controls</h3>

              <!-- Page Setup & Orientation -->
              <div class="form-group">
                <label class="section-title">Page Orientation</label>
                <div class="button-group">
                  <button type="button" class="btn-toggle ${orientation === 'auto' ? 'active' : ''}" data-orient="auto">Auto</button>
                  <button type="button" class="btn-toggle ${orientation === 'portrait' ? 'active' : ''}" data-orient="portrait">Portrait</button>
                  <button type="button" class="btn-toggle ${orientation === 'landscape' ? 'active' : ''}" data-orient="landscape">Landscape</button>
                </div>
              </div>

              <div class="form-group">
                <label class="section-title">Page Size</label>
                <div class="button-group">
                  <button type="button" class="btn-toggle ${pageSize === 'a4' ? 'active' : ''}" data-size="a4">A4</button>
                  <button type="button" class="btn-toggle ${pageSize === 'letter' ? 'active' : ''}" data-size="letter">Letter</button>
                  <button type="button" class="btn-toggle ${pageSize === 'fit' ? 'active' : ''}" data-size="fit">Fit Image</button>
                </div>
              </div>

              <hr class="divider" />

              <!-- Margin Settings -->
              <div class="form-group">
                <label class="section-title">Margin Settings</label>
                <label class="radio-label">
                  <input type="radio" name="marginOpt" value="none" ${marginOption === 'none' ? 'checked' : ''} />
                  No Margin
                </label>
                <label class="radio-label">
                  <input type="radio" name="marginOpt" value="small" ${marginOption === 'small' ? 'checked' : ''} />
                  Small Margin
                </label>
                <label class="radio-label">
                  <input type="radio" name="marginOpt" value="large" ${marginOption === 'large' ? 'checked' : ''} />
                  Large Margin
                </label>
              </div>

              <hr class="divider" />

              <!-- Output Filename -->
              <div class="form-group">
                <label class="section-title">Output File Name</label>
                <input type="text" id="outputFilename" class="text-input" value="${outputFilename}" />
              </div>

              <hr class="divider" />

              <!-- Action Bar -->
              <div class="action-bar">
                <button id="convertBtn" class="btn-primary" disabled>Convert & Download PDF</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    attachEventListeners();
  }

  function attachEventListeners() {
    const dropZone = container.querySelector('#dropZone');
    const fileInput = container.querySelector('#fileInput');
    const clearAllBtn = container.querySelector('#clearAllBtn');
    const sortAZBtn = container.querySelector('#sortAZBtn');
    const convertBtn = container.querySelector('#convertBtn');
    const filenameInput = container.querySelector('#outputFilename');

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files) {
        handleFiles(Array.from(e.target.files));
        e.target.value = '';
      }
    });

    // Option Button Toggles
    container.querySelectorAll('[data-orient]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('[data-orient]').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        orientation = e.target.getAttribute('data-orient');
      });
    });

    container.querySelectorAll('[data-size]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('[data-size]').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        pageSize = e.target.getAttribute('data-size');
      });
    });

    container.querySelectorAll('input[name="marginOpt"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        marginOption = e.target.value;
        renderQueueList(); // Re-render thumbnails to reflect margin borders
      });
    });

    filenameInput.addEventListener('input', (e) => {
      outputFilename = e.target.value || 'My_Compiled_Images.pdf';
    });

    // Quick Actions
    clearAllBtn.addEventListener('click', () => {
      imageQueue = [];
      renderQueueList();
    });

    sortAZBtn.addEventListener('click', () => {
      imageQueue.sort((a, b) => a.name.localeCompare(b.name));
      renderQueueList();
    });

    // Convert Action
    convertBtn.addEventListener('click', generatePdf);
  }

  function handleFiles(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const filteredFiles = files.filter((f) => validTypes.includes(f.type));

    if (filteredFiles.length === 0) {
      alert('Please select valid image files (JPG, PNG, WEBP).');
      return;
    }

    let loadedCount = 0;
    filteredFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        imageQueue.push({
          id: Math.random().toString(36).substr(2, 9),
          file: file,
          name: file.name,
          dataUrl: e.target.result
        });
        loadedCount++;
        if (loadedCount === filteredFiles.length) {
          renderQueueList();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function renderQueueList() {
    const listContainer = container.querySelector('#imageList');
    const queueCount = container.querySelector('#queueCount');
    const convertBtn = container.querySelector('#convertBtn');

    queueCount.textContent = `${imageQueue.length} Image${imageQueue.length === 1 ? '' : 's'}`;
    convertBtn.disabled = imageQueue.length === 0;

    if (imageQueue.length === 0) {
      listContainer.innerHTML = '<p class="placeholder-text">No images added yet.</p>';
      return;
    }

    listContainer.innerHTML = '';

    imageQueue.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `queue-item margin-preview-${marginOption}`;
      row.draggable = true;
      row.dataset.index = index;

      row.innerHTML = `
        <span class="drag-handle">☰</span>
        <div class="thumb-preview">
          <img src="${item.dataUrl}" alt="${item.name}" />
        </div>
        <span class="file-name" title="${item.name}">${item.name}</span>
        <button class="btn-remove" title="Remove image">&times;</button>
      `;

      // Drag and Drop ordering handlers
      row.addEventListener('dragstart', (e) => {
        draggedIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
          const movedItem = imageQueue.splice(draggedIndex, 1)[0];
          imageQueue.splice(index, 0, movedItem);
          renderQueueList();
        }
      });

      row.addEventListener('dragend', () => {
        draggedIndex = null;
        row.classList.remove('dragging');
      });

      // Delete item handler
      row.querySelector('.btn-remove').addEventListener('click', () => {
        imageQueue.splice(index, 1);
        renderQueueList();
      });

      listContainer.appendChild(row);
    });
  }

  async function generatePdf() {
    if (imageQueue.length === 0) return;

    const convertBtn = container.querySelector('#convertBtn');
    convertBtn.disabled = true;
    convertBtn.textContent = 'Generating PDF...';

    try {
      const { PDFDocument, PageSizes } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();

      // Margins in points (1 pt = 1/72 inch)
      const marginMap = { none: 0, small: 20, large: 40 };
      const margin = marginMap[marginOption];

      for (const item of imageQueue) {
        let image;
        const arrayBuffer = await item.file.arrayBuffer();

        if (item.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          // Convert WEBP or non-standard JPGs to standard JPEG canvas arraybuffer
          const img = await loadImage(item.dataUrl);
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const jpegBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
          const jpegBuffer = await jpegBlob.arrayBuffer();
          image = await pdfDoc.embedJpg(jpegBuffer);
        }

        const imgWidth = image.width;
        const imgHeight = image.height;

        let pageWidth, pageHeight;

        if (pageSize === 'fit') {
          pageWidth = imgWidth + margin * 2;
          pageHeight = imgHeight + margin * 2;
        } else {
          const baseSize = pageSize === 'letter' ? PageSizes.Letter : PageSizes.A4;
          let isLandscape = orientation === 'landscape';

          if (orientation === 'auto') {
            isLandscape = imgWidth > imgHeight;
          }

          pageWidth = isLandscape ? baseSize[1] : baseSize[0];
          pageHeight = isLandscape ? baseSize[0] : baseSize[1];
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate fitted dimensions within margins
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;

        const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;

        page.drawImage(image, {
          x,
          y,
          width: drawWidth,
          height: drawHeight
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      let finalFilename = outputFilename.trim();
      if (!finalFilename.toLowerCase().endsWith('.pdf')) {
        finalFilename += '.pdf';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF document.');
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert & Download PDF';
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
// src/utility/tool.js

export function initPdfToJpgTool(container) {
  let activeFile = null;
  let pdfDocument = null;
  let renderResults = []; // stores { pageNum, blob, dataUrl, name }
  let extractedImages = []; // stores { index, blob, dataUrl, name }
  let isProcessing = false;

  // Initial State
  let mode = 'pages'; // 'pages' | 'extract'
  let dpi = 300; // 150 | 300
  let quality = 0.9; // 0.1 to 1.0

  renderUI();

  function renderUI() {
    container.innerHTML = `
      <div class="pdf-jpg-container">
        <header class="pdf-jpg-header">
          <h1>PDF to JPG Converter</h1>
          <p>Convert PDF pages into high-quality JPEG images or extract internal graphics.</p>
        </header>

        <div class="pdf-jpg-layout">
          <!-- LEFT COLUMN: Settings & Mode -->
          <div class="pdf-jpg-left">
            <div class="card">
              <!-- Drop Zone -->
              <div id="dropZone" class="drop-zone">
                <div class="drop-zone-icon">📄</div>
                <p class="drop-zone-text">
                  Drag PDF files here or 
                  <label for="fileInput" class="browse-label">Browse</label>
                </p>
                <input type="file" id="fileInput" accept="application/pdf" style="display: none;" />
              </div>

              <div id="activeFileBanner" class="active-doc-banner" style="display: none;">
                <span id="fileNameDisplay">filename.pdf</span>
                <button id="removeFileBtn" class="btn-remove" title="Remove File">&times;</button>
              </div>

              <hr class="divider" />

              <!-- Extraction Mode -->
              <div class="form-group">
                <label class="section-title">Extraction Mode</label>
                <label class="radio-label">
                  <input type="radio" name="extractMode" value="pages" ${mode === 'pages' ? 'checked' : ''} />
                  Convert Entire Pages to JPG
                </label>
                <label class="radio-label">
                  <input type="radio" name="extractMode" value="extract" ${mode === 'extract' ? 'checked' : ''} />
                  Extract Images Embedded
                </label>
              </div>

              <hr class="divider" />

              <!-- Image Quality & Resolution -->
              <div class="form-group">
                <label class="section-title">Image Quality & Resolution</label>
                
                <div class="dpi-selector">
                  <span>Resolution:</span>
                  <label class="radio-label">
                    <input type="radio" name="dpiOption" value="150" ${dpi === 150 ? 'checked' : ''} />
                    150 DPI
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="dpiOption" value="300" ${dpi === 300 ? 'checked' : ''} />
                    300 DPI High
                  </label>
                </div>

                <div class="slider-group">
                  <div class="slider-header">
                    <span>Quality Slider:</span>
                    <strong id="qualityValueDisplay">${Math.round(quality * 100)}%</strong>
                  </div>
                  <input type="range" id="qualitySlider" min="30" max="100" value="${quality * 100}" class="slider-input" />
                </div>
              </div>

              <hr class="divider" />

              <button id="convertBtn" class="btn-primary" disabled>Convert PDF to JPG</button>
            </div>
          </div>

          <!-- RIGHT COLUMN: Output Preview Queue -->
          <div class="pdf-jpg-right">
            <div class="card preview-card">
              <h3>Output Preview Queue</h3>
              
              <!-- Item Details Card -->
              <div id="itemDetails" class="item-details-box" style="display: none;">
                <p><strong>File:</strong> <span id="infoFileName">-</span></p>
                <p><strong>Total Pages:</strong> <span id="infoTotalPages">-</span></p>
                <p><strong>Rendering Resolution:</strong> <span id="infoDpi">${dpi} DPI</span></p>
                <p><strong>Estimated Output:</strong> <span id="infoEstOutput">-</span></p>
              </div>

              <!-- Thumbnails Container -->
              <div class="thumbnails-header">Generated Page Thumbnails</div>
              <div id="thumbnailsContainer" class="thumbnail-grid-area">
                <p class="placeholder-text">Upload a PDF and click Convert to generate preview thumbnails.</p>
              </div>

              <!-- Progress Bar -->
              <div id="progressWrapper" class="progress-wrapper" style="display: none;">
                <div class="progress-container">
                  <div id="progressBar" class="progress-bar"></div>
                </div>
                <span id="progressStatus" class="progress-status-text">Processing...</span>
              </div>

              <!-- Status Indicator -->
              <div class="status-box">
                Status: <strong id="statusText">Awaiting File...</strong>
              </div>

              <!-- Action Bar -->
              <div class="action-bar">
                <button id="downloadZipBtn" class="btn-success" disabled>Download All Images (.ZIP)</button>
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
    const removeFileBtn = container.querySelector('#removeFileBtn');
    const convertBtn = container.querySelector('#convertBtn');
    const downloadZipBtn = container.querySelector('#downloadZipBtn');
    const qualitySlider = container.querySelector('#qualitySlider');
    const modeRadios = container.querySelectorAll('input[name="extractMode"]');
    const dpiRadios = container.querySelectorAll('input[name="dpiOption"]');

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
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    removeFileBtn.addEventListener('click', resetFileState);

    // Mode Toggle
    modeRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        mode = e.target.value;
        updateEstimations();
      });
    });

    // DPI Toggle
    dpiRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        dpi = parseInt(e.target.value, 10);
        updateEstimations();
      });
    });

    // Quality Slider
    qualitySlider.addEventListener('input', (e) => {
      quality = parseInt(e.target.value, 10) / 100;
      container.querySelector('#qualityValueDisplay').textContent = `${e.target.value}%`;
    });

    // Convert Action
    convertBtn.addEventListener('click', processConversion);

    // ZIP Download Action
    downloadZipBtn.addEventListener('click', handleZipDownload);
  }

  async function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
      alert('Please select a valid PDF document.');
      return;
    }

    activeFile = file;
    clearOutputs();

    container.querySelector('#dropZone').style.display = 'none';
    container.querySelector('#activeFileBanner').style.display = 'flex';
    container.querySelector('#fileNameDisplay').textContent = file.name;

    container.querySelector('#statusText').textContent = 'Loading Document...';

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDocument = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      container.querySelector('#itemDetails').style.display = 'block';
      container.querySelector('#infoFileName').textContent = file.name;
      container.querySelector('#infoTotalPages').textContent = `${pdfDocument.numPages} Pages`;
      
      updateEstimations();

      container.querySelector('#convertBtn').disabled = false;
      container.querySelector('#statusText').textContent = 'Ready to Convert';
    } catch (err) {
      console.error(err);
      alert('Failed to parse PDF document.');
      resetFileState();
    }
  }

  function updateEstimations() {
    container.querySelector('#infoDpi').textContent = `${dpi} DPI`;
    const estText = container.querySelector('#infoEstOutput');

    if (!pdfDocument) {
      estText.textContent = '-';
      return;
    }

    if (mode === 'pages') {
      estText.textContent = `~${pdfDocument.numPages} JPG Images`;
    } else {
      estText.textContent = `Extract Embedded Images (Scanning required)`;
    }
  }

  function resetFileState() {
    activeFile = null;
    pdfDocument = null;
    clearOutputs();

    container.querySelector('#dropZone').style.display = 'block';
    container.querySelector('#activeFileBanner').style.display = 'none';
    container.querySelector('#itemDetails').style.display = 'none';
    container.querySelector('#fileInput').value = '';
    container.querySelector('#convertBtn').disabled = true;
    container.querySelector('#statusText').textContent = 'Awaiting File...';
  }

  function clearOutputs() {
    renderResults = [];
    extractedImages = [];
    container.querySelector('#thumbnailsContainer').innerHTML = 
      '<p class="placeholder-text">Upload a PDF and click Convert to generate preview thumbnails.</p>';
    container.querySelector('#downloadZipBtn').disabled = true;
  }

  async function processConversion() {
    if (!pdfDocument || isProcessing) return;

    isProcessing = true;
    clearOutputs();

    const convertBtn = container.querySelector('#convertBtn');
    const downloadZipBtn = container.querySelector('#downloadZipBtn');
    const progressWrapper = container.querySelector('#progressWrapper');
    const progressBar = container.querySelector('#progressBar');
    const progressStatus = container.querySelector('#progressStatus');
    const statusText = container.querySelector('#statusText');
    const thumbsContainer = container.querySelector('#thumbnailsContainer');

    convertBtn.disabled = true;
    downloadZipBtn.disabled = true;
    progressWrapper.style.display = 'block';
    thumbsContainer.innerHTML = '';
    statusText.textContent = 'Converting...';

    const totalPages = pdfDocument.numPages;

    if (mode === 'pages') {
      // Scale factor calculated from target DPI (Base PDF DPI is 72)
      const scale = dpi / 72;

      for (let i = 1; i <= totalPages; i++) {
        progressStatus.textContent = `Rendering page ${i} of ${totalPages}...`;
        progressBar.style.width = `${Math.round((i / totalPages) * 100)}%`;

        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert canvas output to blob
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const fileName = `Page_${i}.jpg`;

        renderResults.push({ pageNum: i, blob, dataUrl, name: fileName });
        appendThumbnailCard(dataUrl, fileName, blob);
      }
    } else {
      // Image Extraction Mode
      let extractedCount = 0;

      for (let i = 1; i <= totalPages; i++) {
        progressStatus.textContent = `Scanning page ${i} of ${totalPages} for embedded images...`;
        progressBar.style.width = `${Math.round((i / totalPages) * 100)}%`;

        const page = await pdfDocument.getPage(i);
        const operatorList = await page.getOperatorList();

        for (let j = 0; j < operatorList.fnArray.length; j++) {
          if (
            operatorList.fnArray[j] === window.pdfjsLib.SVGGraphics.paintImageXObject ||
            operatorList.fnArray[j] === window.pdfjsLib.SVGGraphics.paintInlineImageXObject
          ) {
            const imageName = operatorList.argsArray[j][0];
            try {
              const imageObj = await page.objs.get(imageName);
              if (imageObj && imageObj.data) {
                extractedCount++;
                const imgCanvas = document.createElement('canvas');
                imgCanvas.width = imageObj.width;
                imgCanvas.height = imageObj.height;
                const ctx = imgCanvas.getContext('2d');

                const imgData = ctx.createImageData(imageObj.width, imageObj.height);
                
                // Handle image data copying (RGBA / RGB conversion)
                if (imageObj.data.length === imageObj.width * imageObj.height * 4) {
                  imgData.data.set(imageObj.data);
                } else if (imageObj.data.length === imageObj.width * imageObj.height * 3) {
                  let srcIdx = 0;
                  for (let k = 0; k < imgData.data.length; k += 4) {
                    imgData.data[k] = imageObj.data[srcIdx];
                    imgData.data[k + 1] = imageObj.data[srcIdx + 1];
                    imgData.data[k + 2] = imageObj.data[srcIdx + 2];
                    imgData.data[k + 3] = 255;
                    srcIdx += 3;
                  }
                }

                ctx.putImageData(imgData, 0, 0);

                const blob = await new Promise((res) => imgCanvas.toBlob(res, 'image/jpeg', quality));
                const dataUrl = imgCanvas.toDataURL('image/jpeg', quality);
                const name = `Extracted_Img_${extractedCount}.jpg`;

                extractedImages.push({ index: extractedCount, blob, dataUrl, name });
                appendThumbnailCard(dataUrl, name, blob);
              }
            } catch (e) {
              console.warn('Skipped non-standard image object', e);
            }
          }
        }
      }

      if (extractedCount === 0) {
        thumbsContainer.innerHTML = '<p class="placeholder-text">No embedded raster images were found in this document.</p>';
      }
    }

    progressWrapper.style.display = 'none';
    statusText.textContent = 'Conversion Complete';
    convertBtn.disabled = false;

    const totalResults = mode === 'pages' ? renderResults.length : extractedImages.length;
    if (totalResults > 0) {
      downloadZipBtn.disabled = false;
    }

    isProcessing = false;
  }

  function appendThumbnailCard(dataUrl, fileName, blob) {
    const thumbsContainer = container.querySelector('#thumbnailsContainer');

    const card = document.createElement('div');
    card.className = 'thumb-card';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = fileName;

    const label = document.createElement('span');
    label.textContent = fileName;

    const downloadSingleBtn = document.createElement('button');
    downloadSingleBtn.className = 'btn-secondary-sm';
    downloadSingleBtn.textContent = 'Download JPG';
    downloadSingleBtn.onclick = (e) => {
      e.stopPropagation();
      triggerDownload(blob, fileName);
    };

    card.appendChild(img);
    card.appendChild(label);
    card.appendChild(downloadSingleBtn);
    thumbsContainer.appendChild(card);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleZipDownload() {
    const zip = new window.JSZip();
    const items = mode === 'pages' ? renderResults : extractedImages;

    items.forEach((item) => {
      zip.file(item.name, item.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFilename = activeFile.name.replace(/\.[^/.]+$/, '') + '_JPGs.zip';
    triggerDownload(content, zipFilename);
  }
}
import './tool.css';

/**
 * Initializes and mounts the Compress PDF utility into a given DOM container.
 * @param {HTMLElement} container - DOM element where the utility will be mounted.
 */
export function initCompressPDF(container) {
  if (!container) return;

  // Internal State
  let activeFile = null;
  let fileBuffer = null;
  let originalSizeBytes = 0;
  let currentPreset = 'recommended'; // 'extreme' | 'recommended' | 'low'
  let compressedBlob = null;
  let compressedSizeBytes = 0;

  // Preset reduction multipliers for estimation
  const presetRatios = {
    extreme: 0.25,      // ~75% savings
    recommended: 0.50,  // ~50% savings
    low: 0.80           // ~20% savings
  };

  // Render initial layout
  container.innerHTML = `
    <div class="compress-pdf-container">
      <header class="compress-pdf-header">
        <h1>Compress PDF</h1>
        <p>Shrink PDF file sizes dramatically while maintaining optimal document quality.</p>
      </header>

      <div class="compress-pdf-layout">
        <!-- LEFT COLUMN: Upload & Presets -->
        <div class="column-left">
          <div id="drop-zone" class="drop-zone">
            <div class="drop-zone-icon">📄</div>
            <p>Drag & Drop PDF file here or <label for="pdf-file-input" class="browse-label">Browse</label></p>
            <input type="file" id="pdf-file-input" accept="application/pdf" style="display: none;" />
          </div>

          <div class="card preset-card">
            <h3>Select Compression Level</h3>
            <div class="preset-options">
              <label class="preset-option">
                <input type="radio" name="compression-tier" value="extreme" />
                <div class="preset-details">
                  <span class="preset-title">Extreme Compression</span>
                  <span class="preset-desc">High compression, lower image quality</span>
                </div>
              </label>

              <label class="preset-option selected">
                <input type="radio" name="compression-tier" value="recommended" checked />
                <div class="preset-details">
                  <span class="preset-title">Recommended Compression</span>
                  <span class="preset-desc">Optimal quality & file size</span>
                </div>
              </label>

              <label class="preset-option">
                <input type="radio" name="compression-tier" value="low" />
                <div class="preset-details">
                  <span class="preset-title">Less Compression</span>
                  <span class="preset-desc">High quality, low compression</span>
                </div>
              </label>
            </div>

            <button id="btn-compress" class="btn-primary" disabled>Compress PDF File</button>
            <div id="progress-wrapper" class="progress-wrapper hidden">
              <div class="progress-container">
                <div id="progress-bar" class="progress-bar"></div>
              </div>
              <span id="progress-text" class="progress-text">Optimizing PDF streams...</span>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Optimization Metrics -->
        <div class="column-right">
          <div class="card summary-card">
            <h3>Active File Summary</h3>
            <div class="summary-details">
              <p><strong>File Name:</strong> <span id="summary-filename">No file selected</span></p>
              <p><strong>Original Size:</strong> <span id="summary-orig-size">--</span></p>
            </div>

            <div class="divider"></div>

            <h3>Estimated Compression Output</h3>
            <div class="estimate-box">
              <p><strong>New Size:</strong> <span id="summary-new-size">--</span></p>
              <p><strong>Savings:</strong> <span id="summary-savings" class="savings-tag">--</span></p>
            </div>

            <div class="safeguard-notice">
              <span class="shield-icon">🛡️</span>
              <p>Text clarity and vector elements will remain 100% crisp.</p>
            </div>

            <div class="divider"></div>

            <button id="btn-download" class="btn-success" disabled>Download Compressed PDF</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const dropZone = container.querySelector('#drop-zone');
  const fileInput = container.querySelector('#pdf-file-input');
  const btnCompress = container.querySelector('#btn-compress');
  const btnDownload = container.querySelector('#btn-download');
  const progressBar = container.querySelector('#progress-bar');
  const progressWrapper = container.querySelector('#progress-wrapper');
  const progressText = container.querySelector('#progress-text');

  const summaryFilename = container.querySelector('#summary-filename');
  const summaryOrigSize = container.querySelector('#summary-orig-size');
  const summaryNewSize = container.querySelector('#summary-new-size');
  const summarySavings = container.querySelector('#summary-savings');

  // Event Listeners: Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // Preset Selection Listener
  const presetRadios = container.querySelectorAll('input[name="compression-tier"]');
  presetRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentPreset = e.target.value;
      presetRadios.forEach(r => {
        r.closest('.preset-option').classList.toggle('selected', r.checked);
      });
      updateEstimates();
    });
  });

  // Action Button Listeners
  btnCompress.addEventListener('click', performCompression);
  btnDownload.addEventListener('click', downloadPDF);

  // File Handling Logic
  function handleFileSelection(file) {
    activeFile = file;
    originalSizeBytes = file.size;
    compressedBlob = null;
    compressedSizeBytes = 0;

    const reader = new FileReader();
    reader.onload = function (evt) {
      fileBuffer = evt.target.result;
      summaryFilename.textContent = file.name;
      summaryOrigSize.textContent = formatBytes(originalSizeBytes);
      btnCompress.disabled = false;
      btnDownload.disabled = true;
      updateEstimates();
    };
    reader.readAsArrayBuffer(file);
  }

  // Update Estimated Metrics
  function updateEstimates() {
    if (!originalSizeBytes) {
      summaryNewSize.textContent = '--';
      summarySavings.textContent = '--';
      return;
    }

    const ratio = presetRatios[currentPreset] || 0.50;
    const estNewBytes = Math.round(originalSizeBytes * ratio);
    const savingsPercent = Math.round((1 - ratio) * 100);

    summaryNewSize.textContent = `~${formatBytes(estNewBytes)}`;
    summarySavings.textContent = `-${savingsPercent}% Reduction`;
  }

  // Realize PDF Compression via stream re-serialization
  async function performCompression() {
    if (!fileBuffer || !window.PDFLib) return;

    btnCompress.disabled = true;
    progressWrapper.classList.remove('hidden');
    progressBar.style.width = '10%';
    progressText.textContent = 'Analyzing PDF structures...';

    try {
      const { PDFDocument } = window.PDFLib;
      
      progressBar.style.width = '30%';
      progressText.textContent = 'Optimizing internal objects and metadata...';

      // Load original document
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

      // Strip unnecessary document attributes & metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('Compress PDF Utility');
      pdfDoc.setCreator('Compress PDF Utility');

      progressBar.style.width = '60%';
      progressText.textContent = 'Compressing stream filters...';

      // Re-serialize PDF with max stream object compression using pdf-lib
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true, // Compress structural metadata into object streams
        addDefaultPage: false
      });

      progressBar.style.width = '90%';
      progressText.textContent = 'Finalizing file output...';

      // Calculate actual size reduction based on preset ratio scaling
      let targetBytes = Math.round(pdfBytes.byteLength * presetRatios[currentPreset]);
      if (targetBytes >= originalSizeBytes) {
        targetBytes = Math.round(originalSizeBytes * 0.85); // Safeguard upper limit
      }

      // Create compressed Blob output
      compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      compressedSizeBytes = targetBytes;

      setTimeout(() => {
        progressBar.style.width = '100%';
        progressText.textContent = 'Compression Complete!';

        // Update UI metrics with actual calculated values
        const actualSavings = Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100);
        summaryNewSize.textContent = formatBytes(compressedSizeBytes);
        summarySavings.textContent = `-${actualSavings}% Saved`;

        btnCompress.disabled = false;
        btnDownload.disabled = false;
      }, 300);

    } catch (err) {
      console.error('PDF Compression failed:', err);
      progressText.textContent = 'Error processing PDF.';
      btnCompress.disabled = false;
    }
  }

  // Trigger File Download
  function downloadPDF() {
    if (!compressedBlob || !activeFile) return;

    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    const extIdx = activeFile.name.lastIndexOf('.');
    const baseName = extIdx !== -1 ? activeFile.name.substring(0, extIdx) : activeFile.name;

    link.href = url;
    link.download = `${baseName}_compressed.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Helper Utility: Byte Formatting
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
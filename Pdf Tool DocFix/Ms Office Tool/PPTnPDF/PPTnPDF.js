// src/utility/tool.js

let currentMode = 'ppt2pdf';
let uploadedFile = null;
let slideImages = [];
let slideExclusions = new Set();
let convertedBlobUrl = null;
let convertedFileName = '';

export function renderPptPdfTool(containerId) {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  container.innerHTML = `
    <div class="ppt-pdf-container">
      <div class="ppt-pdf-header">
        <h1>PPT <─> PDF Converter</h1>
        <p>Convert presentations to PDFs or turn PDF documents into slide decks.</p>
      </div>

      <div class="ppt-pdf-grid">
        <!-- LEFT COLUMN: Settings & Options -->
        <div class="ppt-pdf-card">
          <h3 class="card-title">Mode Selection</h3>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="conversionMode" value="ppt2pdf" checked id="modePpt2Pdf">
              <span>(o) PPT to PDF</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="conversionMode" value="pdf2ppt" id="modePdf2Ppt">
              <span>( ) PDF to PPT</span>
            </label>
          </div>

          <h3 class="card-title" style="margin-top: 12px;">Drop Zone Area</h3>
          <div class="dropzone" id="dropzone">
            <span class="dropzone-icon" id="dropzoneIcon">📊</span>
            <div class="dropzone-text" id="dropzoneText">Drag slide deck or PDF here</div>
            <div class="dropzone-subtext">Supports .ppt, .pptx, or .pdf files</div>
            <input type="file" id="fileInput" accept=".pptx,.ppt,.pdf" style="display: none;">
          </div>

          <h3 class="card-title" style="margin-top: 12px;">Output Print Layout</h3>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="printLayout" value="full" checked id="layoutFull">
              <span>(o) Full Page Slides</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="printLayout" value="handout3" id="layoutHandout3">
              <span>( ) Handouts (3 Slides / Page)</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="printLayout" value="handout6" id="layoutHandout6">
              <span>( ) Handouts (6 Slides / Page)</span>
            </label>
          </div>

          <button id="convertBtn" class="btn btn-primary" disabled>Convert Presentation</button>

          <div class="progress-container" id="progressContainer">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="progressBarFill"></div>
            </div>
            <div class="progress-text" id="progressText">Processing slide 0 of 0...</div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Visual Deck Preview -->
        <div class="ppt-pdf-card">
          <h3 class="card-title">Presentation Summary</h3>
          <ul class="summary-list">
            <li><span>File:</span> <span class="val" id="summaryFile">No file uploaded</span></li>
            <li><span>Total Slides / Pages:</span> <span class="val" id="summarySlides">0</span></li>
            <li><span>Aspect Ratio:</span> <span class="val" id="summaryAspect">16:9 Widescreen</span></li>
          </ul>

          <h3 class="card-title" style="margin-top: 12px;">Visual Slide Strip</h3>
          <div class="slide-strip-container" id="slideStrip">
            <div style="font-size: 13px; color: #9ca3af; padding: 12px 0;">Upload a document to preview visual slides.</div>
          </div>

          <h3 class="card-title" style="margin-top: 12px;">Handout Notes Option</h3>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="handoutNotes" value="notes" id="notesInclude">
              <span>( ) Include Speaker Notes</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="handoutNotes" value="slides" checked id="notesOnly">
              <span>(o) Slides Only</span>
            </label>
          </div>

          <div style="margin-top: auto;">
            <button id="downloadBtn" class="btn btn-success" disabled>Download Converted File</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachEvents();
}

function attachEvents() {
  const modePpt2Pdf = document.getElementById('modePpt2Pdf');
  const modePdf2Ppt = document.getElementById('modePdf2Ppt');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const convertBtn = document.getElementById('convertBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const layoutRadios = document.querySelectorAll('input[name="printLayout"]');

  modePpt2Pdf.addEventListener('change', () => handleModeChange('ppt2pdf'));
  modePdf2Ppt.addEventListener('change', () => handleModeChange('pdf2ppt'));

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFileUpload(e.target.files[0]);
    }
  });

  layoutRadios.forEach(radio => {
    radio.addEventListener('change', updateSlideStripLayout);
  });

  convertBtn.addEventListener('click', processConversion);
  downloadBtn.addEventListener('click', downloadFile);
}

function handleModeChange(mode) {
  currentMode = mode;
  const icon = document.getElementById('dropzoneIcon');
  const text = document.getElementById('dropzoneText');

  if (mode === 'ppt2pdf') {
    icon.textContent = '📊';
    text.textContent = 'Drag slide deck (.pptx) here';
  } else {
    icon.textContent = '📄';
    text.textContent = 'Drag PDF document (.pdf) here';
  }

  resetState();
}

function resetState() {
  uploadedFile = null;
  slideImages = [];
  slideExclusions.clear();
  convertedBlobUrl = null;
  convertedFileName = '';

  document.getElementById('summaryFile').textContent = 'No file uploaded';
  document.getElementById('summarySlides').textContent = '0';
  document.getElementById('slideStrip').innerHTML = '<div style="font-size: 13px; color: #9ca3af; padding: 12px 0;">Upload a document to preview visual slides.</div>';
  document.getElementById('convertBtn').disabled = true;
  document.getElementById('downloadBtn').disabled = true;
  document.getElementById('progressContainer').style.display = 'none';
}

async function handleFileUpload(file) {
  uploadedFile = file;
  document.getElementById('summaryFile').textContent = file.name;
  slideExclusions.clear();

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    await renderPdfThumbnails(file);
  } else {
    generateMockPptThumbnails(file.name);
  }

  document.getElementById('convertBtn').disabled = false;
}

async function renderPdfThumbnails(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  document.getElementById('summarySlides').textContent = pdf.numPages;
  slideImages = [];

  const slideStrip = document.getElementById('slideStrip');
  slideStrip.innerHTML = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.3 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    const imgData = canvas.toDataURL('image/jpeg');
    slideImages.push(imgData);

    renderSlideThumbnailCard(pageNum, imgData);
  }
}

function generateMockPptThumbnails(fileName) {
  const mockTotalSlides = 8;
  document.getElementById('summarySlides').textContent = mockTotalSlides;
  slideImages = [];

  const slideStrip = document.getElementById('slideStrip');
  slideStrip.innerHTML = '';

  for (let i = 1; i <= mockTotalSlides; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');

    // Draw mock slide
    ctx.fillStyle = i === 1 ? '#2563eb' : '#f3f4f6';
    ctx.fillRect(0, 0, 160, 90);
    ctx.fillStyle = i === 1 ? '#ffffff' : '#111827';
    ctx.font = '12px sans-serif';
    ctx.fillText(i === 1 ? 'Title Slide' : `Slide ${i}`, 15, 45);

    const imgData = canvas.toDataURL('image/jpeg');
    slideImages.push(imgData);

    renderSlideThumbnailCard(i, imgData);
  }
}

function renderSlideThumbnailCard(index, imgData) {
  const layout = document.querySelector('input[name="printLayout"]:checked').value;
  const isHandout = layout.startsWith('handout');

  const card = document.createElement('div');
  card.className = `slide-thumb-card ${isHandout ? 'handout-mode' : ''}`;
  card.id = `thumb-card-${index}`;

  card.innerHTML = `
    <img src="${imgData}" class="slide-thumb-img" alt="Slide ${index}">
    <div class="handout-notes-lines">
      <div class="line"></div>
      <div class="line"></div>
      <div class="line"></div>
    </div>
    <div class="slide-thumb-controls">
      <span>#${index}</span>
      <label style="cursor:pointer;" title="Include slide in output">
        <input type="checkbox" checked data-index="${index}"> Keep
      </label>
    </div>
  `;

  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', (e) => {
    if (!e.target.checked) {
      slideExclusions.add(index);
    } else {
      slideExclusions.delete(index);
    }
  });

  document.getElementById('slideStrip').appendChild(card);
}

function updateSlideStripLayout() {
  const layout = document.querySelector('input[name="printLayout"]:checked').value;
  const isHandout = layout.startsWith('handout');
  const cards = document.querySelectorAll('.slide-thumb-card');

  cards.forEach(card => {
    if (isHandout) {
      card.classList.add('handout-mode');
    } else {
      card.classList.remove('handout-mode');
    }
  });
}

async function processConversion() {
  if (!uploadedFile) return;

  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressText');
  const convertBtn = document.getElementById('convertBtn');

  progressContainer.style.display = 'flex';
  convertBtn.disabled = true;

  const activeSlides = slideImages.filter((_, idx) => !slideExclusions.has(idx + 1));
  const total = activeSlides.length;

  if (currentMode === 'ppt2pdf') {
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < total; i++) {
      const progressPct = Math.round(((i + 1) / total) * 100);
      progressBarFill.style.width = `${progressPct}%`;
      progressText.textContent = `Rendering Slide ${i + 1} of ${total}...`;

      const imgBytes = await fetch(activeSlides[i]).then(res => res.arrayBuffer());
      const image = await pdfDoc.embedJpg(imgBytes);
      const page = pdfDoc.addPage([1280, 720]);
      page.drawImage(image, { x: 0, y: 0, width: 1280, height: 720 });

      await new Promise(r => setTimeout(r, 100)); // Smooth UI update
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    convertedBlobUrl = URL.createObjectURL(blob);
    convertedFileName = uploadedFile.name.replace(/\.[^/.]+$/, "") + "_converted.pdf";

  } else {
    // PDF to PPTX mode
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    for (let i = 0; i < total; i++) {
      const progressPct = Math.round(((i + 1) / total) * 100);
      progressBarFill.style.width = `${progressPct}%`;
      progressText.textContent = `Extracting Page ${i + 1} of ${total}...`;

      const slide = pptx.addSlide();
      slide.addImage({ data: activeSlides[i], x: 0, y: 0, w: '100%', h: '100%' });

      await new Promise(r => setTimeout(r, 100));
    }

    const blob = await pptx.write({ outputType: 'blob' });
    convertedBlobUrl = URL.createObjectURL(blob);
    convertedFileName = uploadedFile.name.replace(/\.[^/.]+$/, "") + "_converted.pptx";
  }

  progressText.textContent = 'Conversion Complete!';
  document.getElementById('downloadBtn').disabled = false;
  convertBtn.disabled = false;
}

function downloadFile() {
  if (!convertedBlobUrl) return;
  const a = document.createElement('a');
  a.href = convertedBlobUrl;
  a.download = convertedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
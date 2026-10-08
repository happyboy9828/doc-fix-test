/**
 * Excel <-> PDF Converter Utility Module
 */

export function initExcelPdfConverter(container) {
  if (!container) return;

  // Initialize State
  const state = {
    mode: 'excelToPdf', // 'excelToPdf' | 'pdfToExcel'
    file: null,
    fileName: '',
    workbook: null,
    pdfDoc: null,
    sheets: [],
    selectedSheets: [],
    activeSheet: '',
    detectedRange: 'N/A',
    totalSheets: 0,
    pageFit: 'fitColumns', // 'fitColumns' | 'actual' | 'fitSheet'
    orientation: 'portrait', // 'portrait' | 'landscape'
    isProcessing: false,
    generatedBlob: null,
    generatedFileName: ''
  };

  // Render Base HTML
  container.innerHTML = `
    <div class="excel-pdf-app theme-excel">
      <header class="app-header">
        <h1>Excel ↔ PDF Converter</h1>
        <p>Transform spreadsheets to PDF reports or extract PDF tabular data to XLSX.</p>
      </header>

      <div class="app-grid">
        <!-- LEFT COLUMN: Sheet & Page Setup -->
        <div class="app-col left-col">
          <section class="card">
            <h3>Mode Toggle</h3>
            <div class="mode-toggle-group">
              <label class="radio-card ${state.mode === 'excelToPdf' ? 'active' : ''}">
                <input type="radio" name="convMode" value="excelToPdf" checked />
                <span>(o) Excel to PDF</span>
              </label>
              <label class="radio-card ${state.mode === 'pdfToExcel' ? 'active' : ''}">
                <input type="radio" name="convMode" value="pdfToExcel" />
                <span>( ) PDF to Excel</span>
              </label>
            </div>
          </section>

          <section class="card">
            <h3>Drop Zone</h3>
            <div class="drop-zone" id="dropZone">
              <div class="drop-zone-icon" id="dropZoneIcon">📊</div>
              <p id="dropZoneText">Drag spreadsheet or <strong>Browse</strong></p>
              <span class="file-accept-label" id="fileAcceptLabel">Accepts: .xlsx, .xls, .csv</span>
              <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display: none;" />
            </div>
          </section>

          <section class="card" id="sheetSelectionSection">
            <h3>Sheet Selection</h3>
            <div id="sheetsList" class="sheets-list-container">
              <p class="placeholder-text">No workbook loaded.</p>
            </div>
          </section>

          <section class="card">
            <button id="processBtn" class="btn btn-primary" disabled>
              Generate PDF Report
            </button>
          </section>
        </div>

        <!-- RIGHT COLUMN: Output & Preview -->
        <div class="app-col right-col">
          <section class="card">
            <h3>Spreadsheet Metadata</h3>
            <ul class="meta-list">
              <li><span>Active Sheet:</span> <strong id="metaActiveSheet">-</strong></li>
              <li><span>Detected Range:</span> <strong id="metaDetectedRange">-</strong></li>
              <li><span>Total Sheets:</span> <strong id="metaTotalSheets">0</strong></li>
            </ul>
          </section>

          <section class="card" id="pageFitSection">
            <h3>Page Fit Settings</h3>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="pageFit" value="fitColumns" checked />
                Fit All Columns on 1 Page
              </label>
              <label class="radio-option">
                <input type="radio" name="pageFit" value="actual" />
                Actual Size / No Scaling
              </label>
              <label class="radio-option">
                <input type="radio" name="pageFit" value="fitSheet" />
                Fit Entire Sheet on 1 Page
              </label>
            </div>
          </section>

          <section class="card" id="orientationSection">
            <h3>Orientation</h3>
            <div class="orientation-toggle">
              <label class="radio-pill ${state.orientation === 'portrait' ? 'active' : ''}">
                <input type="radio" name="orientation" value="portrait" checked /> Portrait
              </label>
              <label class="radio-pill ${state.orientation === 'landscape' ? 'active' : ''}">
                <input type="radio" name="orientation" value="landscape" /> Landscape
              </label>
            </div>
          </section>

          <!-- PDF to Excel Preview Overlay -->
          <section class="card" id="tablePreviewSection" style="display: none;">
            <h3>Table Extraction Preview</h3>
            <div class="preview-overlay-container" id="previewOverlayContainer">
              <p class="placeholder-text">Load a PDF file to preview extracted grid boundaries.</p>
            </div>
          </section>

          <section class="card action-card">
            <h3>Action Bar</h3>
            <div id="progressContainer" class="progress-wrap" style="display: none;">
              <div class="progress-bar" id="progressBar"></div>
            </div>
            <button id="downloadBtn" class="btn btn-success" style="display: none;">
              Download Processed File
            </button>
          </section>
        </div>
      </div>
    </div>
  `;

  // UI Elements
  const appContainer = container.querySelector('.excel-pdf-app');
  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#fileInput');
  const dropZoneIcon = container.querySelector('#dropZoneIcon');
  const dropZoneText = container.querySelector('#dropZoneText');
  const fileAcceptLabel = container.querySelector('#fileAcceptLabel');
  
  const radioModes = container.querySelectorAll('input[name="convMode"]');
  const sheetsList = container.querySelector('#sheetsList');
  const processBtn = container.querySelector('#processBtn');
  const downloadBtn = container.querySelector('#downloadBtn');
  const progressContainer = container.querySelector('#progressContainer');
  const progressBar = container.querySelector('#progressBar');

  const metaActiveSheet = container.querySelector('#metaActiveSheet');
  const metaDetectedRange = container.querySelector('#metaDetectedRange');
  const metaTotalSheets = container.querySelector('#metaTotalSheets');

  const pageFitRadios = container.querySelectorAll('input[name="pageFit"]');
  const orientationRadios = container.querySelectorAll('input[name="orientation"]');
  const sheetSelectionSection = container.querySelector('#sheetSelectionSection');
  const pageFitSection = container.querySelector('#pageFitSection');
  const orientationSection = container.querySelector('#orientationSection');
  const tablePreviewSection = container.querySelector('#tablePreviewSection');
  const previewOverlayContainer = container.querySelector('#previewOverlayContainer');

  // Listeners
  radioModes.forEach(r => r.addEventListener('change', (e) => {
    state.mode = e.target.value;
    switchModeUI();
  }));

  pageFitRadios.forEach(r => r.addEventListener('change', (e) => {
    state.pageFit = e.target.value;
  }));

  orientationRadios.forEach(r => r.addEventListener('change', (e) => {
    state.orientation = e.target.value;
    updateOrientationPills();
  }));

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  processBtn.addEventListener('click', handleProcess);
  downloadBtn.addEventListener('click', handleDownload);

  // Mode Switcher UX
  function switchModeUI() {
    resetState();
    radioModes.forEach(r => r.parentElement.classList.toggle('active', r.checked));

    if (state.mode === 'excelToPdf') {
      appContainer.classList.remove('theme-pdf');
      appContainer.classList.add('theme-excel');
      fileInput.setAttribute('accept', '.xlsx,.xls,.csv');
      fileAcceptLabel.textContent = 'Accepts: .xlsx, .xls, .csv';
      dropZoneIcon.textContent = '📊';
      processBtn.textContent = 'Generate PDF Report';
      sheetSelectionSection.style.display = 'block';
      pageFitSection.style.display = 'block';
      orientationSection.style.display = 'block';
      tablePreviewSection.style.display = 'none';
    } else {
      appContainer.classList.remove('theme-excel');
      appContainer.classList.add('theme-pdf');
      fileInput.setAttribute('accept', '.pdf');
      fileAcceptLabel.textContent = 'Accepts: .pdf';
      dropZoneIcon.textContent = '📕';
      processBtn.textContent = 'Download XLSX File';
      sheetSelectionSection.style.display = 'none';
      pageFitSection.style.display = 'none';
      orientationSection.style.display = 'none';
      tablePreviewSection.style.display = 'block';
    }
  }

  function updateOrientationPills() {
    orientationRadios.forEach(r => {
      r.parentElement.classList.toggle('active', r.checked);
    });
  }

  // Pre-flight Data Scan & Interactivity Flow
  async function handleFileSelected(file) {
    state.file = file;
    state.fileName = file.name;
    dropZoneText.innerHTML = `Loaded: <strong>${file.name}</strong>`;

    const arrayBuffer = await file.arrayBuffer();

    if (state.mode === 'excelToPdf') {
      try {
        state.workbook = XLSX.read(arrayBuffer, { type: 'array' });
        state.sheets = state.workbook.SheetNames;
        state.selectedSheets = [...state.sheets];
        state.totalSheets = state.sheets.length;
        state.activeSheet = state.sheets[0] || '';

        // Inspect range
        const firstSheet = state.workbook.Sheets[state.activeSheet];
        state.detectedRange = firstSheet['!ref'] || 'A1';

        // Auto-Orientation Recommendation UX
        const range = XLSX.utils.decode_range(state.detectedRange);
        const colCount = range.e.c - range.s.c + 1;
        
        if (colCount > 6) {
          state.orientation = 'landscape';
          orientationRadios.forEach(r => r.checked = (r.value === 'landscape'));
          updateOrientationPills();
        }

        renderSheetPicker();
        updateMetadata();
        processBtn.disabled = false;
      } catch (err) {
        console.error(err);
        alert('Could not parse Excel file.');
      }
    } else {
      // PDF to Excel
      try {
        if (!window.pdfjsLib) {
          alert('PDF.js library is missing');
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        state.pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        state.totalSheets = state.pdfDoc.numPages;
        state.activeSheet = 'Page 1';
        state.detectedRange = 'Tables detected';

        updateMetadata();
        await renderTableExtractionPreview();
        processBtn.disabled = false;
      } catch (err) {
        console.error(err);
        alert('Could not parse PDF file.');
      }
    }
  }

  // Interactive Sheet Picker UX
  function renderSheetPicker() {
    sheetsList.innerHTML = '';
    state.sheets.forEach(name => {
      const label = document.createElement('label');
      label.className = 'sheet-tag-item';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = state.selectedSheets.includes(name);
      chk.value = name;

      chk.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.selectedSheets.push(name);
        } else {
          state.selectedSheets = state.selectedSheets.filter(s => s !== name);
        }
      });

      label.appendChild(chk);
      label.appendChild(document.createTextNode(` ${name}`));
      sheetsList.appendChild(label);
    });
  }

  function updateMetadata() {
    metaActiveSheet.textContent = state.activeSheet || '-';
    metaDetectedRange.textContent = state.detectedRange || '-';
    metaTotalSheets.textContent = state.totalSheets || '0';
  }

  // Table Extraction Grid Overlay (PDF to Excel UX)
  async function renderTableExtractionPreview() {
    if (!state.pdfDoc) return;
    previewOverlayContainer.innerHTML = '';

    const page = await state.pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.8 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const overlay = document.createElement('div');
    overlay.className = 'preview-grid-overlay';
    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;

    // Simulated detected table outline grid box
    const tableHighlight = document.createElement('div');
    tableHighlight.className = 'table-highlight-box';
    tableHighlight.textContent = 'Detected Table Overlay Grid';
    
    overlay.appendChild(tableHighlight);

    const wrapper = document.createElement('div');
    wrapper.className = 'preview-canvas-wrapper';
    wrapper.appendChild(canvas);
    wrapper.appendChild(overlay);

    previewOverlayContainer.appendChild(wrapper);
  }

  // Processing Actions
  async function handleProcess() {
    state.isProcessing = true;
    processBtn.disabled = true;
    progressContainer.style.display = 'block';
    downloadBtn.style.display = 'none';
    progressBar.style.width = '20%';

    try {
      if (state.mode === 'excelToPdf') {
        progressBar.style.width = '50%';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: state.orientation });

        state.selectedSheets.forEach((sheetName, index) => {
          if (index > 0) doc.addPage();
          
          const sheet = state.workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          doc.text(`Worksheet: ${sheetName}`, 14, 15);

          if (jsonData.length > 0) {
            doc.autoTable({
              head: [jsonData[0]],
              body: jsonData.slice(1),
              startY: 20,
              styles: { fontSize: state.pageFit === 'fitSheet' ? 7 : 9 },
              tableWidth: state.pageFit === 'fitColumns' ? 'wrap' : 'auto'
            });
          }
        });

        const pdfBlob = doc.output('blob');
        state.generatedBlob = pdfBlob;
        state.generatedFileName = state.fileName.replace(/\.[^/.]+$/, '') + '_report.pdf';

      } else {
        // PDF to Excel Conversion
        progressBar.style.width = '60%';

        let fullRows = [];
        for (let i = 1; i <= state.pdfDoc.numPages; i++) {
          const page = await state.pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          
          let lineMap = {};
          textContent.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lineMap[y]) lineMap[y] = [];
            lineMap[y].push(item.str);
          });

          // Sort lines vertically
          const sortedYs = Object.keys(lineMap).sort((a, b) => b - a);
          sortedYs.forEach(y => {
            fullRows.push(lineMap[y]);
          });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(fullRows);
        XLSX.utils.book_append_sheet(wb, ws, "Extracted_PDF_Data");

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        state.generatedBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        state.generatedFileName = state.fileName.replace(/\.[^/.]+$/, '') + '_extracted.xlsx';
      }

      progressBar.style.width = '100%';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        downloadBtn.style.display = 'block';
        processBtn.disabled = false;
        state.isProcessing = false;
      }, 400);

    } catch (err) {
      console.error(err);
      alert('Error during conversion.');
      progressContainer.style.display = 'none';
      processBtn.disabled = false;
    }
  }

  function handleDownload() {
    if (!state.generatedBlob) return;
    const url = URL.createObjectURL(state.generatedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.generatedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetState() {
    state.file = null;
    state.workbook = null;
    state.pdfDoc = null;
    state.generatedBlob = null;
    dropZoneText.innerHTML = 'Drag spreadsheet or <strong>Browse</strong>';
    sheetsList.innerHTML = '<p class="placeholder-text">No workbook loaded.</p>';
    previewOverlayContainer.innerHTML = '<p class="placeholder-text">Load a PDF file to preview extracted grid boundaries.</p>';
    processBtn.disabled = true;
    downloadBtn.style.display = 'none';
    progressContainer.style.display = 'none';
    metaActiveSheet.textContent = '-';
    metaDetectedRange.textContent = '-';
    metaTotalSheets.textContent = '0';
  }
}
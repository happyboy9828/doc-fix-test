/**
 * TXT <-> Word Converter Utility Module
 */

export function initTxtWordConverter(container) {
  if (!container) return;

  // Internal Reactive State
  const state = {
    mode: 'txtToDocx', // 'txtToDocx' | 'docxToTxt'
    text: '',
    fontFamily: 'Arial',
    fontSize: '11',
    lineSpacing: '1.15',
    margin: 'standard', // 'standard' | 'narrow' | 'wide'
    removeExtraBlankLines: false,
    trimTrailingWhitespace: false,
    words: 0,
    characters: 0,
    lines: 0,
    convertedBlob: null,
    convertedFileName: ''
  };

  // Render UI HTML Structure
  container.innerHTML = `
    <div class="txt-word-app">
      <header class="app-header">
        <h1>TXT ↔ Word Converter</h1>
        <p>Strip rich formatting down to plain text or package plain text into styled DOCX files.</p>
      </header>

      <div class="converter-grid">
        <!-- LEFT COLUMN: Input & Typography -->
        <div class="grid-col left-col">
          <section class="card">
            <h3>Mode Selection</h3>
            <div class="mode-toggle-group">
              <label class="radio-label ${state.mode === 'txtToDocx' ? 'active' : ''}">
                <input type="radio" name="convMode" value="txtToDocx" checked />
                <span>(o) TXT to Word</span>
              </label>
              <label class="radio-label ${state.mode === 'docxToTxt' ? 'active' : ''}">
                <input type="radio" name="convMode" value="docxToTxt" />
                <span>( ) Word to TXT</span>
              </label>
            </div>
          </section>

          <section class="card">
            <h3>Drop Zone / Input Area</h3>
            <div class="drop-zone" id="dropZone">
              <div class="drop-icon" id="dropIcon">📄</div>
              <p id="dropText">Drop <strong>TXT</strong> file here or click to browse</p>
              <input type="file" id="fileInput" accept=".txt" style="display: none;" />
            </div>
          </section>

          <section class="card" id="stylingCard">
            <h3>Styling Configuration (TXT → DOCX)</h3>
            <div class="form-group">
              <label for="fontSelect">Target Font:</label>
              <select id="fontSelect" class="form-control">
                <option value="Arial" selected>Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Calibri">Calibri</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
              </select>
            </div>

            <div class="form-group">
              <label for="sizeSelect">Font Size:</label>
              <select id="sizeSelect" class="form-control">
                <option value="9">9 pt</option>
                <option value="10">10 pt</option>
                <option value="11" selected>11 pt</option>
                <option value="12">12 pt</option>
                <option value="14">14 pt</option>
                <option value="16">16 pt</option>
              </select>
            </div>

            <div class="form-group">
              <label for="spacingSelect">Line Spacing:</label>
              <select id="spacingSelect" class="form-control">
                <option value="1.0">1.0 x (Single)</option>
                <option value="1.15" selected>1.15 x</option>
                <option value="1.5">1.5 x</option>
                <option value="2.0">2.0 x (Double)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="marginSelect">Margins:</label>
              <select id="marginSelect" class="form-control">
                <option value="standard" selected>Standard (1")</option>
                <option value="narrow">Narrow (0.5")</option>
                <option value="wide">Wide (1.5")</option>
              </select>
            </div>

            <button id="convertBtn" class="btn btn-primary">
              Convert Text File
            </button>
          </section>
        </div>

        <!-- RIGHT COLUMN: Live Text Canvas -->
        <div class="grid-col right-col">
          <section class="card">
            <h3>Text Analytics</h3>
            <div class="analytics-bar">
              <div class="stat-item">
                <span class="stat-label">Words:</span>
                <strong id="statWords">0</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">Characters:</span>
                <strong id="statChars">0</strong>
              </div>
              <div class="stat-item">
                <span class="stat-label">Line Count:</span>
                <strong id="statLines">0 Lines</strong>
              </div>
            </div>
          </section>

          <section class="card preview-card">
            <h3>Dynamic Text Preview</h3>
            <div class="preview-wrapper margin-standard" id="previewWrapper">
              <textarea 
                id="textPreview" 
                class="text-preview-area" 
                placeholder="Type or paste your text here to preview formatting..."
              ></textarea>
            </div>
          </section>

          <section class="card">
            <h3>Clean Options</h3>
            <div class="checkbox-options">
              <label class="checkbox-label">
                <input type="checkbox" id="chkRemoveBlank" />
                Remove Extra Blank Lines
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="chkTrimWhitespace" />
                Trim Trailing Whitespace
              </label>
            </div>
            <div class="action-footer">
              <button id="downloadBtn" class="btn btn-success" disabled>
                Download File (.docx)
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Element References
  const radioModes = container.querySelectorAll('input[name="convMode"]');
  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#fileInput');
  const dropText = container.querySelector('#dropText');
  const dropIcon = container.querySelector('#dropIcon');
  const stylingCard = container.querySelector('#stylingCard');

  const fontSelect = container.querySelector('#fontSelect');
  const sizeSelect = container.querySelector('#sizeSelect');
  const spacingSelect = container.querySelector('#spacingSelect');
  const marginSelect = container.querySelector('#marginSelect');

  const statWords = container.querySelector('#statWords');
  const statChars = container.querySelector('#statChars');
  const statLines = container.querySelector('#statLines');

  const textPreview = container.querySelector('#textPreview');
  const previewWrapper = container.querySelector('#previewWrapper');

  const chkRemoveBlank = container.querySelector('#chkRemoveBlank');
  const chkTrimWhitespace = container.querySelector('#chkTrimWhitespace');

  const convertBtn = container.querySelector('#convertBtn');
  const downloadBtn = container.querySelector('#downloadBtn');

  // Initial Sync
  updatePreviewStyles();
  updateAnalytics('');

  // Event Listeners
  radioModes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.mode = e.target.value;
      switchMode();
    });
  });

  dropZone.addEventListener('click', () => fileInput.click());

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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Dynamic Typography & Formatting Listeners
  fontSelect.addEventListener('change', (e) => {
    state.fontFamily = e.target.value;
    updatePreviewStyles();
  });

  sizeSelect.addEventListener('change', (e) => {
    state.fontSize = e.target.value;
    updatePreviewStyles();
  });

  spacingSelect.addEventListener('change', (e) => {
    state.lineSpacing = e.target.value;
    updatePreviewStyles();
  });

  marginSelect.addEventListener('change', (e) => {
    state.margin = e.target.value;
    updatePreviewStyles();
  });

  // Dynamic Text Cleaning Listeners
  textPreview.addEventListener('input', (e) => {
    state.text = e.target.value;
    updateAnalytics(state.text);
    downloadBtn.disabled = !state.text.trim();
  });

  chkRemoveBlank.addEventListener('change', (e) => {
    state.removeExtraBlankLines = e.target.checked;
    applyTextCleaning();
  });

  chkTrimWhitespace.addEventListener('change', (e) => {
    state.trimTrailingWhitespace = e.target.checked;
    applyTextCleaning();
  });

  convertBtn.addEventListener('click', handleConversion);
  downloadBtn.addEventListener('click', handleDownload);

  // Switch Mode logic
  function switchMode() {
    radioModes.forEach(r => r.parentElement.classList.toggle('active', r.checked));
    
    if (state.mode === 'txtToDocx') {
      fileInput.setAttribute('accept', '.txt');
      dropText.innerHTML = 'Drop <strong>TXT</strong> file here or click to browse';
      dropIcon.textContent = '📄';
      stylingCard.style.display = 'block';
      downloadBtn.textContent = 'Download File (.docx)';
    } else {
      fileInput.setAttribute('accept', '.docx');
      dropText.innerHTML = 'Drop <strong>DOCX</strong> file here or click to browse';
      dropIcon.textContent = '📘';
      stylingCard.style.display = 'none';
      downloadBtn.textContent = 'Download File (.txt)';
    }
    
    // Clear state on switch
    fileInput.value = '';
    state.text = '';
    textPreview.value = '';
    updateAnalytics('');
    downloadBtn.disabled = true;
  }

  // Update Visual Canvas Typography
  function updatePreviewStyles() {
    textPreview.style.fontFamily = state.fontFamily;
    textPreview.style.fontSize = `${state.fontSize}pt`;
    textPreview.style.lineHeight = state.lineSpacing;

    previewWrapper.className = `preview-wrapper margin-${state.margin}`;
  }

  // File Loader Process
  async function handleFile(file) {
    const fileName = file.name;

    if (state.mode === 'txtToDocx') {
      if (!fileName.endsWith('.txt')) {
        alert('Please upload a valid .txt file.');
        return;
      }
      const text = await file.text();
      state.text = text;
      textPreview.value = text;
      applyTextCleaning();
      downloadBtn.disabled = false;

    } else {
      if (!fileName.endsWith('.docx')) {
        alert('Please upload a valid .docx file.');
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Strips all styles, macros, headers, images using mammoth raw text extraction
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        state.text = result.value || '';
        textPreview.value = state.text;
        applyTextCleaning();
        downloadBtn.disabled = false;
      } catch (err) {
        console.error(err);
        alert('Error parsing Word document.');
      }
    }
  }

  // Dynamic Whitespace & Blank Line Cleaning
  function applyTextCleaning() {
    let cleanText = state.text;

    if (state.removeExtraBlankLines) {
      cleanText = cleanText.replace(/\n\s*\n/g, '\n');
    }

    if (state.trimTrailingWhitespace) {
      cleanText = cleanText.split('\n').map(line => line.trimEnd()).join('\n');
    }

    textPreview.value = cleanText;
    updateAnalytics(cleanText);
  }

  // Real-time Text Analytics
  function updateAnalytics(str) {
    const chars = str.length;
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    const lines = str ? str.split('\n').length : 0;

    statChars.textContent = chars.toLocaleString();
    statWords.textContent = words.toLocaleString();
    statLines.textContent = `${lines.toLocaleString()} Lines`;
  }

  // Conversion Execution Logic
  async function handleConversion() {
    const rawText = textPreview.value;
    if (!rawText.trim()) {
      alert('Please enter or upload some text to convert.');
      return;
    }

    if (state.mode === 'txtToDocx') {
      // Create styled DOCX using docx.js
      const docxLib = window.docx;

      let marginSize = 1440; // Standard 1 inch (1440 dxa)
      if (state.margin === 'narrow') marginSize = 720;  // 0.5 inch
      if (state.margin === 'wide') marginSize = 2160;    // 1.5 inch

      const paragraphs = rawText.split('\n').map(line => {
        return new docxLib.Paragraph({
          children: [
            new docxLib.TextRun({
              text: line,
              font: state.fontFamily,
              size: parseInt(state.fontSize, 10) * 2 // docx size is half-points
            })
          ],
          spacing: {
            line: Math.round(parseFloat(state.lineSpacing) * 240) // 240 line units = 1.0x spacing
          }
        });
      });

      const doc = new docxLib.Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: marginSize,
                bottom: marginSize,
                left: marginSize,
                right: marginSize
              }
            }
          },
          children: paragraphs
        }]
      });

      const blob = await docxLib.Packer.toBlob(doc);
      state.convertedBlob = blob;
      state.convertedFileName = 'converted_document.docx';
      downloadBtn.disabled = false;
      alert('Text successfully packaged into DOCX! Click "Download File" to save.');

    } else {
      // Word to Plain Text output
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
      state.convertedBlob = blob;
      state.convertedFileName = 'converted_text.txt';
      downloadBtn.disabled = false;
      alert('Rich formatting stripped! Click "Download File" to save clean text.');
    }
  }

  // File Download Handler
  function handleDownload() {
    const textToExport = textPreview.value;
    if (!textToExport.trim()) return;

    if (state.mode === 'txtToDocx') {
      if (!state.convertedBlob) {
        handleConversion().then(() => triggerDownload());
      } else {
        triggerDownload();
      }
    } else {
      const blob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });
      state.convertedBlob = blob;
      state.convertedFileName = 'stripped_document.txt';
      triggerDownload();
    }
  }

  function triggerDownload() {
    if (!state.convertedBlob) return;
    const url = URL.createObjectURL(state.convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.convertedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
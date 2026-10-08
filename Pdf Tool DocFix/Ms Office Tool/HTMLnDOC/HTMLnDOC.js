/**
 * HTML to DOCX Converter Utility Module
 */

export function initHtmlToDocx(container) {
  if (!container) return;

  // Initial Application State
  const state = {
    inputMode: 'html', // 'html' | 'url'
    htmlCode: `<h1>Document Title</h1>\n<p>This is styled paragraph with <strong>bold</strong> and <em>italic</em> text.</p>\n<ul>\n  <li>Bullet item 1</li>\n  <li>Bullet item 2</li>\n</ul>\n<table border="1">\n  <tr><th>Header 1</th><th>Header 2</th></tr>\n  <tr><td>Data 1</td><td>Data 2</td></tr>\n</table>\n<img src="https://via.placeholder.com/150" alt="Sample Image" />`,
    webUrl: '',
    baseFont: 'Calibri',
    orientation: 'portrait',
    embedImages: true,
    detectedHeadings: 0,
    renderedImages: 0,
    parsedTables: 0,
    generatedBlob: null
  };

  // Sample HTML Templates for Quick Testing
  const sampleHtml = `<h1>Quarterly Financial Report</h1>
<p>This report highlights the financial performance and key metrics for Q3.</p>
<h2>Executive Summary</h2>
<p>Revenue grew by <strong>15%</strong> compared to the previous quarter, driven primarily by online sales.</p>
<ul>
  <li>Total Revenue: $1,250,000</li>
  <li>Net Profit: $320,000</li>
  <li>Active Users: 45,000</li>
</ul>
<h2>Performance Breakdown</h2>
<table border="1" style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background-color: #f2f2f2;">
      <th>Region</th>
      <th>Sales</th>
      <th>Growth</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>North America</td>
      <td>$650,000</td>
      <td>+12%</td>
    </tr>
    <tr>
      <td>Europe</td>
      <td>$400,000</td>
      <td>+18%</td>
    </tr>
  </tbody>
</table>
<p><img src="https://via.placeholder.com/300x100" alt="Chart Placeholder"></p>`;

  // Render App Structure
  container.innerHTML = `
    <div class="html-docx-app">
      <header class="app-header">
        <h1>HTML to DOCX Converter</h1>
        <p>Transform raw HTML snippets or styled web content into Word documents.</p>
      </header>

      <div class="app-grid">
        <!-- LEFT COLUMN: Code / URL Input -->
        <div class="app-col left-col">
          <section class="card">
            <h3>Input Mode</h3>
            <div class="radio-toggle-group">
              <label class="radio-label ${state.inputMode === 'html' ? 'active' : ''}">
                <input type="radio" name="inputMode" value="html" checked />
                <span>(o) Raw HTML Code</span>
              </label>
              <label class="radio-label ${state.inputMode === 'url' ? 'active' : ''}">
                <input type="radio" name="inputMode" value="url" />
                <span>( ) Web URL</span>
              </label>
            </div>
          </section>

          <section class="card editor-card">
            <h3 id="inputTitle">HTML Code Editor</h3>
            <div id="htmlInputContainer">
              <textarea id="htmlEditor" class="code-editor" spellcheck="false">${state.htmlCode}</textarea>
            </div>
            <div id="urlInputContainer" style="display: none;">
              <input type="url" id="urlInput" class="text-input" placeholder="https://example.com/page.html" />
              <button id="fetchUrlBtn" class="btn btn-secondary btn-sm mt-2">Fetch Web Page</button>
            </div>
            <div class="editor-actions">
              <button id="btnSample" class="btn btn-secondary">Import HTML Sample</button>
              <button id="btnClear" class="btn btn-outline">Clear</button>
            </div>
          </section>

          <section class="card action-card">
            <h3>Action Bar</h3>
            <button id="btnGenerate" class="btn btn-primary">Generate DOCX File</button>
          </section>
        </div>

        <!-- RIGHT COLUMN: Output & Render -->
        <div class="app-col right-col">
          <section class="card">
            <h3>Target Document Settings</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="baseFont">Base Font:</label>
                <select id="baseFont" class="select-input">
                  <option value="Calibri" selected>Calibri</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
              <div class="form-group">
                <label for="pageOrientation">Page Orientation:</label>
                <select id="pageOrientation" class="select-input">
                  <option value="portrait" selected>Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" id="chkEmbedImages" checked /> Embed Web Images
              </label>
            </div>
          </section>

          <section class="card">
            <h3>Layout Structure Summary</h3>
            <ul class="summary-list">
              <li><span>Headings Detected:</span> <strong id="cntHeadings">0</strong></li>
              <li><span>Images Rendered:</span> <strong id="cntImages">0</strong></li>
              <li><span>Tables Parsed:</span> <strong id="cntTables">0</strong></li>
            </ul>
          </section>

          <section class="card canvas-card">
            <h3>Rendered Output Canvas</h3>
            <div class="canvas-preview-box" id="canvasPreview"></div>
          </section>

          <section class="card action-card">
            <button id="btnDownload" class="btn btn-success" disabled>
              Download Word Document (.docx)
            </button>
          </section>
        </div>
      </div>
    </div>
  `;

  // Select DOM Elements
  const radioModes = container.querySelectorAll('input[name="inputMode"]');
  const htmlInputContainer = container.querySelector('#htmlInputContainer');
  const urlInputContainer = container.querySelector('#urlInputContainer');
  const htmlEditor = container.querySelector('#htmlEditor');
  const urlInput = container.querySelector('#urlInput');
  const fetchUrlBtn = container.querySelector('#fetchUrlBtn');
  const inputTitle = container.querySelector('#inputTitle');
  const btnSample = container.querySelector('#btnSample');
  const btnClear = container.querySelector('#btnClear');
  const btnGenerate = container.querySelector('#btnGenerate');
  const btnDownload = container.querySelector('#btnDownload');

  const baseFont = container.querySelector('#baseFont');
  const pageOrientation = container.querySelector('#pageOrientation');
  const chkEmbedImages = container.querySelector('#chkEmbedImages');

  const cntHeadings = container.querySelector('#cntHeadings');
  const cntImages = container.querySelector('#cntImages');
  const cntTables = container.querySelector('#cntTables');
  const canvasPreview = container.querySelector('#canvasPreview');

  // Event Listeners
  radioModes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.inputMode = e.target.value;
      radioModes.forEach(r => r.parentElement.classList.toggle('active', r.checked));
      
      if (state.inputMode === 'html') {
        htmlInputContainer.style.display = 'block';
        urlInputContainer.style.display = 'none';
        inputTitle.textContent = 'HTML Code Editor';
      } else {
        htmlInputContainer.style.display = 'none';
        urlInputContainer.style.display = 'block';
        inputTitle.textContent = 'Web Page URL';
      }
      updateLayoutEngine();
    });
  });

  htmlEditor.addEventListener('input', () => {
    state.htmlCode = htmlEditor.value;
    updateLayoutEngine();
  });

  baseFont.addEventListener('change', (e) => {
    state.baseFont = e.target.value;
    canvasPreview.style.fontFamily = state.baseFont;
  });

  pageOrientation.addEventListener('change', (e) => {
    state.orientation = e.target.value;
  });

  chkEmbedImages.addEventListener('change', (e) => {
    state.embedImages = e.target.checked;
    updateLayoutEngine();
  });

  btnSample.addEventListener('click', () => {
    if (state.inputMode === 'html') {
      htmlEditor.value = sampleHtml;
      state.htmlCode = sampleHtml;
    } else {
      urlInput.value = 'https://example.com';
    }
    updateLayoutEngine();
  });

  btnClear.addEventListener('click', () => {
    htmlEditor.value = '';
    urlInput.value = '';
    state.htmlCode = '';
    updateLayoutEngine();
  });

  fetchUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return alert('Please enter a valid URL.');
    
    fetchUrlBtn.disabled = true;
    fetchUrlBtn.textContent = 'Fetching...';
    
    try {
      // Use CORS Proxy for client-side url fetching
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      
      if (data.contents) {
        state.htmlCode = data.contents;
        htmlEditor.value = data.contents;
        updateLayoutEngine();
      } else {
        alert('Could not fetch URL content.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch URL due to CORS restrictions or network issue.');
    } finally {
      fetchUrlBtn.disabled = false;
      fetchUrlBtn.textContent = 'Fetch Web Page';
    }
  });

  btnGenerate.addEventListener('click', handleGenerateDocx);
  btnDownload.addEventListener('click', handleDownload);

  // Layout Engine: Recalculate HTML structures & update live canvas
  function updateLayoutEngine() {
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.htmlCode || '<div></div>', 'text/html');

    // Structural Count Calculation
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    const images = doc.querySelectorAll('img').length;
    const tables = doc.querySelectorAll('table').length;

    state.detectedHeadings = headings;
    state.renderedImages = images;
    state.parsedTables = tables;

    cntHeadings.textContent = headings;
    cntImages.textContent = images;
    cntTables.textContent = tables;

    // Render Preview Canvas
    canvasPreview.style.fontFamily = state.baseFont;
    canvasPreview.innerHTML = state.htmlCode || '<p class="placeholder-text">Enter HTML code to render preview...</p>';

    // Toggle images inside preview based on checkbox
    const previewImgs = canvasPreview.querySelectorAll('img');
    previewImgs.forEach(img => {
      img.style.display = state.embedImages ? 'inline-block' : 'none';
    });

    btnDownload.disabled = true;
  }

  // Compile HTML DOM Tree into OpenXML .docx format
  async function handleGenerateDocx() {
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Compiling DOCX...';

    try {
      const fullHtmlString = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: ${state.baseFont}, sans-serif; font-size: 11pt; }
              h1 { font-size: 20pt; color: #2E74B5; }
              h2 { font-size: 15pt; color: #2E74B5; }
              h3 { font-size: 13pt; color: #1F4E79; }
              table { border-collapse: collapse; width: 100%; margin-top: 10px; }
              th, td { border: 1px solid #BFBFBF; padding: 6px; text-align: left; }
              th { background-color: #F2F2F2; }
            </style>
          </head>
          <body>
            ${state.htmlCode}
          </body>
        </html>
      `;

      // Check if html-docx-js CDN is available
      if (window.htmlDocx) {
        const converted = window.htmlDocx.asBlob(fullHtmlString, {
          orientation: state.orientation,
          margins: { top: 720, right: 720, bottom: 720, left: 720 }
        });
        state.generatedBlob = converted;
      } else {
        // Fallback using simple XML/HTML document MIME type
        const blob = new Blob(['\ufeff' + fullHtmlString], {
          type: 'application/msword'
        });
        state.generatedBlob = blob;
      }

      btnDownload.disabled = false;
      alert('DOCX File generated successfully! Click "Download Word Document" to save.');
    } catch (err) {
      console.error(err);
      alert('Error compiling DOCX file.');
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate DOCX File';
    }
  }

  // Handle Download Trigger
  function handleDownload() {
    if (!state.generatedBlob) return;
    
    if (window.saveAs) {
      window.saveAs(state.generatedBlob, 'document.docx');
    } else {
      const url = URL.createObjectURL(state.generatedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Initialize Layout Engine on load
  updateLayoutEngine();
}
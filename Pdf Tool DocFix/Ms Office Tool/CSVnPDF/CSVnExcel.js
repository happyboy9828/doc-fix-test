// src/utility/tool.js

export function initCSVExcelTool(containerElement) {
  let state = {
    mode: 'csv2excel', // 'csv2excel' | 'excel2csv'
    delimiter: ',',    // ',', '\t', ';', or custom
    customDelimiter: '',
    textQualifier: '"',
    detectDates: true,
    freezeHeader: true,
    autoFitWidths: true,
    rawDataString: '',
    workbook: null,
    parsedData: [],    // Array of arrays representing rows and columns
    fileName: '',
    fileEncoding: 'UTF-8',
    warnings: []
  };

  // Render Skeleton UI
  containerElement.innerHTML = `
    <div class="csv-excel-app">
      <div class="app-header">
        <h1>CSV &lt;=&gt; Excel Converter</h1>
        <p>Format plain text CSV data into clean spreadsheets or convert XLSX to CSV.</p>
      </div>

      <div class="app-grid">
        <!-- LEFT COLUMN: Settings -->
        <div class="left-column">
          <div class="card">
            <h3>Mode Selection</h3>
            <div class="mode-toggle-group">
              <label class="radio-card ${state.mode === 'csv2excel' ? 'active' : ''}">
                <input type="radio" name="mode" value="csv2excel" ${state.mode === 'csv2excel' ? 'checked' : ''} />
                CSV to Excel
              </label>
              <label class="radio-card ${state.mode === 'excel2csv' ? 'active' : ''}">
                <input type="radio" name="mode" value="excel2csv" ${state.mode === 'excel2csv' ? 'checked' : ''} />
                Excel to CSV
              </label>
            </div>
          </div>

          <div class="card">
            <h3>File Input</h3>
            <div class="drop-zone" id="drop-zone">
              <div class="drop-zone-icon">📁</div>
              <div id="drop-zone-text">Click or Drop file here</div>
              <span class="file-accept-label" id="file-accept-label">Supports: .csv, .tsv, .txt</span>
            </div>
            <input type="file" id="file-input" style="display: none;" />
          </div>

          <div class="card" id="delimiter-card">
            <h3>Delimiter Config</h3>
            <div class="control-group">
              <label class="control-label">Field Separator</label>
              <div class="radio-options-grid">
                <label class="radio-label-option">
                  <input type="radio" name="delimiter" value="," ${state.delimiter === ',' ? 'checked' : ''} /> Comma (,)
                </label>
                <label class="radio-label-option">
                  <input type="radio" name="delimiter" value="\t" ${state.delimiter === '\t' ? 'checked' : ''} /> Tab
                </label>
                <label class="radio-label-option">
                  <input type="radio" name="delimiter" value=";" ${state.delimiter === ';' ? 'checked' : ''} /> Semicolon (;)
                </label>
                <label class="radio-label-option">
                  <input type="radio" name="delimiter" value="custom" ${state.delimiter === 'custom' ? 'checked' : ''} /> Custom
                </label>
              </div>
            </div>

            <div class="control-group" id="custom-delimiter-wrap" style="display: none;">
              <input type="text" id="custom-delimiter" class="text-input" placeholder="Enter custom separator" maxlength="5" />
            </div>

            <div class="control-group">
              <label class="control-label">Text Qualifier</label>
              <input type="text" id="text-qualifier" class="text-input" value="${state.textQualifier}" maxlength="1" />
            </div>
          </div>

          <div class="card" id="formatting-card">
            <h3>Auto-Formatting Controls</h3>
            <div class="checkbox-group">
              <label class="checkbox-label-option">
                <input type="checkbox" id="chk-detect-dates" ${state.detectDates ? 'checked' : ''} /> Detect Date Formats
              </label>
              <label class="checkbox-label-option">
                <input type="checkbox" id="chk-freeze-header" ${state.freezeHeader ? 'checked' : ''} /> Freeze Header Row
              </label>
              <label class="checkbox-label-option">
                <input type="checkbox" id="chk-autofit" ${state.autoFitWidths ? 'checked' : ''} /> Auto-fit Column Widths
              </label>
            </div>
          </div>

          <button id="btn-action" class="btn btn-primary" disabled>Convert &amp; Structure Data</button>
        </div>

        <!-- RIGHT COLUMN: Preview -->
        <div class="right-column">
          <div class="card">
            <h3>Raw Data Scan</h3>
            <div class="meta-row">
              <div class="meta-item">Total Rows: <strong id="meta-rows">0</strong></div>
              <div class="meta-item">Columns: <strong id="meta-cols">0</strong></div>
              <div class="meta-item">Encoding: <strong id="meta-encoding">${state.fileEncoding}</strong></div>
            </div>
          </div>

          <div id="warning-container"></div>

          <div class="card">
            <h3>Interactive Data Table Preview</h3>
            <div class="table-preview-container" id="preview-container">
              <p class="placeholder-text">Upload a file to preview structured data</p>
            </div>
          </div>

          <div class="card">
            <h3>Output Format</h3>
            <button id="btn-download" class="btn btn-primary" disabled>
              ${state.mode === 'csv2excel' ? 'Save as Excel (.xlsx)' : 'Download Formatted CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Element References
  const dropZone = containerElement.querySelector('#drop-zone');
  const fileInput = containerElement.querySelector('#file-input');
  const dropZoneText = containerElement.querySelector('#drop-zone-text');
  const fileAcceptLabel = containerElement.querySelector('#file-accept-label');
  const btnAction = containerElement.querySelector('#btn-action');
  const btnDownload = containerElement.querySelector('#btn-download');
  const customDelimiterWrap = containerElement.querySelector('#custom-delimiter-wrap');
  const customDelimiterInput = containerElement.querySelector('#custom-delimiter');
  const textQualifierInput = containerElement.querySelector('#text-qualifier');
  const previewContainer = containerElement.querySelector('#preview-container');
  const metaRows = containerElement.querySelector('#meta-rows');
  const metaCols = containerElement.querySelector('#meta-cols');
  const warningContainer = containerElement.querySelector('#warning-container');

  // Utility Auto-Delimiter Detection UX
  function autoDetectDelimiter(text) {
    const lines = text.split(/\r\n|\n/).slice(0, 10).filter(l => l.trim().length > 0);
    if (lines.length === 0) return ',';

    const counts = { ',': 0, '\t': 0, ';': 0 };
    lines.forEach(line => {
      counts[','] += (line.match(/,/g) || []).length;
      counts['\t'] += (line.match(/\t/g) || []).length;
      counts[';'] += (line.match(/;/g) || []).length;
    });

    let bestDelim = ',';
    let maxCount = -1;
    for (const [delim, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestDelim = delim;
      }
    }
    return maxCount > 0 ? bestDelim : ',';
  }

  // Raw Delimiter Line Parser
  function parseCSV(text, delimiter, qualifier) {
    const rows = [];
    const lines = text.split(/\r\n|\n/);
    let currentRow = [];
    let currentVal = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === qualifier) {
        if (insideQuotes && nextChar === qualifier) {
          currentVal += qualifier;
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }

    if (currentVal || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      rows.push(currentRow);
    }

    return rows;
  }

  // Interactive Grid Re-render
  function updateDataGrid() {
    state.warnings = [];
    if (state.mode === 'csv2excel') {
      if (!state.rawDataString) {
        previewContainer.innerHTML = `<p class="placeholder-text">Upload a CSV file to preview</p>`;
        metaRows.textContent = '0';
        metaCols.textContent = '0';
        btnAction.disabled = true;
        btnDownload.disabled = true;
        return;
      }

      const activeDelimiter = state.delimiter === 'custom' ? state.customDelimiter : state.delimiter;
      if (!activeDelimiter) return;

      state.parsedData = parseCSV(state.rawDataString, activeDelimiter, state.textQualifier);

      // Check for column misalignment warning UX
      if (state.parsedData.length > 0) {
        const expectedCols = state.parsedData[0].length;
        state.parsedData.forEach((row, idx) => {
          if (row.length !== expectedCols) {
            state.warnings.push(`Row ${idx + 1} has ${row.length} columns (expected ${expectedCols})`);
          }
        });
      }
    }

    // Render Warnings
    if (state.warnings.length > 0) {
      warningContainer.innerHTML = `
        <div class="warning-banner">
          ⚠️ <strong>Parsing Warning:</strong> Column misalignment detected in ${state.warnings.length} rows. Please verify your delimiter settings.
        </div>
      `;
    } else {
      warningContainer.innerHTML = '';
    }

    // Render Preview Table
    if (state.parsedData.length === 0) {
      previewContainer.innerHTML = `<p class="placeholder-text">No data to display</p>`;
      metaRows.textContent = '0';
      metaCols.textContent = '0';
      btnAction.disabled = true;
      btnDownload.disabled = true;
      return;
    }

    const maxCols = Math.max(...state.parsedData.map(r => r.length));
    metaRows.textContent = state.parsedData.length.toLocaleString();
    metaCols.textContent = maxCols.toString();

    let html = `<table class="data-table"><thead><tr>`;
    const headers = state.parsedData[0] || [];
    for (let c = 0; c < maxCols; c++) {
      const headerText = headers[c] !== undefined ? headers[c] : `Column ${c + 1}`;
      html += `<th class="${state.freezeHeader ? 'frozen-header' : ''}">${headerText || `Col ${c + 1}`}</th>`;
    }
    html += `</tr></thead><tbody>`;

    const previewRows = state.parsedData.slice(1, 51); // Limit preview to 50 rows for speed
    previewRows.forEach((row, rowIdx) => {
      const isWarn = row.length !== maxCols;
      html += `<tr class="${isWarn ? 'warning-row' : ''}">`;
      for (let c = 0; c < maxCols; c++) {
        html += `<td>${row[c] !== undefined ? row[c] : ''}</td>`;
      }
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    previewContainer.innerHTML = html;

    btnAction.disabled = false;
    btnDownload.disabled = false;
  }

  // Handle Input File
  function handleFile(file) {
    if (!file) return;
    state.fileName = file.name;
    dropZoneText.textContent = file.name;

    const reader = new FileReader();

    if (state.mode === 'csv2excel') {
      reader.onload = (e) => {
        state.rawDataString = e.target.result;
        const detected = autoDetectDelimiter(state.rawDataString);
        state.delimiter = detected;

        // Sync Radio UI
        const radios = containerElement.querySelectorAll('input[name="delimiter"]');
        radios.forEach(r => {
          r.checked = (r.value === detected);
        });

        updateDataGrid();
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(data, { type: 'array' });
        state.workbook = wb;

        const firstSheetName = wb.SheetNames[0];
        const worksheet = wb.Sheets[firstSheetName];
        state.parsedData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        updateDataGrid();
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // Event Listeners Setup
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Mode Switch Event
  containerElement.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.mode = e.target.value;

      containerElement.querySelectorAll('.mode-toggle-group .radio-card').forEach(card => {
        card.classList.toggle('active', card.querySelector('input').checked);
      });

      const delimCard = containerElement.querySelector('#delimiter-card');
      const fmtCard = containerElement.querySelector('#formatting-card');

      if (state.mode === 'excel2csv') {
        delimCard.style.display = 'none';
        fmtCard.style.display = 'none';
        fileAcceptLabel.textContent = 'Supports: .xlsx, .xls';
        btnDownload.textContent = 'Download Formatted CSV';
      } else {
        delimCard.style.display = 'block';
        fmtCard.style.display = 'block';
        fileAcceptLabel.textContent = 'Supports: .csv, .tsv, .txt';
        btnDownload.textContent = 'Save as Excel (.xlsx)';
      }

      state.rawDataString = '';
      state.parsedData = [];
      dropZoneText.textContent = 'Click or Drop file here';
      updateDataGrid();
    });
  });

  // Delimiter Controls Event
  containerElement.querySelectorAll('input[name="delimiter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.delimiter = e.target.value;
      if (state.delimiter === 'custom') {
        customDelimiterWrap.style.display = 'block';
      } else {
        customDelimiterWrap.style.display = 'none';
      }
      updateDataGrid();
    });
  });

  customDelimiterInput.addEventListener('input', (e) => {
    state.customDelimiter = e.target.value;
    if (state.delimiter === 'custom') updateDataGrid();
  });

  textQualifierInput.addEventListener('input', (e) => {
    state.textQualifier = e.target.value || '"';
    updateDataGrid();
  });

  containerElement.querySelector('#chk-freeze-header').addEventListener('change', (e) => {
    state.freezeHeader = e.target.checked;
    updateDataGrid();
  });

  // One-Click Export & Download
  function exportFile() {
    if (state.parsedData.length === 0) return;

    if (state.mode === 'csv2excel') {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(state.parsedData);

      // Apply Auto-fit Column Widths UX option
      if (state.autoFitWidths && state.parsedData.length > 0) {
        const colWidths = state.parsedData[0].map((_, colIdx) => {
          let maxLen = 10;
          state.parsedData.forEach(row => {
            const val = row[colIdx] ? String(row[colIdx]) : '';
            if (val.length > maxLen) maxLen = val.length;
          });
          return { wch: Math.min(maxLen + 3, 50) };
        });
        ws['!cols'] = colWidths;
      }

      // Freeze Header Row Option
      if (state.freezeHeader) {
        ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
      }

      window.XLSX.utils.book_append_sheet(wb, ws, "Standardized_Data");
      const outName = state.fileName ? state.fileName.replace(/\.[^/.]+$/, "") + ".xlsx" : "converted_data.xlsx";
      window.XLSX.writeFile(wb, outName);

    } else {
      // Excel to CSV Export
      const activeDelimiter = state.delimiter === 'custom' ? state.customDelimiter : state.delimiter || ',';
      let csvContent = state.parsedData.map(row => {
        return row.map(cell => {
          const str = String(cell ?? '');
          if (str.includes(activeDelimiter) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(activeDelimiter);
      }).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const outName = state.fileName ? state.fileName.replace(/\.[^/.]+$/, "") + ".csv" : "converted_data.csv";

      link.setAttribute("href", url);
      link.setAttribute("download", outName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  btnAction.addEventListener('click', exportFile);
  btnDownload.addEventListener('click', exportFile);
}
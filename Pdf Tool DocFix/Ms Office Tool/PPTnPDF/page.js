// src/pages/toolPage.js
import { renderPptPdfTool } from '../utility/tool.js';
import '../utility/tool.css';

export function initToolPage() {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = '<div id="ppt-pdf-app"></div>';
  renderPptPdfTool('ppt-pdf-app');
}
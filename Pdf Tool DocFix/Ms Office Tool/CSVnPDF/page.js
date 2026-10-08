// src/pages/toolPage.js
import { initCSVExcelTool } from '../utility/tool.js';
import '../utility/tool.css';

export function renderToolPage(containerElement) {
  // Initialize tool inside given DOM node
  initCSVExcelTool(containerElement);
}
import { initSortTextTool } from '../utility/tool.js';
import '../utility/tool.css';

export function renderToolPage(containerElement) {
  // Clear container and mount the tool
  containerElement.innerHTML = `<div id="tool-mount-point"></div>`;
  const mountPoint = containerElement.querySelector('#tool-mount-point');
  
  // Initialize the utility tool
  initSortTextTool(mountPoint);
}
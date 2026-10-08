import { initWordCounter } from '../utility/tool.js';
import '../utility/tool.css';

/**
 * Page wrapper function to render and initialize the Word Counter tool.
 */
export function renderToolPage(containerElement) {
  // Clear existing page content
  containerElement.innerHTML = '<div id="word-counter-root"></div>';
  
  // Mount the Word Counter utility
  const rootEl = containerElement.querySelector('#word-counter-root');
  initWordCounter(rootEl);
}
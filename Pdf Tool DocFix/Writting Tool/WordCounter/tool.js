/**
 * Utility functions for text analysis
 */
export const TextAnalyzer = {
  // Calculate syllable count for Flesch-Kincaid
  countSyllables(word) {
    word = word.toLowerCase().trim();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  },

  // Main metrics calculator
  analyze(text, options = { ignoreNumbers: false, stripSpaces: false }) {
    let processedText = text;

    if (options.stripSpaces) {
      processedText = processedText.replace(/\s+/g, ' ');
    }

    // Characters counts
    const charWithSpaces = processedText.length;
    const charNoSpaces = processedText.replace(/\s/g, '').length;

    // Line & Paragraph counts
    const lines = processedText ? processedText.split(/\r\n|\r|\n/).length : 0;
    const paragraphs = processedText.strip ? processedText.trim().split(/\n\s*\n/).filter(Boolean).length : processedText.split(/\n+/).filter(p => p.trim().length > 0).length;

    // Extract Words
    let rawWords = processedText.match(/\b\w+('\w+)?\b/g) || [];
    if (options.ignoreNumbers) {
      rawWords = rawWords.filter(word => !/^\d+$/.test(word));
    }

    const wordCount = rawWords.length;

    // Sentence count
    const sentences = processedText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    // Reading & Speaking Times (200 wpm reading, 130 wpm speaking)
    const readTimeMinutes = wordCount > 0 ? (wordCount / 200).toFixed(1) : '0';
    const speakTimeMinutes = wordCount > 0 ? (wordCount / 130).toFixed(1) : '0';

    // Flesch-Kincaid Grade Level
    let gradeLevel = '0';
    if (wordCount > 0 && sentences > 0) {
      let totalSyllables = 0;
      rawWords.forEach(w => { totalSyllables += this.countSyllables(w); });
      const fk = 0.39 * (wordCount / sentences) + 11.8 * (totalSyllables / wordCount) - 15.59;
      gradeLevel = Math.max(0, fk).toFixed(1);
    }

    // Keyword Density (Top 5)
    const stopWords = new Set(['the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me']);
    const freqMap = {};

    rawWords.forEach(w => {
      const clean = w.toLowerCase();
      if (!stopWords.has(clean) && clean.length > 1 && !/^\d+$/.test(clean)) {
        freqMap[clean] = (freqMap[clean] || 0) + 1;
      }
    });

    const keywordDensity = Object.keys(freqMap)
      .map(word => ({
        word,
        count: freqMap[word],
        percentage: ((freqMap[word] / (wordCount || 1)) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      wordCount,
      charWithSpaces,
      charNoSpaces,
      sentences,
      paragraphs,
      lines,
      readTimeMinutes,
      speakTimeMinutes,
      gradeLevel,
      keywordDensity
    };
  }
};

/**
 * Initializes and mounts the Word Counter widget onto a target container element.
 */
export function initWordCounter(targetContainer) {
  if (!targetContainer) return;

  // Build DOM Structure
  targetContainer.innerHTML = `
    <div class="word-counter-container">
      <div class="word-counter-header">
        <h1>Word Counter</h1>
        <p>Real-time word count, character metrics, reading time, and text density analysis.</p>
      </div>

      <div class="word-counter-layout">
        <!-- Left Column: Interactive Editor -->
        <div class="word-counter-left">
          <div class="quick-tools-bar">
            <button type="button" class="btn-tool btn-tool-danger" id="wc-btn-clear">Clear</button>
            <button type="button" class="btn-tool" id="wc-btn-paste">Paste</button>
            <button type="button" class="btn-tool" id="wc-btn-copy">Copy Text</button>
          </div>

          <div class="editor-wrapper">
            <div class="editor-highlights" id="wc-highlights"></div>
            <textarea class="editor-textarea" id="wc-textarea" placeholder="Type or paste your text here..."></textarea>
          </div>

          <div class="safeguard-bar">
            <label>
              <input type="checkbox" id="wc-opt-ignore-num"> Ignore Numbers
            </label>
            <label>
              <input type="checkbox" id="wc-opt-strip-space"> Strip Spaces
            </label>
          </div>
        </div>

        <!-- Right Column: Text Analytics -->
        <div class="word-counter-right">
          <div class="analytics-card">
            <h3>Metrics Summary</h3>
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-label">Words</span>
                <span class="metric-value" id="wc-val-words">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Characters (w/ spaces)</span>
                <span class="metric-value" id="wc-val-char-ws">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Characters (no spaces)</span>
                <span class="metric-value" id="wc-val-char-ns">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Sentences / Paragraphs</span>
                <span class="metric-value"><span id="wc-val-sentences">0</span> / <span id="wc-val-paragraphs">0</span></span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Lines</span>
                <span class="metric-value" id="wc-val-lines">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Flesch-Kincaid Grade</span>
                <span class="metric-value" id="wc-val-grade">0</span>
              </div>
            </div>
          </div>

          <div class="analytics-card">
            <h3>Estimated Time</h3>
            <div class="times-row">
              <div class="metric-item">
                <span class="metric-label">Reading Time</span>
                <span class="metric-value">~<span id="wc-val-read">0</span> mins</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Speaking Time</span>
                <span class="metric-value">~<span id="wc-val-speak">0</span> mins</span>
              </div>
            </div>
          </div>

          <div class="analytics-card">
            <h3>Top Keyword Density</h3>
            <ul class="density-list" id="wc-density-list">
              <li style="color: #94a3b8; font-size: 13px;">Enter text to see keyword density.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="word-counter-toast" id="wc-toast"></div>
  `;

  // References
  const textarea = targetContainer.querySelector('#wc-textarea');
  const highlights = targetContainer.querySelector('#wc-highlights');
  const btnClear = targetContainer.querySelector('#wc-btn-clear');
  const btnPaste = targetContainer.querySelector('#wc-btn-paste');
  const btnCopy = targetContainer.querySelector('#wc-btn-copy');
  const optIgnoreNum = targetContainer.querySelector('#wc-opt-ignore-num');
  const optStripSpace = targetContainer.querySelector('#wc-opt-strip-space');
  const toast = targetContainer.querySelector('#wc-toast');

  // Sync scrolling between highlight div and textarea
  textarea.addEventListener('scroll', () => {
    highlights.scrollTop = textarea.scrollTop;
    highlights.scrollLeft = textarea.scrollLeft;
  });

  // Display Toast Notification
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  // Update UI Analytics
  function updateAnalytics() {
    const text = textarea.value;
    const metrics = TextAnalyzer.analyze(text, {
      ignoreNumbers: optIgnoreNum.checked,
      stripSpaces: optStripSpace.checked
    });

    targetContainer.querySelector('#wc-val-words').textContent = metrics.wordCount.toLocaleString();
    targetContainer.querySelector('#wc-val-char-ws').textContent = metrics.charWithSpaces.toLocaleString();
    targetContainer.querySelector('#wc-val-char-ns').textContent = metrics.charNoSpaces.toLocaleString();
    targetContainer.querySelector('#wc-val-sentences').textContent = metrics.sentences;
    targetContainer.querySelector('#wc-val-paragraphs').textContent = metrics.paragraphs;
    targetContainer.querySelector('#wc-val-lines').textContent = metrics.lines;
    targetContainer.querySelector('#wc-val-grade').textContent = metrics.gradeLevel;
    targetContainer.querySelector('#wc-val-read').textContent = metrics.readTimeMinutes;
    targetContainer.querySelector('#wc-val-speak').textContent = metrics.speakTimeMinutes;

    // Render density list
    const densityList = targetContainer.querySelector('#wc-density-list');
    densityList.innerHTML = '';

    if (metrics.keywordDensity.length === 0) {
      densityList.innerHTML = '<li style="color: #94a3b8; font-size: 13px;">Enter text to see keyword density.</li>';
    } else {
      metrics.keywordDensity.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'density-item';
        li.innerHTML = `<span>${idx + 1}. <strong>${item.word}</strong></span> <span>${item.count}x (${item.percentage}%)</span>`;

        // Keyword Hover Highlight UX
        li.addEventListener('mouseenter', () => highlightKeyword(item.word));
        li.addEventListener('mouseleave', () => clearHighlights());

        densityList.appendChild(li);
      });
    }
  }

  // Highlight word occurrences in editor
  function highlightKeyword(keyword) {
    const text = textarea.value;
    if (!text || !keyword) return;

    const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const highlighted = escapedText.replace(regex, '<mark>$1</mark>');
    highlights.innerHTML = highlighted + '\n';
  }

  function clearHighlights() {
    highlights.innerHTML = '';
  }

  // Event Listeners
  textarea.addEventListener('input', updateAnalytics);
  optIgnoreNum.addEventListener('change', updateAnalytics);
  optStripSpace.addEventListener('change', updateAnalytics);

  btnClear.addEventListener('click', () => {
    textarea.value = '';
    clearHighlights();
    updateAnalytics();
    showToast('Text cleared!');
  });

  btnCopy.addEventListener('click', () => {
    if (!textarea.value) {
      showToast('Nothing to copy!');
      return;
    }
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('Text copied to clipboard!');
    });
  });

  btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      textarea.value = text;
      updateAnalytics();
      showToast('Text pasted from clipboard!');
    } catch (err) {
      showToast('Clipboard access denied.');
    }
  });

  // Initial calculation
  updateAnalytics();
}
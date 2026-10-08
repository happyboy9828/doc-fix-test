export function initLoremIpsumGenerator(containerId) {
  const container = typeof containerId === "string" 
    ? document.getElementById(containerId) 
    : containerId;

  if (!container) return;

  // Base vocabulary dictionary
  const words = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
    "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
    "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
    "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
    "commodo", "consequat", "duis", "aute", "irure", "dolor", "in", "reprehenderit",
    "in", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat", "nulla",
    "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident",
    "sunt", "in", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum"
  ];

  let state = {
    format: "paragraphs", // paragraphs, sentences, words, bullets
    count: 5,
    wrapParagraphs: true,
    startWithLorem: true,
    includeHtmlTags: false
  };

  container.innerHTML = `
    <div class="lig-wrapper">
      <div class="lig-header">
        <h1>Lorem Ipsum Generator</h1>
        <p>Generate custom dummy text in paragraphs, sentences, or HTML formats for UI mocks.</p>
      </div>

      <div class="lig-container">
        <!-- LEFT COLUMN: Settings -->
        <div class="lig-card">
          <h2>Settings</h2>

          <div class="lig-group">
            <label class="lig-label">Output Format</label>
            <div class="lig-options-grid" id="lig-format-selector">
              <label class="lig-radio-btn active" data-format="paragraphs">
                <input type="radio" name="format" value="paragraphs" checked /> Paragraphs
              </label>
              <label class="lig-radio-btn" data-format="sentences">
                <input type="radio" name="format" value="sentences" /> Sentences
              </label>
              <label class="lig-radio-btn" data-format="words">
                <input type="radio" name="format" value="words" /> Words
              </label>
              <label class="lig-radio-btn" data-format="bullets">
                <input type="radio" name="format" value="bullets" /> Bullet List
              </label>
            </div>
          </div>

          <div class="lig-group">
            <div class="lig-slider-container">
              <div class="lig-slider-header">
                <span class="lig-label" style="margin:0;">Count Quantity</span>
                <span id="lig-count-val">5</span>
              </div>
              <input type="range" id="lig-slider" class="lig-slider" min="1" max="50" value="5" />
            </div>
          </div>

          <div class="lig-group">
            <label class="lig-label">Customization</label>
            <label class="lig-checkbox-btn">
              <input type="checkbox" id="lig-opt-html-tags" /> Include HTML Formatting Tags (&lt;strong&gt;, &lt;em&gt;)
            </label>
          </div>

          <button id="lig-generate-btn" class="lig-btn">Generate Lorem Ipsum</button>
        </div>

        <!-- RIGHT COLUMN: Output Canvas -->
        <div class="lig-card">
          <h2>Output Canvas</h2>

          <div class="lig-canvas-container">
            <div id="lig-canvas" class="lig-canvas"></div>
          </div>

          <h2>Markup & Code Options</h2>
          <div class="lig-group">
            <label class="lig-checkbox-btn">
              <input type="checkbox" id="lig-opt-wrap-p" checked /> Wrap with HTML Tags (&lt;p&gt; or &lt;li&gt;)
            </label>
            <label class="lig-checkbox-btn">
              <input type="checkbox" id="lig-opt-start-lorem" checked /> Start with "Lorem ipsum dolor sit amet..."
            </label>
          </div>

          <div class="lig-actions">
            <button id="lig-copy-text" class="lig-btn">Copy Text</button>
            <button id="lig-copy-html" class="lig-btn lig-btn-secondary">Copy Clean Code</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Elements
  const canvas = container.querySelector("#lig-canvas");
  const countVal = container.querySelector("#lig-count-val");
  const slider = container.querySelector("#lig-slider");
  const generateBtn = container.querySelector("#lig-generate-btn");
  const formatGroup = container.querySelector("#lig-format-selector");
  const wrapPToggle = container.querySelector("#lig-opt-wrap-p");
  const startLoremToggle = container.querySelector("#lig-opt-start-lorem");
  const htmlTagsToggle = container.querySelector("#lig-opt-html-tags");
  const copyTextBtn = container.querySelector("#lig-copy-text");
  const copyHtmlBtn = container.querySelector("#lig-copy-html");

  // Helper Functions
  function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)];
  }

  function generateSentence(wordCount = 10, isFirstSentence = false) {
    let sentenceWords = [];
    
    if (isFirstSentence && state.startWithLorem) {
      sentenceWords = ["Lorem", "ipsum", "dolor", "sit", "amet,", "consectetur", "adipiscing", "elit."];
    } else {
      for (let i = 0; i < wordCount; i++) {
        let word = getRandomWord();
        if (i === 0) word = word.charAt(0).toUpperCase() + word.slice(1);
        
        // Add HTML inline tags if option enabled
        if (state.includeHtmlTags && Math.random() < 0.15 && i > 0 && i < wordCount - 1) {
          word = `<strong>${word}</strong>`;
        } else if (state.includeHtmlTags && Math.random() < 0.15 && i > 0 && i < wordCount - 1) {
          word = `<em>${word}</em>`;
        }
        
        sentenceWords.push(word);
      }
    }

    let sentenceStr = sentenceWords.join(" ");
    if (!sentenceStr.endsWith(".")) {
      sentenceStr += ".";
    }
    return sentenceStr;
  }

  function generateParagraph(sentenceCount = 5, isFirstParagraph = false) {
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      sentences.push(generateSentence(8 + Math.floor(Math.random() * 6), isFirstParagraph && i === 0));
    }
    return sentences.join(" ");
  }

  // Core Text Generator
  function buildLoremIpsumText() {
    let output = "";

    if (state.format === "paragraphs") {
      let list = [];
      for (let i = 0; i < state.count; i++) {
        let p = generateParagraph(4 + Math.floor(Math.random() * 3), i === 0);
        if (state.wrapParagraphs) p = `<p>${p}</p>`;
        list.push(p);
      }
      output = list.join(state.wrapParagraphs ? "\n\n" : "\n\n");
    } 
    else if (state.format === "sentences") {
      let list = [];
      for (let i = 0; i < state.count; i++) {
        let s = generateSentence(8 + Math.floor(Math.random() * 5), i === 0);
        if (state.wrapParagraphs) s = `<span>${s}</span>`;
        list.push(s);
      }
      output = list.join(state.wrapParagraphs ? "\n" : " ");
    } 
    else if (state.format === "words") {
      let list = [];
      if (state.startWithLorem) {
        list = ["Lorem", "ipsum", "dolor", "sit", "amet"];
      }
      while (list.length < state.count) {
        list.push(getRandomWord());
      }
      output = list.slice(0, state.count).join(" ");
    } 
    else if (state.format === "bullets") {
      let list = [];
      for (let i = 0; i < state.count; i++) {
        let item = generateSentence(6 + Math.floor(Math.random() * 4), i === 0);
        if (state.wrapParagraphs) {
          item = `  <li>${item}</li>`;
        } else {
          item = `• ${item}`;
        }
        list.push(item);
      }
      if (state.wrapParagraphs) {
        output = `<ul>\n${list.join("\n")}\n</ul>`;
      } else {
        output = list.join("\n");
      }
    }

    canvas.innerText = output;
  }

  // Flash UI element for micro-interaction
  function triggerPulse() {
    canvas.classList.remove("lig-highlight");
    void canvas.offsetWidth; // Force reflow
    canvas.classList.add("lig-highlight");
  }

  // Event Listeners: Format Selection
  const formatBtns = formatGroup.querySelectorAll(".lig-radio-btn");
  formatBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      formatBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.format = btn.getAttribute("data-format");
      buildLoremIpsumText();
      triggerPulse();
    });
  });

  // Dynamic Slider adjustment (updates immediately)
  slider.addEventListener("input", (e) => {
    state.count = parseInt(e.target.value, 10);
    countVal.innerText = state.count;
    buildLoremIpsumText();
  });

  // Checkbox micro-interactions
  wrapPToggle.addEventListener("change", (e) => {
    state.wrapParagraphs = e.target.checked;
    buildLoremIpsumText();
    triggerPulse();
  });

  startLoremToggle.addEventListener("change", (e) => {
    state.startWithLorem = e.target.checked;
    buildLoremIpsumText();
    triggerPulse();
  });

  htmlTagsToggle.addEventListener("change", (e) => {
    state.includeHtmlTags = e.target.checked;
    buildLoremIpsumText();
    triggerPulse();
  });

  generateBtn.addEventListener("click", () => {
    buildLoremIpsumText();
    triggerPulse();
  });

  // Action Bar Logic
  copyTextBtn.addEventListener("click", () => {
    if (!canvas.innerText) return;
    navigator.clipboard.writeText(canvas.innerText);
    copyTextBtn.innerText = "Copied Text!";
    setTimeout(() => (copyTextBtn.innerText = "Copy Text"), 1500);
  });

  copyHtmlBtn.addEventListener("click", () => {
    if (!canvas.innerText) return;
    navigator.clipboard.writeText(canvas.innerText);
    copyHtmlBtn.innerText = "Copied Code!";
    setTimeout(() => (copyHtmlBtn.innerText = "Copy Clean Code"), 1500);
  });

  // Initial render
  buildLoremIpsumText();
}
export function initParagraphWriter(containerId) {
  const container = typeof containerId === "string" 
    ? document.getElementById(containerId) 
    : containerId;

  if (!container) return;

  const mockData = {
    Professional: {
      Short: "Our strategic initiatives prioritize scalable infrastructure and streamlined operations to maximize efficiency.",
      Medium: "Our strategic initiatives prioritize scalable infrastructure and streamlined operational processes. By leveraging industry-leading automation practices, we enable cross-functional teams to maximize productivity, maintain quality assurance, and drive sustainable organizational growth.",
      Detailed: "Our strategic initiatives prioritize scalable technology infrastructure and streamlined operational processes. By systematically integrating automation and data-driven insights into core workflows, we empower cross-functional teams to eliminate bottlenecks, maintain high quality standards, and sustain long-term business performance across all departments."
    },
    Casual: {
      Short: "We're focusing on getting things built fast and keeping everything super smooth for everyone.",
      Medium: "We're focusing on getting things built fast and keeping everything running smoothly for everyone. By using smart automated tools, our teams can cut out busywork, stay super productive, and keep making awesome stuff without burning out.",
      Detailed: "We're focusing on getting things built fast and keeping everything running smoothly for everyone. By taking advantage of cool automation tools, our team can skip the tedious manual tasks, stay productive, and focus on delivering awesome results without extra stress."
    },
    Academic: {
      Short: "The current technological paradigm emphasizes structural scalability and systemic operational optimization.",
      Medium: "The current technological paradigm emphasizes structural scalability and systemic operational optimization. Through the empirical application of automated methodologies, organizational frameworks achieve enhanced resource allocation, thereby accelerating production capacity and minimizing structural inefficiencies.",
      Detailed: "The current technological paradigm emphasizes structural scalability and systemic operational optimization. Through the systematic deployment of automated workflows, organizational frameworks demonstrate elevated efficiency metrics. Consequently, operational bottlenecks are systematically mitigated, yielding sustained quantitative progress."
    },
    Creative: {
      Short: "We build digital bridges where ideas flow seamlessly into limitless future possibilities.",
      Medium: "We build digital bridges where ideas flow seamlessly into limitless possibilities. Harnessing the power of intelligent systems, our creative engine crafts bold pathways, turning complex vision into effortless reality.",
      Detailed: "We build digital bridges where ideas flow seamlessly into limitless possibilities. Harnessing the power of intelligent systems, our creative engine crafts bold new pathways, inspiring teams to push past traditional limits and shape the future of innovation."
    }
  };

  let state = {
    prompt: "",
    tone: "Professional",
    length: "Medium",
    generatedText: ""
  };

  container.innerHTML = `
    <div class="pw-wrapper">
      <div class="pw-header">
        <h1>Paragraph Writer / AI Assistant</h1>
        <p>Draft, refine, and restructure high-quality paragraphs instantly with custom tones.</p>
      </div>

      <div class="pw-container">
        <!-- Left Column: Controls -->
        <div class="pw-card">
          <h2>Controls & Parameters</h2>
          
          <div class="pw-group">
            <label for="pw-prompt">Topic / Core Prompt</label>
            <textarea id="pw-prompt" class="pw-textarea" placeholder="Describe what to write..."></textarea>
          </div>

          <div class="pw-group">
            <label>Tone & Style</label>
            <div class="pw-options-grid" id="pw-tone-selector">
              <label class="pw-radio-btn active" data-tone="Professional">
                <input type="radio" name="tone" value="Professional" checked /> Professional
              </label>
              <label class="pw-radio-btn" data-tone="Casual">
                <input type="radio" name="tone" value="Casual" /> Casual
              </label>
              <label class="pw-radio-btn" data-tone="Academic">
                <input type="radio" name="tone" value="Academic" /> Academic
              </label>
              <label class="pw-radio-btn" data-tone="Creative">
                <input type="radio" name="tone" value="Creative" /> Creative
              </label>
            </div>
          </div>

          <div class="pw-group">
            <label>Paragraph Length</label>
            <div class="pw-options-grid-3" id="pw-length-selector">
              <label class="pw-radio-btn" data-length="Short">
                <input type="radio" name="length" value="Short" /> Short
              </label>
              <label class="pw-radio-btn active" data-length="Medium">
                <input type="radio" name="length" value="Medium" checked /> Medium
              </label>
              <label class="pw-radio-btn" data-length="Detailed">
                <input type="radio" name="length" value="Detailed" /> Detailed
              </label>
            </div>
          </div>

          <button id="pw-generate-btn" class="pw-btn">Generate Paragraph</button>
        </div>

        <!-- Right Column: Output -->
        <div class="pw-card">
          <h2>Draft Canvas</h2>
          <div id="pw-canvas" class="pw-canvas">Click "Generate Paragraph" to build text...</div>

          <h2>Refinement Toolbar</h2>
          <div class="pw-actions">
            <button id="pw-btn-longer" class="pw-btn pw-btn-secondary">Make Longer</button>
            <button id="pw-btn-simplify" class="pw-btn pw-btn-secondary">Simplify Text</button>
            <button id="pw-btn-grammar" class="pw-btn pw-btn-secondary">Fix Grammar</button>
            <button id="pw-btn-regenerate" class="pw-btn pw-btn-secondary">Re-generate</button>
          </div>

          <div class="pw-actions" style="margin-top: auto;">
            <button id="pw-btn-copy" class="pw-btn">Copy Paragraph</button>
            <button id="pw-btn-export" class="pw-btn pw-btn-secondary">Export Text</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Dynamic Elements
  const canvas = container.querySelector("#pw-canvas");
  const promptInput = container.querySelector("#pw-prompt");
  const generateBtn = container.querySelector("#pw-generate-btn");
  const toneGroup = container.querySelector("#pw-tone-selector");
  const lengthGroup = container.querySelector("#pw-length-selector");
  const copyBtn = container.querySelector("#pw-btn-copy");
  const exportBtn = container.querySelector("#pw-btn-export");

  // Selection state
  const toneBtns = toneGroup.querySelectorAll(".pw-radio-btn");
  toneBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      toneBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.tone = btn.getAttribute("data-tone");
    });
  });

  const lengthBtns = lengthGroup.querySelectorAll(".pw-radio-btn");
  lengthBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      lengthBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.length = btn.getAttribute("data-length");
    });
  });

  // Streaming Effect Generation
  function generateContent() {
    canvas.classList.add("pw-canvas-pulse");
    canvas.innerText = "";
    
    const targetText = mockData[state.tone][state.length];
    let index = 0;

    const interval = setInterval(() => {
      if (index < targetText.length) {
        canvas.innerText += targetText.charAt(index);
        index++;
      } else {
        clearInterval(interval);
        canvas.classList.remove("pw-canvas-pulse");
        state.generatedText = targetText;
      }
    }, 15);
  }

  generateBtn.addEventListener("click", generateContent);
  container.querySelector("#pw-btn-regenerate").addEventListener("click", generateContent);

  // Refinement Action Handlers
  container.querySelector("#pw-btn-longer").addEventListener("click", () => {
    if (!state.generatedText) return;
    canvas.innerText += " Furthermore, this ongoing iterative process guarantees optimal resource deployment over time.";
    state.generatedText = canvas.innerText;
  });

  container.querySelector("#pw-btn-simplify").addEventListener("click", () => {
    if (!state.generatedText) return;
    canvas.innerText = mockData["Casual"]["Short"];
    state.generatedText = canvas.innerText;
  });

  container.querySelector("#pw-btn-grammar").addEventListener("click", () => {
    if (!state.generatedText) return;
    const btn = container.querySelector("#pw-btn-grammar");
    btn.innerText = "Grammar Cleaned!";
    setTimeout(() => (btn.innerText = "Fix Grammar"), 1500);
  });

  // Copy Clipboard Logic
  copyBtn.addEventListener("click", () => {
    if (!canvas.innerText) return;
    navigator.clipboard.writeText(canvas.innerText);
    copyBtn.innerText = "Copied!";
    setTimeout(() => (copyBtn.innerText = "Copy Paragraph"), 1500);
  });

  // Export Logic
  exportBtn.addEventListener("click", () => {
    if (!canvas.innerText) return;
    const blob = new Blob([canvas.innerText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "generated-paragraph.txt";
    link.click();
  });

  // Inline Floating Selection Micro-menu
  let inlineMenu = null;

  canvas.addEventListener("mouseup", (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (inlineMenu) {
      inlineMenu.remove();
      inlineMenu = null;
    }

    if (selectedText.length > 0 && canvas.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      inlineMenu = document.createElement("div");
      inlineMenu.className = "pw-inline-menu";
      inlineMenu.innerHTML = `
        <button id="pw-menu-rephrase">Rephrase</button>
        <button id="pw-menu-shorten">Shorten</button>
        <button id="pw-menu-expand">Expand</button>
      `;

      document.body.appendChild(inlineMenu);

      inlineMenu.style.left = `${rect.left + window.scrollX}px`;
      inlineMenu.style.top = `${rect.top + window.scrollY}px`;

      inlineMenu.querySelector("#pw-menu-rephrase").onclick = () => {
        canvas.innerText = canvas.innerText.replace(selectedText, `[rephrased: ${selectedText}]`);
        inlineMenu.remove();
      };
      inlineMenu.querySelector("#pw-menu-shorten").onclick = () => {
        canvas.innerText = canvas.innerText.replace(selectedText, `[concise text]`);
        inlineMenu.remove();
      };
      inlineMenu.querySelector("#pw-menu-expand").onclick = () => {
        canvas.innerText = canvas.innerText.replace(selectedText, `${selectedText} with comprehensive detail`);
        inlineMenu.remove();
      };
    }
  });
}
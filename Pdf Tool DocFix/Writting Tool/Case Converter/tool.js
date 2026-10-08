import './tool.css';

/**
 * Render function to create the Case Converter DOM structure.
 * @param {HTMLElement} targetElement - Container where the UI renders.
 */
export function renderCaseConverter(targetElement) {
  if (!targetElement) return;

  targetElement.innerHTML = `
    <div class="case-converter-container">
      <header class="case-converter-header">
        <h1>Case Converter</h1>
        <p>Convert your text to UPPERCASE, lowercase, Title Case, camelCase, and more.</p>
      </header>

      <div class="case-converter-grid">
        <!-- LEFT COLUMN: Input Text -->
        <div class="case-converter-card">
          <h2>Raw Text Input</h2>
          <div class="input-group">
            <textarea id="raw-text-input" class="case-converter-textarea" placeholder="Type or paste text to convert..."></textarea>
          </div>
          
          <div class="quick-transforms-title">Quick Transforms</div>
          <div class="button-grid">
            <button class="btn" id="btn-quick-sentence">Sentence case</button>
            <button class="btn" id="btn-quick-title">Title Case</button>
            <button class="btn" id="btn-quick-upper">UPPERCASE</button>
            <button class="btn" id="btn-quick-lower">lowercase</button>
          </div>
          <button class="btn btn-danger" id="btn-clear">Clear Text Area</button>
        </div>

        <!-- RIGHT COLUMN: Converted Results -->
        <div class="case-converter-card">
          <h2>Converted Results</h2>
          <div class="results-container">
            <div class="output-item">
              <label>UPPERCASE</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-uppercase" />
                <button class="btn btn-copy" data-target="out-uppercase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>lowercase</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-lowercase" />
                <button class="btn btn-copy" data-target="out-lowercase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>Title Case</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-titlecase" />
                <button class="btn btn-copy" data-target="out-titlecase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>Sentence case</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-sentencecase" />
                <button class="btn btn-copy" data-target="out-sentencecase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>camelCase</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-camelcase" />
                <button class="btn btn-copy" data-target="out-camelcase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>PascalCase</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-pascalcase" />
                <button class="btn btn-copy" data-target="out-pascalcase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>snake_case</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-snakecase" />
                <button class="btn btn-copy" data-target="out-snakecase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>kebab-case</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-kebabcase" />
                <button class="btn btn-copy" data-target="out-kebabcase">Copy</button>
              </div>
            </div>

            <div class="output-item">
              <label>Alternating / Mocking cAsE</label>
              <div class="output-row">
                <input type="text" readonly class="output-input" id="out-mockingcase" />
                <button class="btn btn-copy" data-target="out-mockingcase">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  attachEventListeners(targetElement);
}

/**
 * Text Casing Conversion Helpers
 */
const Conversions = {
  uppercase: (str) => str.toUpperCase(),
  lowercase: (str) => str.toLowerCase(),
  sentencecase: (str) => {
    return str.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  },
  titlecase: (str) => {
    return str.toLowerCase().replace(/\b\w+/g, (s) => s.charAt(0).toUpperCase() + s.substring(1));
  },
  words: (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/);
  },
  camelcase: (str) => {
    const words = Conversions.words(str);
    if (!words.length || !words[0]) return '';
    return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  },
  pascalcase: (str) => {
    const words = Conversions.words(str);
    if (!words.length || !words[0]) return '';
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  },
  snakecase: (str) => {
    const words = Conversions.words(str);
    if (!words.length || !words[0]) return '';
    return words.map(w => w.toLowerCase()).join('_');
  },
  kebabcase: (str) => {
    const words = Conversions.words(str);
    if (!words.length || !words[0]) return '';
    return words.map(w => w.toLowerCase()).join('-');
  },
  mockingcase: (str) => {
    return str.split('').map((char, index) => index % 2 === 0 ? char.toLowerCase() : char.toUpperCase()).join('');
  }
};

/**
 * Attaches real-time event listeners and micro-interactions
 */
function attachEventListeners(container) {
  const inputArea = container.querySelector('#raw-text-input');
  
  // Output element mapping
  const outputs = {
    uppercase: container.querySelector('#out-uppercase'),
    lowercase: container.querySelector('#out-lowercase'),
    titlecase: container.querySelector('#out-titlecase'),
    sentencecase: container.querySelector('#out-sentencecase'),
    camelcase: container.querySelector('#out-camelcase'),
    pascalcase: container.querySelector('#out-pascalcase'),
    snakecase: container.querySelector('#out-snakecase'),
    kebabcase: container.querySelector('#out-kebabcase'),
    mockingcase: container.querySelector('#out-mockingcase')
  };

  // Live transform on input change
  const updateTransforms = () => {
    const val = inputArea.value;
    for (const key in outputs) {
      if (outputs[key]) {
        outputs[key].value = val ? Conversions[key](val) : '';
      }
    }
  };

  inputArea.addEventListener('input', updateTransforms);

  // Quick Transform Buttons (modifies input directly)
  container.querySelector('#btn-quick-sentence').addEventListener('click', () => {
    inputArea.value = Conversions.sentencecase(inputArea.value);
    updateTransforms();
  });

  container.querySelector('#btn-quick-title').addEventListener('click', () => {
    inputArea.value = Conversions.titlecase(inputArea.value);
    updateTransforms();
  });

  container.querySelector('#btn-quick-upper').addEventListener('click', () => {
    inputArea.value = Conversions.uppercase(inputArea.value);
    updateTransforms();
  });

  container.querySelector('#btn-quick-lower').addEventListener('click', () => {
    inputArea.value = Conversions.lowercase(inputArea.value);
    updateTransforms();
  });

  container.querySelector('#btn-clear').addEventListener('click', () => {
    inputArea.value = '';
    updateTransforms();
  });

  // Clipboard Feedback Micro-interaction
  container.querySelectorAll('.btn-copy').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const targetInput = container.querySelector(`#${targetId}`);

      if (targetInput && targetInput.value) {
        navigator.clipboard.writeText(targetInput.value).then(() => {
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');

          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 1500);
        });
      }
    });
  });
}
/* ---------- Data ---------- */
import { downloadBlob } from "../../shared/download";

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const SIMILAR = /[il1Lo0O]/g;

const WORDS = (
  'apple river stone cloud tiger maple ocean flame garden silver window forest bridge candle dragon falcon harbor ' +
  'island jungle kettle lantern meadow nectar orchid pepper quartz rabbit saddle thunder umbrella velvet walnut ' +
  'yellow zebra anchor basket canyon desert ember feather glacier hammer igloo jacket kitten ladder marble needle ' +
  'olive pillow quiver rocket sunset turtle valley willow copper breeze cactus dolphin eagle fabric galaxy honey ' +
  'ivory jewel koala lemon mirror nickel oyster parrot quilt ribbon sparrow temple unicorn violet whisper yonder ' +
  'zephyr amber beacon cherry dawn echo fossil ginger hazel iris jasper kiwi lotus mango noble opal piano quest ' +
  'raven spruce tulip urban vivid wagon xenon yarn zinc bamboo coral drift elbow fjord grove harvest inkwell ' +
  'jigsaw kayak lagoon magnet nutmeg orbit pebble quasar rhythm summit timber'
).split(' ');

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

/* ---------- Crypto helpers ---------- */
// Unbiased random integer in [0, max) using rejection sampling
function randomInt(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Public generators (reusable on their own) ---------- */
export function generatePassword({ length = 24, upper = true, lower = true, numbers = true, symbols = true, excludeSimilar = false } = {}) {
  const pools = Object.keys(SETS)
    .filter((k) => ({ upper, lower, numbers, symbols })[k])
    .map((k) => (excludeSimilar ? SETS[k].replace(SIMILAR, '') : SETS[k]))
    .filter(Boolean);
  if (!pools.length) return null;

  const all = pools.join('');
  const chars = pools.map((p) => p[randomInt(p.length)]); // at least one from each selected set
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  shuffle(chars);

  return { value: chars.slice(0, length).join(''), entropy: length * Math.log2(all.length) };
}

export function generatePassphrase({ words = 5, capitalize = true, addNumber = true, separator = '-' } = {}) {
  const parts = [];
  for (let i = 0; i < words; i++) {
    const w = WORDS[randomInt(WORDS.length)];
    parts.push(capitalize ? w[0].toUpperCase() + w.slice(1) : w);
  }
  let value = parts.join(separator);
  let entropy = words * Math.log2(WORDS.length);
  if (addNumber) {
    value += separator + randomInt(100);
    entropy += Math.log2(100);
  }
  return { value, entropy };
}

export function getStrength(bits) {
  if (bits < 40) return { label: 'Weak', cls: 'pg-weak' };
  if (bits < 60) return { label: 'Medium', cls: 'pg-medium' };
  if (bits < 80) return { label: 'Strong', cls: 'pg-strong' };
  return { label: 'Very Strong', cls: 'pg-very-strong' };
}

/* ---------- UI ---------- */
const TEMPLATE = `
<div class="pg-root">
  <header class="pg-header">
    <h1>Strong Password Generator</h1>
    <p>Generate cryptographically secure random passwords and passphrases in seconds.</p>
  </header>

  <section class="pg-card">
    <div class="pg-output">
      <div class="pg-value" data-out aria-live="polite"></div>
      <div class="pg-actions">
        <button type="button" class="pg-btn" data-copy>Copy</button>
        <button type="button" class="pg-btn pg-btn-icon" data-refresh aria-label="Generate new">&#8635;</button>
      </div>
    </div>

    <div class="pg-meter">
      <div class="pg-bar"><div class="pg-fill" data-fill></div></div>
      <span class="pg-meter-label" data-meter-label></span>
    </div>

    <h2 class="pg-title">Parameter Options</h2>

    <div class="pg-row">
      <span class="pg-label">Mode</span>
      <div class="pg-segment">
        <button type="button" data-mode="password" aria-pressed="true">Random Password</button>
        <button type="button" data-mode="passphrase" aria-pressed="false">Memorable Passphrase</button>
      </div>
    </div>

    <div class="pg-row pg-column">
      <span class="pg-label" data-len-label></span>
      <input type="range" class="pg-range" data-len aria-label="Length" />
    </div>

    <div data-group="password">
      <h2 class="pg-title">Character Sets Included</h2>
      <div class="pg-grid">
        <label class="pg-check"><input type="checkbox" data-set="upper" checked /> Uppercase (A-Z)</label>
        <label class="pg-check"><input type="checkbox" data-set="lower" checked /> Lowercase (a-z)</label>
        <label class="pg-check"><input type="checkbox" data-set="numbers" checked /> Numbers (0-9)</label>
        <label class="pg-check"><input type="checkbox" data-set="symbols" checked /> Symbols (@#$%^&amp;*)</label>
      </div>
      <label class="pg-check pg-block"><input type="checkbox" data-similar /> Exclude similar (i, l, 1, L, o, 0, O)</label>
    </div>

    <div data-group="passphrase" hidden>
      <h2 class="pg-title">Passphrase Options</h2>
      <div class="pg-grid">
        <label class="pg-check"><input type="checkbox" data-capitalize checked /> Capitalize words</label>
        <label class="pg-check"><input type="checkbox" data-addnumber checked /> Append a number</label>
      </div>
    </div>

    <h2 class="pg-title">Bulk Export Generator</h2>
    <div class="pg-bulk">
      <label class="pg-label">Quantity
        <input type="number" class="pg-input" data-qty min="1" max="1000" value="10" />
      </label>
      <button type="button" class="pg-btn pg-btn-primary" data-bulk>Generate &amp; Export Bulk List (.TXT)</button>
    </div>
  </section>

  <div class="pg-toast" data-toast role="status" aria-live="polite"></div>
</div>
`;

export function initPasswordGenerator(container) {
  if (!container) throw new Error('initPasswordGenerator: container element is required');
  container.innerHTML = TEMPLATE;

  const $ = (s) => container.querySelector(s);
  const $$ = (s) => Array.from(container.querySelectorAll(s));

  const out = $('[data-out]');
  const fill = $('[data-fill]');
  const meterLabel = $('[data-meter-label]');
  const lenInput = $('[data-len]');
  const lenLabel = $('[data-len-label]');
  const toast = $('[data-toast]');
  const qty = $('[data-qty]');

  const RANGES = {
    password: { min: 4, max: 64, unit: 'Characters', title: 'Password Length' },
    passphrase: { min: 3, max: 10, unit: 'Words', title: 'Word Count' },
  };
  const state = { mode: 'password', len: { password: 24, passphrase: 5 }, current: '', anim: null, toastTimer: null, clearTimer: null };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isOn = (name) => $(`[data-set="${name}"]`).checked;

  function generateCurrent() {
    if (state.mode === 'passphrase') {
      return generatePassphrase({
        words: state.len.passphrase,
        capitalize: $('[data-capitalize]').checked,
        addNumber: $('[data-addnumber]').checked,
      });
    }
    return generatePassword({
      length: state.len.password,
      upper: isOn('upper'),
      lower: isOn('lower'),
      numbers: isOn('numbers'),
      symbols: isOn('symbols'),
      excludeSimilar: $('[data-similar]').checked,
    });
  }

  function updateMeter(bits) {
    const s = getStrength(bits);
    fill.className = 'pg-fill ' + s.cls;
    fill.style.width = Math.min(100, (bits / 128) * 100) + '%';
    meterLabel.textContent = `${s.label} (${Math.round(bits)} Bits)`;
  }

  function scramble(finalText) {
    clearInterval(state.anim);
    if (reduceMotion) {
      out.textContent = finalText;
      return;
    }
    let frame = 0;
    const total = 14;
    state.anim = setInterval(() => {
      frame++;
      const reveal = Math.floor((finalText.length * frame) / total);
      let s = finalText.slice(0, reveal);
      for (let i = reveal; i < finalText.length; i++) s += GLYPHS[randomInt(GLYPHS.length)];
      out.textContent = s;
      if (frame >= total) {
        clearInterval(state.anim);
        out.textContent = finalText;
      }
    }, 30);
  }

  function render(animate) {
    const result = generateCurrent();
    if (!result) return;
    state.current = result.value;
    updateMeter(result.entropy);
    if (animate) scramble(result.value);
    else {
      clearInterval(state.anim);
      out.textContent = result.value;
    }
  }

  function syncSlider() {
    const r = RANGES[state.mode];
    lenInput.min = r.min;
    lenInput.max = r.max;
    lenInput.value = state.len[state.mode];
    lenLabel.textContent = `${r.title}: ${state.len[state.mode]} ${r.unit}`;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('pg-toast-show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('pg-toast-show'), 4000);
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  async function copy() {
    const text = state.current;
    if (!text) return;
    if (!(await writeClipboard(text))) {
      showToast('Copy failed. Please select the text and copy manually.');
      return;
    }
    showToast('Copied! Clipboard will self-clear in 60 seconds.');
    clearTimeout(state.clearTimer);
    state.clearTimer = setTimeout(async () => {
      try {
        const now = await navigator.clipboard.readText();
        if (now === text) await navigator.clipboard.writeText('');
      } catch (e) {
        try { await navigator.clipboard.writeText(''); } catch (_) {}
      }
    }, 60000);
  }

  function exportBulk() {
    const n = Math.min(1000, Math.max(1, parseInt(qty.value, 10) || 1));
    qty.value = n;
    const lines = [];
    for (let i = 0; i < n; i++) lines.push(generateCurrent().value);
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
    const result = downloadBlob(blob, `passwords-${n}.txt`);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    showToast(`${n} passwords exported. Store the file securely and delete it after use.`);
  }

  /* ---------- Events ---------- */
  $('[data-copy]').addEventListener('click', copy);
  $('[data-refresh]').addEventListener('click', () => render(true));
  $('[data-bulk]').addEventListener('click', exportBulk);

  lenInput.addEventListener('input', () => {
    state.len[state.mode] = Number(lenInput.value);
    syncSlider();
    render(false);
  });

  $$('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      $$('[data-group]').forEach((g) => { g.hidden = g.dataset.group !== state.mode; });
      syncSlider();
      render(true);
    })
  );

  $$('[data-set]').forEach((cb) =>
    cb.addEventListener('change', () => {
      // At least one character set must stay selected
      if (!$$('[data-set]').some((c) => c.checked)) cb.checked = true;
      render(false);
    })
  );
  ['[data-similar]', '[data-capitalize]', '[data-addnumber]'].forEach((sel) =>
    $(sel).addEventListener('change', () => render(false))
  );

  syncSlider();
  render(false);

  // Cleanup function (the clipboard auto-clear timer is intentionally kept alive)
  return function destroy() {
    clearInterval(state.anim);
    clearTimeout(state.toastTimer);
    container.innerHTML = '';
  };
}
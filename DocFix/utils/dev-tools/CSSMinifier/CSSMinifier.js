/* ==========================================================================
   tool.js — CSS Minifier utility
   Plain JavaScript. No JSX, no dependencies, no wrapper component.

   Exports:
     minifyCSS(css, options)              -> minified string
     validateCSS(css)                     -> [{ line, message }]
     createCssMinifier(container, o)      -> { minify, setInput, getOutput, destroy }
   ========================================================================== */

import { downloadBlob } from "../../shared/download";

export const DEFAULT_OPTIONS = {
  convertColors: true, // rgb(255,0,0) -> #f00, #ffffff -> #fff
  stripZeroUnits: true, // 0px -> 0, 0.5 -> .5
  removeLastSemicolon: true, // {a:b;} -> {a:b}
  shorthand: true, // margin/padding longhands -> shorthand, 0 0 0 0 -> 0
  removeVendorPrefixes: false, // drop -webkit-x when x exists in same rule
};

const TOKEN = '\u0001';
const LINE_HEIGHT = 20; // must match tool.css
const PAD_TOP = 10; // must match tool.css
const SIDES = ['top', 'right', 'bottom', 'left'];
const UNITS = 'px|em|rem|pt|pc|cm|mm|in|ex|ch|vh|vw|vmin|vmax';
const ZERO_UNIT_RE = new RegExp('(?<![\\w.#%-])-?(?:0+\\.?0*|\\.0+)(?:' + UNITS + ')(?![\\w-])', 'gi');
const LEAD_ZERO_RE = /(?<![\w.#-])(-?)0+(?=\.\d)/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*(?:1|1\.0+|100%))?\s*\)/gi;

/* ------------------------------ Minifier ------------------------------ */

function stripComments(css) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < css.length) {
    const c = css[i];
    const n = css[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += css[i + 1] || '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Replace strings and unquoted url(...) with tokens so they are never altered.
function protect(css, store) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') j++;
        j++;
      }
      store.push(css.slice(i, j + 1));
      out += TOKEN + (store.length - 1) + TOKEN;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/url\(([^)\u0001]+)\)/gi, (m, inner) => {
    store.push('url(' + inner.trim() + ')');
    return TOKEN + (store.length - 1) + TOKEN;
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitTop(value) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && !depth) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function toHex(n) {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

function convertColors(value) {
  value = value.replace(RGB_RE, (m, r, g, b) => '#' + toHex(+r) + toHex(+g) + toHex(+b));
  return value.replace(/#([0-9a-f]{8}|[0-9a-f]{6})(?![\w-])/gi, (m, hex) => {
    const h = hex.toLowerCase();
    const pairs = h.match(/../g);
    if (pairs.every((p) => p[0] === p[1])) return '#' + pairs.map((p) => p[0]).join('');
    return '#' + h;
  });
}

function stripZeros(value, allowUnitStrip) {
  if (allowUnitStrip) value = value.replace(ZERO_UNIT_RE, '0');
  return value.replace(LEAD_ZERO_RE, '$1');
}

function processValue(prop, value, o) {
  if (prop.startsWith('--')) return value; // custom properties may be used inside calc()
  if (o.convertColors) value = convertColors(value);
  if (o.stripZeroUnits) value = stripZeros(value, !/\b(calc|clamp|min|max)\(/i.test(value));
  return value;
}

function shortenBox(t) {
  t = t.slice();
  if (t.length === 4 && t[3] === t[1]) t.pop();
  if (t.length === 3 && t[2] === t[0]) t.pop();
  if (t.length === 2 && t[1] === t[0]) t.pop();
  return t;
}

function consolidate(decls) {
  ['margin', 'padding'].forEach((fam) => {
    const names = SIDES.map((s) => fam + '-' + s);
    const idx = names.map((n) => decls.findIndex((d) => d.prop === n));
    const once = names.every((n) => decls.filter((d) => d.prop === n).length === 1);
    if (!once || decls.some((d) => d.prop === fam)) return;
    const vals = idx.map((i) => decls[i].value);
    const safe = vals.every(
      (v) => splitTop(v).length === 1 && !/!important/i.test(v) && !/^(inherit|initial|unset|revert|revert-layer)$/i.test(v)
    );
    if (!safe) return;
    const first = Math.min.apply(null, idx);
    decls[first] = { prop: fam, value: shortenBox(vals).join(' ') };
    decls = decls.filter((d, i) => i === first || idx.indexOf(i) === -1);
  });
  decls.forEach((d) => {
    if ((d.prop === 'margin' || d.prop === 'padding') && !/!important/i.test(d.value)) {
      d.value = shortenBox(splitTop(d.value)).join(' ');
    }
  });
  return decls;
}

function dropPrefixed(decls) {
  const names = new Set(decls.filter((d) => d.prop).map((d) => d.prop));
  return decls.filter((d) => {
    if (!d.prop) return true;
    const m = d.prop.match(/^-(?:webkit|moz|ms|o)-(.+)$/);
    return !(m && names.has(m[1]));
  });
}

function removePrefixedKeyframes(css) {
  const re = /@-(?:webkit|moz|o|ms)-keyframes\s+([^\s{]+)\s*\{/gi;
  let m;
  while ((m = re.exec(css))) {
    if (!new RegExp('@keyframes\\s+' + escapeRe(m[1]) + '\\s*\\{').test(css)) continue;
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth) {
      const ch = css[i++];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    css = css.slice(0, m.index) + css.slice(i);
    re.lastIndex = m.index;
  }
  return css;
}

function processBlock(body, o) {
  let decls = body
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const i = raw.indexOf(':');
      if (i < 1) return { raw };
      let prop = raw.slice(0, i).trim();
      if (!prop.startsWith('--')) prop = prop.toLowerCase();
      return { prop, value: processValue(prop, raw.slice(i + 1).trim(), o) };
    });
  if (o.removeVendorPrefixes) decls = dropPrefixed(decls);
  if (o.shorthand) decls = consolidate(decls);
  const text = decls.map((d) => (d.prop ? d.prop + ':' + d.value : d.raw)).join(';');
  return o.removeLastSemicolon || !text ? text : text + ';';
}

export function minifyCSS(input, userOptions) {
  const o = Object.assign({}, DEFAULT_OPTIONS, userOptions);
  const store = [];
  let css = protect(stripComments(String(input || '')), store);

  css = css
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*!\s*important/gi, '!important')
    .replace(/;{2,}/g, ';')
    .trim();

  if (o.removeVendorPrefixes) css = removePrefixedKeyframes(css);

  // Innermost { ... } blocks contain the declarations.
  css = css.replace(/\{([^{}]*)\}/g, (m, body) => '{' + processBlock(body, o) + '}');

  // Remove empty rules (repeat for nested empty at-rules).
  let prev;
  do {
    prev = css;
    css = css.replace(/[^{};]+\{\}/g, '');
  } while (css !== prev);

  return css.replace(/\u0001(\d+)\u0001/g, (m, n) => store[+n]);
}

/* ------------------------------ Validation ------------------------------ */

export function validateCSS(css) {
  const errors = [];
  const stack = [];
  let line = 1;
  let i = 0;
  let quote = null;
  let quoteLine = 0;
  while (i < css.length) {
    const c = css[i];
    const n = css[i + 1];
    if (c === '\n') line++;
    if (quote) {
      if (c === '\\') {
        if (n === '\n') line++;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      else if (c === '\n') {
        errors.push({ line: quoteLine, message: 'Unterminated string' });
        quote = null;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      quoteLine = line;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) {
        errors.push({ line, message: 'Unclosed comment (missing */)' });
        break;
      }
      line += (css.slice(i, end).match(/\n/g) || []).length;
      i = end + 2;
      continue;
    }
    if (c === '{') stack.push(line);
    else if (c === '}') {
      if (stack.length) stack.pop();
      else errors.push({ line, message: "Unexpected '}' with no matching '{'" });
    }
    i++;
  }
  if (quote) errors.push({ line: quoteLine, message: 'Unterminated string' });
  stack.forEach((l) => errors.push({ line: l, message: "Unclosed '{' (missing closing '}')" }));
  return errors.sort((a, b) => a.line - b.line);
}

/* ------------------------------ UI helpers ------------------------------ */

const ICONS = {
  paste:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>',
  upload:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
  clear:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check:
    '<svg class="cssmin__check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
};

function h(tag, props, children) {
  const node = document.createElement(tag);
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

function setButton(btn, icon, label) {
  btn.innerHTML = (icon || '') + '<span class="cssmin__btn-label">' + label + '</span>';
}

function makeButton(icon, label, variant) {
  const btn = h('button', { type: 'button', className: 'cssmin__btn' + (variant ? ' cssmin__btn--' + variant : '') });
  setButton(btn, icon, label);
  return btn;
}

function byteSize(s) {
  return new TextEncoder().encode(s).length;
}

function formatBytes(n) {
  return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
}

const RULES = [
  ['convertColors', 'Convert Colors (rgb to hex)'],
  ['stripZeroUnits', 'Strip Zero Units (0px to 0)'],
  ['removeLastSemicolon', 'Remove Last Semicolons'],
  ['shorthand', 'Merge Shorthand (margin / padding)'],
  ['removeVendorPrefixes', 'Remove Redundant Vendor Prefixes'],
];

/* ------------------------------ Main UI ------------------------------ */

export function createCssMinifier(container, userOptions) {
  if (!container) throw new Error('createCssMinifier: a container element is required');

  const ac = new AbortController();
  const opts = Object.assign({}, DEFAULT_OPTIONS, userOptions);
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ac.signal });
  let fileName = 'styles';
  let copyTimer = null;
  let inputTimer = null;
  let errors = [];

  /* ---- build DOM ---- */
  const btnPaste = makeButton(ICONS.paste, 'Paste', 'ghost');
  const btnUpload = makeButton(ICONS.upload, 'Upload CSS File', 'ghost');
  const btnClear = makeButton(ICONS.clear, 'Clear', 'ghost');
  const fileInput = h('input', { type: 'file', accept: '.css,text/css', hidden: '' });

  const ribbon = h('div', { className: 'cssmin__ribbon', role: 'alert', hidden: '' });
  const gutter = h('div', { className: 'cssmin__gutter', 'aria-hidden': 'true' });
  const input = h('textarea', {
    className: 'cssmin__textarea',
    spellcheck: 'false',
    wrap: 'off',
    placeholder: '.header {\n  background-color: #ffffff;\n  margin: 0px 0px 0px 0px;\n}',
    'aria-label': 'Raw CSS input',
  });
  const btnMinify = makeButton('', 'Minify CSS', 'primary');

  const sizeText = h('span', { className: 'cssmin__size', text: 'Size: — → —' });
  const badge = h('span', { className: 'cssmin__badge', hidden: '' });
  const output = h('textarea', {
    className: 'cssmin__textarea cssmin__textarea--output',
    readonly: '',
    spellcheck: 'false',
    wrap: 'off',
    placeholder: 'Minified CSS will appear here…',
    'aria-label': 'Minified CSS output',
  });

  const rulesBox = h('fieldset', { className: 'cssmin__rules' }, [h('legend', { text: 'Customization Rules' })]);
  const checkboxes = {};
  RULES.forEach(([key, label]) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = !!opts[key];
    checkboxes[key] = cb;
    rulesBox.appendChild(h('label', { className: 'cssmin__rule' }, [cb, h('span', { text: label })]));
  });

  const btnCopy = makeButton(ICONS.copy, 'Copy to Clipboard', 'ghost');
  const btnDownload = makeButton(ICONS.download, 'Download', 'ghost');
  btnCopy.disabled = true;
  btnDownload.disabled = true;

  const left = h('section', { className: 'cssmin__panel' }, [
    h('h2', { className: 'cssmin__title', text: 'Raw CSS Input' }),
    h('div', { className: 'cssmin__toolbar' }, [btnPaste, btnUpload, btnClear, fileInput]),
    ribbon,
    h('div', { className: 'cssmin__editor' }, [gutter, input]),
    h('div', { className: 'cssmin__actions' }, [btnMinify]),
  ]);

  const right = h('section', { className: 'cssmin__panel' }, [
    h('h2', { className: 'cssmin__title', text: 'Optimized Output' }),
    h('div', { className: 'cssmin__metrics' }, [sizeText, badge]),
    h('div', { className: 'cssmin__editor cssmin__editor--output' }, [output]),
    rulesBox,
    h('div', { className: 'cssmin__actions' }, [btnCopy, btnDownload]),
  ]);

  const root = h('div', { className: 'cssmin' }, [
    h('header', { className: 'cssmin__header' }, [
      h('h1', { text: 'CSS Minifier' }),
      h('p', { text: 'Compress CSS stylesheets by stripping unnecessary code and optimizing rules.' }),
    ]),
    h('div', { className: 'cssmin__grid' }, [left, right]),
  ]);

  container.innerHTML = '';
  container.appendChild(root);

  /* ---- editor state (gutter, error ribbon, red line highlight) ---- */
  function refreshEditor() {
    const value = input.value;
    errors = validateCSS(value);

    const lines = value.split('\n').length;
    const bad = {};
    errors.forEach((e) => (bad[e.line] = true));
    let html = '';
    for (let n = 1; n <= lines; n++) html += '<div' + (bad[n] ? ' class="is-error"' : '') + '>' + n + '</div>';
    gutter.innerHTML = html;
    gutter.scrollTop = input.scrollTop;

    if (errors.length) {
      const first = errors[0];
      const more = errors.length > 1 ? ' (+' + (errors.length - 1) + ' more)' : '';
      ribbon.innerHTML = ICONS.warn + '<span></span>';
      ribbon.lastChild.textContent = 'Line ' + first.line + ': ' + first.message + more;
      ribbon.hidden = false;
      const layer = 'linear-gradient(var(--cm-err-bg),var(--cm-err-bg))';
      input.style.backgroundImage = errors.map(() => layer).join(',');
      input.style.backgroundSize = errors.map(() => '100% ' + LINE_HEIGHT + 'px').join(',');
      input.style.backgroundPosition = errors.map((e) => '0 ' + (PAD_TOP + (e.line - 1) * LINE_HEIGHT) + 'px').join(',');
      input.style.backgroundRepeat = 'no-repeat';
      input.style.backgroundAttachment = 'local';
    } else {
      ribbon.hidden = true;
      input.style.backgroundImage = '';
    }
  }

  function setMetrics(before, after) {
    if (before == null) {
      sizeText.textContent = 'Size: — → —';
      badge.hidden = true;
      return;
    }
    const pct = before ? Math.round((1 - after / before) * 100) : 0;
    sizeText.textContent = 'Size: ' + formatBytes(before) + ' → ' + formatBytes(after);
    badge.textContent = (pct >= 0 ? '-' : '+') + Math.abs(pct) + '%';
    badge.className = 'cssmin__badge' + (pct < 0 ? ' is-worse' : '');
    badge.hidden = false;
  }

  function minify() {
    const value = input.value;
    refreshEditor();
    if (!value.trim()) {
      output.value = '';
      setMetrics(null);
      btnCopy.disabled = true;
      btnDownload.disabled = true;
      return;
    }
    output.value = minifyCSS(value, opts);
    setMetrics(byteSize(value), byteSize(output.value));
    btnCopy.disabled = !output.value;
    btnDownload.disabled = !output.value;
  }

  function setInput(text, name) {
    input.value = text;
    if (name) fileName = name;
    minify();
  }

  /* ---- events ---- */
  on(input, 'input', () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(refreshEditor, 150);
  });
  on(input, 'scroll', () => {
    gutter.scrollTop = input.scrollTop;
  });
  on(input, 'keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') minify();
  });
  on(ribbon, 'click', () => {
    if (!errors.length) return;
    input.focus();
    input.scrollTop = Math.max(0, (errors[0].line - 1) * LINE_HEIGHT - 40);
  });

  on(btnMinify, 'click', minify);

  RULES.forEach(([key]) => {
    on(checkboxes[key], 'change', () => {
      opts[key] = checkboxes[key].checked;
      if (input.value.trim()) minify(); // live update, no re-submit needed
    });
  });

  on(btnPaste, 'click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (err) {
      input.focus();
      setButton(btnPaste, ICONS.paste, 'Press Ctrl+V');
      setTimeout(() => setButton(btnPaste, ICONS.paste, 'Paste'), 2000);
    }
  });

  on(btnUpload, 'click', () => fileInput.click());
  on(fileInput, 'change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setInput(String(reader.result || ''), file.name.replace(/\.[^.]+$/, ''));
    reader.readAsText(file);
    fileInput.value = '';
  });

  on(btnClear, 'click', () => {
    fileName = 'styles';
    setInput('');
    input.focus();
  });

  on(btnCopy, 'click', async () => {
    if (!output.value) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(output.value);
      ok = true;
    } catch (err) {
      output.select();
      try {
        ok = document.execCommand('copy');
      } catch (err2) {
        ok = false;
      }
    }
    if (!ok) return;
    clearTimeout(copyTimer);
    btnCopy.classList.add('is-success');
    setButton(btnCopy, ICONS.check, 'Copied!');
    copyTimer = setTimeout(() => {
      btnCopy.classList.remove('is-success');
      setButton(btnCopy, ICONS.copy, 'Copy to Clipboard');
    }, 1800);
  });

  on(btnDownload, 'click', () => {
    if (!output.value) return;
    const blob = new Blob([output.value], { type: 'text/css;charset=utf-8' });
    downloadBlob(blob, fileName + '.min.css');
  });

  refreshEditor();

  return {
    minify,
    setInput,
    getOutput: () => output.value,
    destroy() {
      ac.abort();
      clearTimeout(copyTimer);
      clearTimeout(inputTimer);
      container.innerHTML = '';
    },
  };
}

export default createCssMinifier;

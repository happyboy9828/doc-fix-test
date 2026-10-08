/**
 * HTML Minifier — plain JavaScript utility (no JSX, no dependencies).
 *
 * Exports:
 *   createHtmlMinifier(container, options)  -> mounts the full UI into a DOM element
 *   minifyHTML(html, options)               -> pure function, usable anywhere
 *
 * The UI is built with document.createElement only inside createHtmlMinifier(),
 * so importing this file is safe on the server (Next.js SSR).
 */

import { downloadBlob } from "../../shared/download";

/* ------------------------------------------------------------------ */
/* Minifier engine                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_OPTIONS = {
  removeComments: true,
  collapseWhitespace: true,
  minifyInline: true, // CSS in <style>, JS / JSON in <script>
  keepClosingTags: true, // false = drop optional closing tags like </li>
  quotes: 'remove', // 'remove' (when safe) | 'double' | 'single'
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Whitespace around these tags carries no meaning, so it can be removed.
const BLOCK_TAGS =
  'html|head|body|title|meta|link|base|script|style|noscript|template|header|footer|main|nav|section|article|aside|div|p|h[1-6]|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col|form|fieldset|legend|select|option|optgroup|figure|figcaption|blockquote|hr|br|pre|address|details|summary|menu|dialog';
const BLOCK_RE = new RegExp(' ?(</?(?:' + BLOCK_TAGS + ')(?:\\s[^>]*)?/?>) ?', 'gi');

const TAG_RE = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function isId(ch) {
  return ch > '\x7f' || /[\w$]/.test(ch);
}

function quoteValue(value, mode) {
  if (mode === 'remove' && value !== '' && /^[^\s"'`=<>]+$/.test(value) && value.slice(-1) !== '/') {
    return value;
  }
  if (mode !== 'single') {
    if (value.indexOf('"') > -1 && value.indexOf("'") < 0) return "'" + value + "'";
    return '"' + value.replace(/"/g, '&quot;') + '"';
  }
  if (value.indexOf("'") > -1 && value.indexOf('"') < 0) return '"' + value + '"';
  return "'" + value.replace(/'/g, '&#39;') + "'";
}

function rebuildAttrs(attrs, mode) {
  let out = '';
  attrs.replace(ATTR_RE, function (m, key, dq, sq, uq) {
    const raw = dq !== undefined ? dq : sq !== undefined ? sq : uq;
    if (raw === undefined) {
      out += ' ' + key;
      return m;
    }
    let value = raw;
    if (key.toLowerCase() === 'class') value = value.replace(/[ \t\r\n\f]+/g, ' ').trim();
    out += ' ' + key + '=' + quoteValue(value, mode);
    return m;
  });
  return out;
}

function minifyCSS(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return css
    .split(/("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')/)
    .map(function (part, idx) {
      if (idx % 2) return part; // string literal: leave untouched
      return part
        .replace(/[ \t\r\n\f]+/g, ' ')
        .replace(/ ?([{};,>~]) ?/g, '$1')
        .replace(/: /g, ':')
        .replace(/;}/g, '}');
    })
    .join('')
    .trim();
}

// Conservative JS minifier: removes comments and extra whitespace, keeps
// strings / template literals / regex literals intact and keeps line breaks
// where automatic semicolon insertion could depend on them.
function minifyJS(code) {
  const n = code.length;
  const REGEX_PREV = '(,=:[!&|?{};+-*%<>~^';
  const KEYWORD_RE = /(?:^|[^\w$.])(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/;
  let out = '';
  let pending = '';
  let last = '';
  let i = 0;

  function flush(next) {
    if (pending && out) {
      const prev = out[out.length - 1];
      if (pending === '\n') {
        if ('{([,;\n'.indexOf(prev) < 0 && '})],.;:?'.indexOf(next) < 0) out += '\n';
      } else if ((isId(prev) && isId(next)) || ((next === '+' || next === '-') && prev === next)) {
        out += ' ';
      }
    }
    pending = '';
  }

  while (i < n) {
    const c = code[i];
    const d = code[i + 1];

    if (/\s/.test(c)) {
      let newline = false;
      while (i < n && /\s/.test(code[i])) {
        if (code[i] === '\n' || code[i] === '\r') newline = true;
        i++;
      }
      if (newline) pending = '\n';
      else if (!pending) pending = ' ';
      continue;
    }

    if (c === '/' && d === '/') {
      while (i < n && code[i] !== '\n') i++;
      if (!pending) pending = ' ';
      continue;
    }

    if (c === '/' && d === '*') {
      const end = code.indexOf('*/', i + 2);
      const body = end < 0 ? code.slice(i) : code.slice(i, end + 2);
      i = end < 0 ? n : end + 2;
      if (body.indexOf('\n') > -1) pending = '\n';
      else if (!pending) pending = ' ';
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && code[j] !== c) {
        if (code[j] === '\\') j++;
        j++;
      }
      flush(c);
      out += code.slice(i, j + 1);
      i = j + 1;
      last = c;
      continue;
    }

    if (c === '/') {
      const maybeRegex = last === '' || REGEX_PREV.indexOf(last) > -1 || (/[\w$]/.test(last) && KEYWORD_RE.test(out));
      if (maybeRegex) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n && code[j] !== '\n') {
          const ch = code[j];
          if (ch === '\\') {
            j += 2;
            continue;
          }
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) {
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          j++;
          while (j < n && /[a-z]/i.test(code[j])) j++;
          flush('/');
          out += code.slice(i, j);
          i = j;
          last = 'a';
          continue;
        }
      }
    }

    flush(c);
    out += c;
    last = c;
    i++;
  }
  return out.trim();
}

function minifyScript(attrs, body) {
  const m = /(?:^|\s)type\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
  const type = m ? m[1].toLowerCase() : '';
  if (!type || /javascript|ecmascript|^module$/.test(type)) {
    try {
      return minifyJS(body);
    } catch (e) {
      return body;
    }
  }
  if (/json/.test(type)) {
    try {
      return JSON.stringify(JSON.parse(body));
    } catch (e) {
      return body.trim();
    }
  }
  return body;
}

export function minifyHTML(html, options) {
  const o = Object.assign({}, DEFAULT_OPTIONS, options);
  const store = [];
  const hold = function (text) {
    store.push(text);
    return '\u0000' + (store.length - 1) + '\u0000';
  };

  let s = String(html).replace(/\u0000/g, '');

  // 1. Protect content where whitespace matters or that needs its own rules.
  s = s.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, function (m, tag, attrs, body) {
    let inner = body;
    if (o.minifyInline) {
      inner = tag.toLowerCase() === 'style' ? minifyCSS(body) : minifyScript(attrs, body);
    }
    return '<' + tag + attrs + '>' + hold(inner) + '</' + tag + '>';
  });
  s = s.replace(/<(pre|textarea)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, function (m, tag, attrs, body) {
    return '<' + tag + attrs + '>' + hold(body) + '</' + tag + '>';
  });

  // 2. Comments (IE conditional comments are kept).
  if (o.removeComments) s = s.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

  // 3. Attributes and quotes.
  s = s.replace(TAG_RE, function (m, name, attrs, slash) {
    const isVoid = VOID.has(name.toLowerCase());
    const keepSlash = slash && !isVoid;
    const mode = keepSlash && o.quotes === 'remove' ? 'double' : o.quotes;
    return '<' + name + rebuildAttrs(attrs, mode) + (keepSlash ? '/' : '') + '>';
  });

  // 4. Whitespace (only plain whitespace, never &nbsp; characters).
  if (o.collapseWhitespace) {
    s = s.replace(/[ \t\r\n\f]+/g, ' ').replace(BLOCK_RE, '$1').trim();
  }

  // 5. Optional closing tags.
  if (!o.keepClosingTags) s = s.replace(/<\/(li|option|dt|dd|tr|td|th)>/gi, '');

  // 6. Restore protected content.
  return s.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
    return store[Number(idx)];
  });
}

/* ------------------------------------------------------------------ */
/* Diff (greedy: mostly deletions, with simple replacements)           */
/* ------------------------------------------------------------------ */

function buildDiff(a, b) {
  const frag = document.createDocumentFragment();
  let buf = '';
  let type = 'eq';
  const isWs = function (ch) {
    return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
  };
  const emit = function () {
    if (!buf) return;
    if (type === 'eq') frag.appendChild(document.createTextNode(buf));
    else {
      const span = document.createElement('span');
      span.className = type === 'del' ? 'hm-del' : 'hm-add';
      span.textContent = buf;
      frag.appendChild(span);
    }
    buf = '';
  };
  const push = function (t, text) {
    if (t !== type) {
      emit();
      type = t;
    }
    buf += text;
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j] || (isWs(a[i]) && isWs(b[j]))) {
      push('eq', b[j]);
      i++;
      j++;
      continue;
    }
    const k = a.indexOf(b.substr(j, 8), i);
    if (k > i) {
      push('del', a.slice(i, k));
      i = k;
    } else {
      push('del', a[i]);
      push('add', b[j]);
      i++;
      j++;
    }
  }
  if (i < a.length) push('del', a.slice(i));
  if (j < b.length) push('add', b.slice(j));
  emit();
  return frag;
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

const SAMPLE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="UTF-8">',
  '    <title> App </title>',
  '    <style>',
  '      /* page styles */',
  '      .main {',
  '        margin: 0 auto;',
  '        color: #333333;',
  '      }',
  '    </style>',
  '  </head>',
  '  <body>',
  '    <!-- Main Header -->',
  '    <div class="main"   id="app">',
  '      <h1>  Hello,   world  </h1>',
  '      <p>Compress <b>raw</b> <i>HTML</i> before shipping it.</p>',
  '      <a href="/about" title="About us">About</a>',
  '    </div>',
  '    <script>',
  '      // greet the user',
  '      function greet(name) {',
  '        console.log("Hello, " + name);',
  '      }',
  '      greet("web");',
  '    </script>',
  '  </body>',
  '</html>',
].join('\n');

function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (key) {
      const v = props[key];
      if (key === 'class') node.className = v;
      else if (key === 'text') node.textContent = v;
      else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), v);
      else node.setAttribute(key, v);
    });
  }
  (children || []).forEach(function (child) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

export function createHtmlMinifier(container, userOptions) {
  const config = Object.assign({ initialValue: '' }, DEFAULT_OPTIONS, userOptions);

  let result = '';
  let view = 'min';
  let fileName = '';
  let debounce = 0;
  let raf = 0;
  let toastTimer = 0;
  let shownPercent = 0;

  /* ---------- left column ---------- */
  const textarea = el('textarea', {
    class: 'hm-textarea',
    spellcheck: 'false',
    wrap: 'off',
    placeholder: 'Paste HTML here, or drop an .html file',
    'aria-label': 'Raw HTML input',
  });
  const gutter = el('pre', { class: 'hm-gutter', 'aria-hidden': 'true' });
  const dropHint = el('div', { class: 'hm-drop', text: 'Drop .html file to minify' });
  const editor = el('div', { class: 'hm-editor' }, [gutter, textarea, dropHint]);

  function checkbox(label, key) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!config[key];
    input.addEventListener('change', run);
    return { input: input, node: el('label', { class: 'hm-check' }, [input, el('span', { text: label })]) };
  }
  const cbComments = checkbox('Remove comments', 'removeComments');
  const cbSpace = checkbox('Collapse whitespace', 'collapseWhitespace');
  const cbInline = checkbox('Minify inline CSS / JS', 'minifyInline');
  const cbClosing = checkbox('Keep optional closing tags', 'keepClosingTags');

  const quoteSelect = el('select', { class: 'hm-select', 'aria-label': 'Attribute quotes' }, [
    el('option', { value: 'remove', text: 'Remove quotes when safe' }),
    el('option', { value: 'double', text: 'Use double quotes' }),
    el('option', { value: 'single', text: 'Use single quotes' }),
  ]);
  quoteSelect.value = config.quotes;
  quoteSelect.addEventListener('change', run);

  const clearBtn = el('button', { class: 'hm-btn', type: 'button', text: 'Clear' });
  const sampleBtn = el('button', { class: 'hm-btn', type: 'button', text: 'Load sample' });

  const left = el('section', { class: 'hm-panel' }, [
    el('div', { class: 'hm-panel-head' }, [el('h2', { text: 'Source input' }), el('div', { class: 'hm-row' }, [clearBtn, sampleBtn])]),
    editor,
    el('fieldset', { class: 'hm-options' }, [
      el('legend', { text: 'Options' }),
      cbComments.node,
      cbSpace.node,
      cbInline.node,
      cbClosing.node,
      el('label', { class: 'hm-check hm-check-select' }, [el('span', { text: 'Attribute quotes' }), quoteSelect]),
    ]),
  ]);

  /* ---------- right column ---------- */
  const statOrig = el('strong', { text: '0 B' });
  const statMin = el('strong', { text: '0 B' });
  const statSaved = el('strong', { text: '0 B' });
  const badge = el('span', { class: 'hm-badge', text: '0.0% Reduced' });

  const stats = el('dl', { class: 'hm-stats' }, [
    el('div', {}, [el('dt', { text: 'Original' }), el('dd', {}, [statOrig])]),
    el('div', {}, [el('dt', { text: 'Minified' }), el('dd', {}, [statMin])]),
    el('div', {}, [el('dt', { text: 'Saved' }), el('dd', {}, [statSaved, badge])]),
  ]);

  const minTab = el('button', { class: 'hm-tab', type: 'button', text: 'Minified', 'aria-pressed': 'true' });
  const diffTab = el('button', { class: 'hm-tab', type: 'button', text: 'Diff view', 'aria-pressed': 'false' });
  const legend = el('p', { class: 'hm-legend' }, [
    el('span', { class: 'hm-del', text: 'removed' }),
    ' ',
    el('span', { class: 'hm-add', text: 'added / changed' }),
  ]);
  legend.hidden = true;

  const output = el('pre', { class: 'hm-output', tabindex: '0', 'data-placeholder': 'Minified HTML appears here', 'aria-live': 'polite' });

  const copyBtn = el('button', { class: 'hm-btn', type: 'button', text: 'Copy minified HTML' });
  const downloadBtn = el('button', { class: 'hm-btn', type: 'button', text: 'Download .html file' });
  const runBtn = el('button', { class: 'hm-btn hm-btn-primary', type: 'button', text: 'Minify code now' });

  const right = el('section', { class: 'hm-panel' }, [
    el('div', { class: 'hm-panel-head' }, [el('h2', { text: 'Minified output' }), el('div', { class: 'hm-row' }, [minTab, diffTab])]),
    stats,
    legend,
    output,
    el('div', { class: 'hm-actions' }, [copyBtn, downloadBtn, runBtn]),
  ]);

  const toast = el('div', { class: 'hm-toast', role: 'status' });
  const root = el('div', { class: 'hm-root' }, [
    el('header', { class: 'hm-header' }, [
      el('h1', { text: 'HTML Minifier' }),
      el('p', { text: 'Compress raw HTML markup to improve page load speed and cut bandwidth.' }),
    ]),
    el('main', { class: 'hm-grid' }, [left, right]),
    toast,
  ]);

  container.appendChild(root);

  /* ---------- behaviour ---------- */
  function readOptions() {
    return {
      removeComments: cbComments.input.checked,
      collapseWhitespace: cbSpace.input.checked,
      minifyInline: cbInline.input.checked,
      keepClosingTags: cbClosing.input.checked,
      quotes: quoteSelect.value,
    };
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('hm-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('hm-toast-show');
    }, 1800);
  }

  function updateGutter() {
    const count = textarea.value.split('\n').length;
    let text = '';
    for (let n = 1; n <= count; n++) text += n + (n < count ? '\n' : '');
    gutter.textContent = text;
    gutter.scrollTop = textarea.scrollTop;
  }

  function animateBadge(target) {
    cancelAnimationFrame(raf);
    const from = shownPercent;
    const start = performance.now();
    const label = target >= 0 ? 'Reduced' : 'Larger';
    badge.classList.remove('hm-pop');
    void badge.offsetWidth; // restart the CSS animation
    badge.classList.add('hm-pop');
    function step(now) {
      const p = Math.min(1, (now - start) / 450);
      const value = from + (target - from) * (1 - Math.pow(1 - p, 3));
      shownPercent = value;
      badge.textContent = Math.abs(value).toFixed(1) + '% ' + label;
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  function updateStats(original, minified) {
    const saved = original - minified;
    statOrig.textContent = formatBytes(original);
    statMin.textContent = formatBytes(minified);
    statSaved.textContent = (saved < 0 ? '+' : '') + formatBytes(Math.abs(saved));
    badge.dataset.state = saved < 0 ? 'worse' : 'good';
    animateBadge(original ? (saved / original) * 100 : 0);
  }

  function render() {
    output.textContent = '';
    legend.hidden = view !== 'diff';
    if (!result) return;
    if (view === 'diff') {
      if (textarea.value.length + result.length > 300000) {
        output.textContent = 'Diff view is limited to about 300 KB. Showing minified output instead.\n\n' + result;
        return;
      }
      output.appendChild(buildDiff(textarea.value, result));
    } else {
      output.textContent = result;
    }
  }

  function run() {
    clearTimeout(debounce);
    const source = textarea.value;
    if (!source.trim()) {
      result = '';
      render();
      updateStats(0, 0);
      return;
    }
    try {
      result = minifyHTML(source, readOptions());
    } catch (err) {
      result = '';
      output.textContent = 'Could not minify this input: ' + err.message;
      return;
    }
    render();
    updateStats(byteLength(source), byteLength(result));
  }

  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(run, 150);
  }

  function setValue(text, name) {
    textarea.value = text;
    fileName = name || '';
    updateGutter();
    run();
  }

  function setView(next) {
    view = next;
    minTab.setAttribute('aria-pressed', String(next === 'min'));
    diffTab.setAttribute('aria-pressed', String(next === 'diff'));
    render();
  }

  function copy() {
    if (!result) return showToast('Nothing to copy yet');
    const done = function () {
      showToast('Copied to clipboard');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(result).then(done, function () {
        showToast('Copy failed. Select the output and copy manually');
      });
    } else {
      const tmp = el('textarea', { class: 'hm-offscreen' });
      tmp.value = result;
      document.body.appendChild(tmp);
      tmp.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        showToast('Copy failed. Select the output and copy manually');
      }
      document.body.removeChild(tmp);
    }
  }

  function download() {
    if (!result) return showToast('Nothing to download yet');
    const blob = new Blob([result], { type: 'text/html;charset=utf-8' });
    const name = fileName ? fileName.replace(/\.(x?html?)$/i, '') + '.min.html' : 'minified.html';
    const dl = downloadBlob(blob, name);
    if (!dl.ok) {
      showToast(dl.reason);
    }
  }

  function readFile(file) {
    if (!file || !/\.(x?html?)$/i.test(file.name)) {
      showToast('Drop an .html file');
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      setValue(String(reader.result), file.name);
      showToast('Loaded ' + file.name);
    };
    reader.onerror = function () {
      showToast('Could not read that file');
    };
    reader.readAsText(file);
  }

  textarea.addEventListener('input', function () {
    fileName = '';
    updateGutter();
    schedule();
  });
  textarea.addEventListener('scroll', function () {
    gutter.scrollTop = textarea.scrollTop;
  });
  editor.addEventListener('dragover', function (e) {
    e.preventDefault();
    editor.classList.add('hm-dragging');
  });
  editor.addEventListener('dragleave', function () {
    editor.classList.remove('hm-dragging');
  });
  editor.addEventListener('drop', function (e) {
    e.preventDefault();
    editor.classList.remove('hm-dragging');
    readFile(e.dataTransfer && e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener('click', function () {
    setValue('');
    textarea.focus();
  });
  sampleBtn.addEventListener('click', function () {
    setValue(SAMPLE);
  });
  minTab.addEventListener('click', function () {
    setView('min');
  });
  diffTab.addEventListener('click', function () {
    setView('diff');
  });
  copyBtn.addEventListener('click', copy);
  downloadBtn.addEventListener('click', download);
  runBtn.addEventListener('click', run);

  setValue(config.initialValue);

  return {
    minify: function (html, options) {
      return minifyHTML(html, Object.assign(readOptions(), options));
    },
    setValue: setValue,
    getOutput: function () {
      return result;
    },
    destroy: function () {
      clearTimeout(debounce);
      clearTimeout(toastTimer);
      cancelAnimationFrame(raf);
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

export default createHtmlMinifier;

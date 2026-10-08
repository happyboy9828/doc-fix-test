/* =============================================================================
   DocFix — QR Code Generator (plain JS, zero dependencies)
   Usage:  const tool = mountQrCodeGenerator(domElement);  ...  tool.destroy();
   Safe for CRA and Next.js: nothing touches `document` / `window` until mount.
   ============================================================================= */

import { downloadBlob } from "../../shared/download";

/* ─────────────────────────────  1. QR ENCODER  ─────────────────────────────
   Byte mode (UTF-8), versions 1–40, ECC L/M/Q/H, automatic mask selection.   */

const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const ECC_FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H
const ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };

function numRawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2;
    r -= (25 * a - 10) * a - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function numDataCodewords(ver, e) {
  return Math.floor(numRawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];
}

function rsMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = [];
  for (let i = 0; i < degree - 1; i++) result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  data.forEach((b) => {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= rsMultiply(coef, factor);
    });
  });
  return result;
}

function alignPositions(ver, size) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

function buildQr(bytes, ecl) {
  // 1. pick the smallest version that fits
  let ver = 1;
  let capBits = 0;
  for (; ; ver++) {
    if (ver > 40) throw new Error('TOO_LONG');
    const cap = numDataCodewords(ver, ecl) * 8;
    if (4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 <= cap) {
      capBits = cap;
      break;
    }
  }

  // 2. data bits
  const bits = [];
  const put = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0x4, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, capBits - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }

  // 3. error correction + interleave
  const numBlocks = NUM_BLOCKS[ecl][ver];
  const eccLen = ECC_PER_BLOCK[ecl][ver];
  const rawCw = Math.floor(numRawModules(ver) / 8);
  const numShort = numBlocks - (rawCw % numBlocks);
  const shortLen = Math.floor(rawCw / numBlocks);
  const blocks = [];
  const div = rsDivisor(eccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(block[i]);
    });
  }

  // 4. matrix
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => {
    modules[y][x] = dark;
    isFn[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const ap = alignPositions(ver, size);
  ap.forEach((ax, i) => {
    ap.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  const drawFormat = (mask) => {
    const d = (ECC_FORMAT_BITS[ecl] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412;
    const bit = (i) => ((fb >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6));
    setFn(8, 8, bit(7));
    setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);

  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((vb >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, dark);
      setFn(b, a, dark);
    }
  }

  // zig-zag data placement
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && bi < codewords.length * 8) {
          modules[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
          bi++;
        }
      }
    }
  }

  const applyMask = (m) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (!isFn[y][x] && inv) modules[y][x] = !modules[y][x];
      }
    }
  };

  const PATTERN = [true, false, true, true, true, false, true];
  const penalty = () => {
    let score = 0;
    for (let dir = 0; dir < 2; dir++) {
      const cell = (a, b) => (dir === 0 ? modules[a][b] : modules[b][a]);
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          if (cell(a, b) === cell(a, b - 1)) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
        for (let b = 0; b <= size - 7; b++) {
          let match = true;
          for (let k = 0; k < 7; k++) {
            if (cell(a, b + k) !== PATTERN[k]) { match = false; break; }
          }
          if (!match) continue;
          let after = true;
          let before = true;
          for (let k = 1; k <= 4; k++) {
            if (b + 6 + k < size && cell(a, b + 6 + k)) after = false;
            if (b - k >= 0 && cell(a, b - k)) before = false;
          }
          if (after) score += 40;
          if (before) score += 40;
        }
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
        }
      }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty();
    if (p < bestScore) { bestScore = p; bestMask = m; }
    applyMask(m);
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return { size, version: ver, modules };
}

/** Encode text → { size, version, modules[y][x] }. Throws Error('TOO_LONG') if it can't fit. */
export function generateQr(text, eccKey) {
  const ecl = ECC_INDEX[eccKey] === undefined ? 1 : ECC_INDEX[eccKey];
  return buildQr(Array.from(new TextEncoder().encode(text)), ecl);
}

/* ─────────────────────────────  2. PAYLOADS  ───────────────────────────── */

const escWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');
const escVcard = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function buildPayload(state) {
  const f = state.fields;
  switch (state.type) {
    case 'url': {
      const v = f.url.trim();
      if (!v) return '';
      return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^(mailto|tel|sms|smsto|geo|wifi):/i.test(v) ? v : `https://${v}`;
    }
    case 'text':
      return f.text.trim() ? f.text : '';
    case 'wifi': {
      if (!f.wifiSsid.trim()) return '';
      const parts = [`T:${f.wifiEnc}`, `S:${escWifi(f.wifiSsid)}`];
      if (f.wifiEnc !== 'nopass' && f.wifiPass) parts.push(`P:${escWifi(f.wifiPass)}`);
      if (f.wifiHidden) parts.push('H:true');
      return `WIFI:${parts.join(';')};;`;
    }
    case 'vcard': {
      const { vcFirst, vcLast, vcOrg, vcTitle, vcPhone, vcEmail, vcWeb, vcAddress } = f;
      if (![vcFirst, vcLast, vcPhone, vcEmail].some((v) => v.trim())) return '';
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escVcard(vcLast)};${escVcard(vcFirst)};;;`, `FN:${escVcard(`${vcFirst} ${vcLast}`.trim())}`];
      if (vcOrg.trim()) lines.push(`ORG:${escVcard(vcOrg)}`);
      if (vcTitle.trim()) lines.push(`TITLE:${escVcard(vcTitle)}`);
      if (vcPhone.trim()) lines.push(`TEL;TYPE=CELL:${vcPhone.trim()}`);
      if (vcEmail.trim()) lines.push(`EMAIL:${vcEmail.trim()}`);
      if (vcWeb.trim()) lines.push(`URL:${vcWeb.trim()}`);
      if (vcAddress.trim()) lines.push(`ADR;TYPE=WORK:;;${escVcard(vcAddress)};;;;`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    case 'email': {
      if (!f.mailTo.trim()) return '';
      const q = [];
      if (f.mailSubject) q.push(`subject=${encodeURIComponent(f.mailSubject)}`);
      if (f.mailBody) q.push(`body=${encodeURIComponent(f.mailBody)}`);
      return `mailto:${f.mailTo.trim()}${q.length ? `?${q.join('&')}` : ''}`;
    }
    case 'sms':
      return f.smsNumber.trim() ? `SMSTO:${f.smsNumber.trim()}:${f.smsMessage}` : '';
    default:
      return '';
  }
}

/* ─────────────────────────────  3. COLOUR + SCAN CHECK  ────────────────── */

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const mixHex = (a, b) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => (v + y[i]) / 2));
};
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

function scanCheck(s, qr) {
  const items = [];
  const push = (level, text) => items.push({ level, text });
  const fg = s.mode === 'gradient' ? [s.fg1, s.fg2] : [s.fg1];
  const bg = s.mode === 'gradient' ? [s.bg1, s.bg2] : [s.bg1];

  if (s.transparent) {
    push('warn', 'Transparent background: scanning depends on what the code is placed on. Keep it light and plain.');
  } else {
    let min = Infinity;
    fg.forEach((a) => bg.forEach((b) => { min = Math.min(min, contrast(a, b)); }));
    const r = min.toFixed(1);
    if (min >= 7) push('good', `Excellent contrast (${r}:1). Scans reliably.`);
    else if (min >= 4.5) push('good', `Good contrast (${r}:1).`);
    else if (min >= 3) push('warn', `Low contrast (${r}:1). May fail on some cameras or in dim light. Darken the foreground or lighten the background.`);
    else push('bad', `Very low contrast (${r}:1). This will likely fail to scan. Darken the foreground or lighten the background.`);

    const avg = (list) => list.reduce((t, c) => t + luminance(c), 0) / list.length;
    if (avg(fg) > avg(bg)) push('warn', 'Inverted colors (light on dark). Most phone cameras read it, but older scanners may not.');
  }
  if (s.quiet < 4) push('warn', 'Quiet zone is under 4 modules. Some scanners need that blank border to find the code.');
  if (s.logo) push('good', 'Logo added: error correction is locked to level H and the center area is cleared.');
  if (qr && qr.version >= 15) push('warn', `Dense code (version ${qr.version}). Export large and print it at least 4 cm wide.`);

  const order = { good: 0, warn: 1, bad: 2 };
  const level = items.reduce((w, i) => (order[i.level] > order[w] ? i.level : w), 'good');
  return { level, items };
}

/* ─────────────────────────────  4. RENDERING (SVG / EPS / PNG)  ────────── */

const fnum = (n) => +n.toFixed(3);

function rrPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${fnum(x)} ${fnum(y)}h${fnum(w)}v${fnum(h)}h${fnum(-w)}z`;
  const iw = fnum(w - 2 * r);
  const ih = fnum(h - 2 * r);
  const arc = (dx, dy) => `a${fnum(r)} ${fnum(r)} 0 0 1 ${fnum(dx)} ${fnum(dy)}`;
  return `M${fnum(x + r)} ${fnum(y)}h${iw}${arc(r, r)}v${ih}${arc(-r, r)}h${fnum(-(w - 2 * r))}${arc(-r, -r)}v${fnum(-(h - 2 * r))}${arc(r, -r)}z`;
}

function dotPath(shape, x, y) {
  switch (shape) {
    case 'rounded':
      return rrPath(x, y, 1, 1, 0.32);
    case 'dots': {
      const r = 0.46;
      return `M${fnum(x + 0.5 - r)} ${fnum(y + 0.5)}a${r} ${r} 0 1 0 ${fnum(2 * r)} 0a${r} ${r} 0 1 0 ${fnum(-2 * r)} 0z`;
    }
    case 'diamond':
      return `M${fnum(x + 0.5)} ${fnum(y)}L${fnum(x + 1)} ${fnum(y + 0.5)}L${fnum(x + 0.5)} ${fnum(y + 1)}L${fnum(x)} ${fnum(y + 0.5)}z`;
    default:
      return `M${fnum(x)} ${fnum(y)}h1v1h-1z`;
  }
}

// [outer ring radius, inner hole radius, eye radius] for the 7×7 / 5×5 / 3×3 squares
const EYE_RADII = { square: [0, 0, 0], rounded: [2, 1, 0.8], circle: [3.5, 2.5, 1.5] };

function layout(qr, s) {
  const n = qr.size;
  const q = s.quiet;
  let box = null;
  if (s.logo) {
    let L = Math.round((n * s.logoSize) / 100);
    if (L % 2 !== n % 2) L++;
    L = Math.max(L, 3);
    box = { x: (n - L) / 2, y: (n - L) / 2, L };
  }
  const inEye = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const inBox = (x, y) => box && x >= box.x && x < box.x + box.L && y >= box.y && y < box.y + box.L;
  const dots = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules[y][x] && !inEye(x, y) && !inBox(x, y)) dots.push([x + q, y + q]);
    }
  }
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]].map(([x, y]) => [x + q, y + q]);
  return { n, q, total: n + q * 2, box, dots, eyes };
}

function buildSvg(qr, s, px) {
  const { q, total, box, dots, eyes } = layout(qr, s);
  const grad = s.mode === 'gradient';
  const c = total / 2;

  const gradient = (id, c1, c2) => {
    const stops = `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>`;
    if (s.gradType === 'radial') {
      return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${c}" cy="${c}" r="${fnum(c * 1.42)}">${stops}</radialGradient>`;
    }
    const a = (s.angle * Math.PI) / 180;
    const half = c * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
    const dx = Math.cos(a) * half;
    const dy = Math.sin(a) * half;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fnum(c - dx)}" y1="${fnum(c - dy)}" x2="${fnum(c + dx)}" y2="${fnum(c + dy)}">${stops}</linearGradient>`;
  };

  let defs = '';
  if (grad) {
    defs += gradient('qrtfg', s.fg1, s.fg2);
    if (!s.transparent) defs += gradient('qrtbg', s.bg1, s.bg2);
  }
  const fg = grad ? 'url(#qrtfg)' : s.fg1;
  const bg = grad ? 'url(#qrtbg)' : s.bg1;

  const dotD = dots.map(([x, y]) => dotPath(s.dot, x, y)).join('');
  const [ro, ri, re] = EYE_RADII[s.eye] || EYE_RADII.square;
  const eyeD = eyes
    .map(([x, y]) => rrPath(x, y, 7, 7, ro) + rrPath(x + 1, y + 1, 5, 5, ri) + rrPath(x + 2, y + 2, 3, 3, re))
    .join('');

  let logo = '';
  if (box && s.logo) {
    const pad = box.L * 0.1;
    const x = box.x + q + pad;
    const y = box.y + q + pad;
    const w = box.L - pad * 2;
    logo = `<image x="${fnum(x)}" y="${fnum(y)}" width="${fnum(w)}" height="${fnum(w)}" preserveAspectRatio="xMidYMid meet" href="${s.logo.src}" xlink:href="${s.logo.src}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${total} ${total}"${px ? ` width="${px}" height="${px}"` : ''} role="img" aria-label="QR code preview">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    (s.transparent ? '' : `<rect width="${total}" height="${total}" fill="${bg}"/>`) +
    `<path fill="${fg}" d="${dotD}"/>` +
    `<path fill="${fg}" fill-rule="evenodd" d="${eyeD}"/>` +
    logo +
    '</svg>'
  );
}

function logoPixels(img, bgHex) {
  try {
    if (!img || !img.naturalWidth) return null;
    const r = Math.min(1, 192 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * r));
    const h = Math.max(1, Math.round(img.naturalHeight * r));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let hex = '';
    for (let i = 0; i < d.length; i += 4) {
      hex += ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0');
    }
    return { w, h, hex };
  } catch (e) {
    return null;
  }
}

function buildEps(qr, s, px) {
  const { q, total, box, dots, eyes } = layout(qr, s);
  const grad = s.mode === 'gradient';
  const fg = grad ? mixHex(s.fg1, s.fg2) : s.fg1;
  const bg = grad ? mixHex(s.bg1, s.bg2) : s.bg1;
  const rgb = (hex) => hexToRgb(hex).map((v) => (v / 255).toFixed(4)).join(' ');
  const out = [];

  out.push('%!PS-Adobe-3.0 EPSF-3.0', `%%BoundingBox: 0 0 ${px} ${px}`, '%%Title: QR Code', '%%Creator: DocFix QR Code Generator', '%%EndComments');
  out.push('gsave', `0 ${px} translate`, `${(px / total).toFixed(6)} ${(-px / total).toFixed(6)} scale`);
  if (!s.transparent) out.push(`${rgb(bg)} setrgbcolor`, `0 0 ${total} ${total} rectfill`);
  out.push(`${rgb(fg)} setrgbcolor`);

  const rr = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0) return `${x} ${y} moveto ${w} 0 rlineto 0 ${h} rlineto ${-w} 0 rlineto closepath`;
    const arc = (a, b, c, d) => `${fnum(a)} ${fnum(b)} ${fnum(c)} ${fnum(d)} ${fnum(r)} arcto 4 {pop} repeat`;
    return [
      `${fnum(x + r)} ${y} moveto`,
      arc(x + w, y, x + w, y + h),
      arc(x + w, y + h, x, y + h),
      arc(x, y + h, x, y),
      arc(x, y, x + w, y),
      'closepath',
    ].join(' ');
  };
  const dotPs = (x, y) => {
    if (s.dot === 'rounded') return rr(x, y, 1, 1, 0.32);
    if (s.dot === 'dots') return `${fnum(x + 0.96)} ${fnum(y + 0.5)} moveto ${fnum(x + 0.5)} ${fnum(y + 0.5)} 0.46 0 360 arc closepath`;
    if (s.dot === 'diamond') return `${fnum(x + 0.5)} ${y} moveto 0.5 0.5 rlineto -0.5 0.5 rlineto -0.5 -0.5 rlineto closepath`;
    return `${x} ${y} moveto 1 0 rlineto 0 1 rlineto -1 0 rlineto closepath`;
  };

  for (let i = 0; i < dots.length; i += 400) {
    out.push('newpath');
    dots.slice(i, i + 400).forEach(([x, y]) => out.push(dotPs(x, y)));
    out.push('fill');
  }
  const [ro, ri, re] = EYE_RADII[s.eye] || EYE_RADII.square;
  eyes.forEach(([x, y]) => {
    out.push('newpath', rr(x, y, 7, 7, ro), rr(x + 1, y + 1, 5, 5, ri), rr(x + 2, y + 2, 3, 3, re), 'eofill');
  });

  if (box && s.logo) {
    const px2 = logoPixels(s.logo.img, s.transparent ? '#FFFFFF' : bg);
    if (px2) {
      const side = box.L * 0.8;
      const dw = px2.w >= px2.h ? side : (side * px2.w) / px2.h;
      const dh = px2.h >= px2.w ? side : (side * px2.h) / px2.w;
      const x = box.x + q + (box.L - dw) / 2;
      const y = box.y + q + (box.L - dh) / 2;
      out.push('gsave', `${fnum(x)} ${fnum(y)} translate`, `${fnum(dw)} ${fnum(dh)} scale`);
      out.push(`${px2.w} ${px2.h} 8 [${px2.w} 0 0 ${px2.h} 0 0] currentfile /ASCIIHexDecode filter false 3 colorimage`);
      for (let i = 0; i < px2.hex.length; i += 78) out.push(px2.hex.slice(i, i + 78));
      out.push('>', 'grestore');
    }
  }
  out.push('grestore', '%%EOF');
  return out.join('\n');
}

function svgToPng(svg, px) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = px;
      cv.height = px;
      cv.getContext('2d').drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG_FAILED'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG_FAILED'));
    };
    img.src = url;
  });
}

/* ─────────────────────────────  5. UI HELPERS  ─────────────────────────── */

let ID_COUNTER = 0;
const nextId = () => `qrt-${++ID_COUNTER}`;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  const add = (kid) => {
    if (Array.isArray(kid)) kid.forEach(add);
    else if (kid === null || kid === undefined || kid === false) return;
    else el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  };
  kids.forEach(add);
  return el;
}

function field(label, control, hint) {
  const isGroup = control.tagName === 'DIV';
  if (!isGroup && !control.id) control.id = nextId();
  return h(
    'div',
    { class: 'qrt-field' },
    isGroup ? h('span', { class: 'qrt-label' }, label) : h('label', { class: 'qrt-label', for: control.id }, label),
    control,
    hint ? h('p', { class: 'qrt-hint' }, hint) : null
  );
}

function seg(label, items, value, onChange, extraClass) {
  const el = h('div', { class: `qrt-seg ${extraClass || ''}`, role: 'group', 'aria-label': label });
  const buttons = {};
  const api = {
    el,
    set(v) {
      Object.keys(buttons).forEach((k) => {
        buttons[k].classList.toggle('is-active', k === v);
        buttons[k].setAttribute('aria-pressed', String(k === v));
      });
    },
    disable(list) {
      Object.keys(buttons).forEach((k) => { buttons[k].disabled = list.includes(k); });
    },
  };
  items.forEach(([val, text]) => {
    const b = h('button', { type: 'button', class: 'qrt-seg-btn', 'aria-pressed': 'false' }, text);
    b.addEventListener('click', () => {
      api.set(val);
      onChange(val);
    });
    buttons[val] = b;
    el.appendChild(b);
  });
  api.set(value);
  return api;
}

function colorField(label, value, onInput) {
  const picker = h('input', { type: 'color', class: 'qrt-picker', value: value.toLowerCase(), 'aria-label': `${label} picker` });
  const hex = h('input', { type: 'text', class: 'qrt-input qrt-mono', value, maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': `${label} hex value` });
  picker.addEventListener('input', () => {
    hex.value = picker.value.toUpperCase();
    hex.classList.remove('is-invalid');
    onInput(picker.value.toUpperCase());
  });
  hex.addEventListener('input', () => {
    const v = hex.value.trim().startsWith('#') ? hex.value.trim() : `#${hex.value.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      picker.value = v.toLowerCase();
      hex.classList.remove('is-invalid');
      onInput(v.toUpperCase());
    } else hex.classList.add('is-invalid');
  });
  hex.addEventListener('blur', () => {
    hex.value = picker.value.toUpperCase();
    hex.classList.remove('is-invalid');
  });
  const el = h('div', { class: 'qrt-color' }, picker, hex);
  return {
    el,
    set(v) {
      picker.value = v.toLowerCase();
      hex.value = v.toUpperCase();
      hex.classList.remove('is-invalid');
    },
  };
}

function slider(min, max, value, format, onInput) {
  const input = h('input', { type: 'range', class: 'qrt-range', min, max, step: '1', value });
  const out = h('output', { class: 'qrt-mono qrt-range-out' }, format(value));
  input.addEventListener('input', () => {
    out.textContent = format(+input.value);
    onInput(+input.value);
  });
  return {
    el: h('div', { class: 'qrt-range-wrap' }, input, out),
    input,
    set(v) {
      input.value = v;
      out.textContent = format(v);
    },
  };
}

function checkbox(label, checked, onChange) {
  const input = h('input', { type: 'checkbox', class: 'qrt-check-input' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return { el: h('label', { class: 'qrt-checkbox' }, input, h('span', {}, label)), input };
}

/* ─────────────────────────────  6. DEFAULT STATE + PRESETS  ────────────── */

const PRESETS = {
  minimal: { label: 'Minimal', mode: 'solid', fg1: '#0F172A', bg1: '#FFFFFF', dot: 'square', eye: 'square', swatch: 'linear-gradient(#fff,#fff)', ink: '#0F172A' },
  brand: { label: 'Brand', mode: 'gradient', gradType: 'linear', angle: 45, fg1: '#0E7490', fg2: '#1E3A8A', bg1: '#FFFFFF', bg2: '#ECFEFF', dot: 'rounded', eye: 'rounded', swatch: 'linear-gradient(135deg,#0E7490,#1E3A8A)', ink: '#fff' },
  dark: { label: 'Dark', mode: 'solid', fg1: '#22D3EE', bg1: '#0F172A', dot: 'dots', eye: 'rounded', swatch: 'linear-gradient(#0F172A,#0F172A)', ink: '#22D3EE' },
};

function defaultState() {
  return {
    type: 'url',
    fields: {
      url: 'https://example.com', text: '',
      wifiSsid: '', wifiPass: '', wifiEnc: 'WPA', wifiHidden: false,
      vcFirst: '', vcLast: '', vcOrg: '', vcTitle: '', vcPhone: '', vcEmail: '', vcWeb: '', vcAddress: '',
      mailTo: '', mailSubject: '', mailBody: '',
      smsNumber: '', smsMessage: '',
    },
    style: {
      mode: 'solid', gradType: 'linear', angle: 45,
      fg1: '#0F172A', fg2: '#0E7490', bg1: '#FFFFFF', bg2: '#E0F2FE',
      transparent: false, dot: 'square', eye: 'square', quiet: 4,
      logo: null, logoSize: 20,
    },
    ecc: 'M',
    size: 1024,
    format: 'png',
  };
}

/* ─────────────────────────────  7. MOUNT  ──────────────────────────────── */

export function mountQrCodeGenerator(container) {
  if (!container) throw new Error('mountQrCodeGenerator: a container element is required.');
  container.textContent = '';

  const state = defaultState();
  const s = state.style;
  let raf = 0;
  let destroyed = false;
  let toastTimer = 0;
  let savedEcc = state.ecc;
  let current = { qr: null };

  /* ---- content type + payload panels ---- */
  const bindText = (key, el) => {
    el.value = state.fields[key];
    el.addEventListener('input', () => {
      state.fields[key] = el.value;
      schedule();
    });
    return el;
  };
  const text = (key, ph, extra) => bindText(key, h('input', Object.assign({ class: 'qrt-input', type: 'text', placeholder: ph, autocomplete: 'off' }, extra || {})));
  const area = (key, ph, rows) => bindText(key, h('textarea', { class: 'qrt-input qrt-textarea', rows: rows || 3, placeholder: ph }));

  const wifiEnc = h('select', { class: 'qrt-input' },
    h('option', { value: 'WPA' }, 'WPA / WPA2 / WPA3'),
    h('option', { value: 'WEP' }, 'WEP'),
    h('option', { value: 'nopass' }, 'No password'));
  wifiEnc.addEventListener('change', () => { state.fields.wifiEnc = wifiEnc.value; schedule(); });
  const wifiPass = text('wifiPass', 'Network password', { type: 'password' });
  const wifiShow = checkbox('Show password', false, (on) => { wifiPass.type = on ? 'text' : 'password'; });
  const wifiHidden = checkbox('Hidden network', false, (on) => { state.fields.wifiHidden = on; schedule(); });

  const panels = {
    url: [field('Website URL', text('url', 'https://example.com', { inputmode: 'url' }), 'Links without http:// or https:// get https:// added.')],
    text: [field('Text', area('text', 'Type or paste any text', 5))],
    wifi: [
      field('Network name (SSID)', text('wifiSsid', 'MyHomeWiFi')),
      field('Password', wifiPass),
      h('div', { class: 'qrt-row' }, field('Security', wifiEnc)),
      h('div', { class: 'qrt-inline' }, wifiShow.el, wifiHidden.el),
    ],
    vcard: [
      h('div', { class: 'qrt-grid2' },
        field('First name', text('vcFirst', 'Ada')),
        field('Last name', text('vcLast', 'Lovelace')),
        field('Organization', text('vcOrg', 'Analytical Engines Ltd')),
        field('Job title', text('vcTitle', 'Engineer')),
        field('Phone', text('vcPhone', '+92 300 0000000', { inputmode: 'tel' })),
        field('Email', text('vcEmail', 'ada@example.com', { inputmode: 'email' }))),
      field('Website', text('vcWeb', 'https://example.com', { inputmode: 'url' })),
      field('Address', text('vcAddress', 'Street, city, country')),
    ],
    email: [
      field('Send to', text('mailTo', 'hello@example.com', { inputmode: 'email' })),
      field('Subject', text('mailSubject', 'Subject line')),
      field('Message', area('mailBody', 'Pre-filled message', 4)),
    ],
    sms: [
      field('Phone number', text('smsNumber', '+92 300 0000000', { inputmode: 'tel' })),
      field('Message', area('smsMessage', 'Pre-filled message', 4)),
    ],
  };
  const panelEls = {};
  Object.keys(panels).forEach((k) => { panelEls[k] = h('div', { class: 'qrt-panel' }, panels[k]); });

  const typeSeg = seg('Content type',
    [['url', 'URL'], ['text', 'Text'], ['wifi', 'Wi-Fi'], ['vcard', 'vCard'], ['email', 'Email'], ['sms', 'SMS']],
    state.type,
    (v) => { state.type = v; showPanel(); schedule(); },
    'qrt-seg--wrap');
  function showPanel() {
    Object.keys(panelEls).forEach((k) => { panelEls[k].hidden = k !== state.type; });
  }

  /* ---- appearance ---- */
  const fg1 = colorField('Foreground', s.fg1, (v) => { s.fg1 = v; schedule(); });
  const fg2 = colorField('Foreground end', s.fg2, (v) => { s.fg2 = v; schedule(); });
  const bg1 = colorField('Background', s.bg1, (v) => { s.bg1 = v; schedule(); });
  const bg2 = colorField('Background end', s.bg2, (v) => { s.bg2 = v; schedule(); });
  const fgRow = h('div', { class: 'qrt-pair' }, fg1.el, h('span', { class: 'qrt-pair-arrow', 'aria-hidden': 'true' }, 'to'), fg2.el);
  const bgRow = h('div', { class: 'qrt-pair' }, bg1.el, h('span', { class: 'qrt-pair-arrow', 'aria-hidden': 'true' }, 'to'), bg2.el);
  const fgField = field('Foreground', fgRow);
  const bgField = field('Background', bgRow);
  const transparent = checkbox('Transparent background (PNG and SVG)', false, (on) => { s.transparent = on; syncVisibility(); schedule(); });

  const modeSeg = seg('Color mode', [['solid', 'Solid'], ['gradient', 'Gradient']], s.mode, (v) => { s.mode = v; syncVisibility(); schedule(); });
  const gradTypeSeg = seg('Gradient type', [['linear', 'Linear'], ['radial', 'Radial']], s.gradType, (v) => { s.gradType = v; syncVisibility(); schedule(); });
  const angle = slider(0, 360, s.angle, (v) => `${v}°`, (v) => { s.angle = v; schedule(); });
  const gradTypeField = field('Gradient type', gradTypeSeg.el);
  const angleField = field('Gradient angle', angle.el);

  const dotSeg = seg('Dot shape', [['square', 'Square'], ['rounded', 'Rounded'], ['dots', 'Dots'], ['diamond', 'Diamond']], s.dot, (v) => { s.dot = v; schedule(); });
  const eyeSeg = seg('Corner shape', [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']], s.eye, (v) => { s.eye = v; schedule(); });
  const quiet = slider(0, 8, s.quiet, (v) => `${v} modules`, (v) => { s.quiet = v; schedule(); });

  /* ---- logo ---- */
  const logoInput = h('input', { type: 'file', accept: 'image/*', class: 'qrt-file', 'aria-label': 'Choose a logo image' });
  const dropIdle = h('div', { class: 'qrt-drop-idle' },
    h('span', { class: 'qrt-drop-plus', 'aria-hidden': 'true' }, '+'),
    h('span', { class: 'qrt-drop-title' }, 'Drop a logo here or browse'),
    h('span', { class: 'qrt-hint' }, 'PNG, JPG, SVG or WEBP. Scaled to a safe size automatically.'));
  const logoThumb = h('img', { class: 'qrt-logo-thumb', alt: '' });
  const logoName = h('span', { class: 'qrt-logo-name' });
  const logoRemove = h('button', { type: 'button', class: 'qrt-btn qrt-btn--ghost' }, 'Remove logo');
  const dropSet = h('div', { class: 'qrt-drop-set' }, logoThumb, logoName, logoRemove);
  dropSet.hidden = true;
  const dropMsg = h('p', { class: 'qrt-hint qrt-hint--error', role: 'alert' });
  dropMsg.hidden = true;
  const drop = h('div', { class: 'qrt-drop', tabindex: '0', role: 'button', 'aria-label': 'Add a center logo' }, dropIdle, dropSet, logoInput);
  const logoSize = slider(10, 28, s.logoSize, (v) => `${v}%`, (v) => { s.logoSize = v; schedule(); });
  const logoSizeField = field('Logo size', logoSize.el, 'Kept under 28% so the code stays readable.');
  logoSizeField.hidden = true;

  const setDropError = (msg) => { dropMsg.textContent = msg || ''; dropMsg.hidden = !msg; };

  function setLogo(logo) {
    s.logo = logo;
    dropIdle.hidden = !!logo;
    dropSet.hidden = !logo;
    logoSizeField.hidden = !logo;
    if (logo) {
      logoThumb.src = logo.src;
      logoName.textContent = logo.name;
      if (state.ecc !== 'H') savedEcc = state.ecc;
      eccSeg.set('H');
      eccSeg.disable(['L', 'M', 'Q']);
    } else {
      state.ecc = savedEcc;
      eccSeg.set(savedEcc);
      eccSeg.disable([]);
    }
    eccHint.textContent = logo ? 'Locked to H while a logo is in the center so the code still scans.' : 'Higher levels survive more damage but make the code denser.';
    schedule();
  }

  function loadLogo(file) {
    setDropError('');
    if (!file) return;
    if (!/^image\//.test(file.type)) { setDropError('That file is not an image. Choose a PNG, JPG, SVG or WEBP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setDropError('That image is over 5 MB. Choose a smaller file.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setDropError('Could not read that file. Try another image.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setDropError('Could not open that image. Try another file.');
      img.onload = () => {
        let src = reader.result;
        const big = Math.max(img.naturalWidth, img.naturalHeight);
        if (file.type !== 'image/svg+xml' && big > 256) {
          const r = 256 / big;
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * r);
          cv.height = Math.round(img.naturalHeight * r);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          src = cv.toDataURL('image/png');
        }
        setLogo({ src, img, name: file.name });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  logoInput.addEventListener('change', () => { loadLogo(logoInput.files[0]); logoInput.value = ''; });
  drop.addEventListener('click', (e) => { if (e.target !== logoRemove && e.target !== logoInput) logoInput.click(); });
  drop.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); logoInput.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => loadLogo(e.dataTransfer && e.dataTransfer.files[0]));
  logoRemove.addEventListener('click', (e) => { e.stopPropagation(); setLogo(null); });

  /* ---- advanced + export ---- */
  const eccSeg = seg('Error correction level', [['L', 'L 7%'], ['M', 'M 15%'], ['Q', 'Q 25%'], ['H', 'H 30%']], state.ecc, (v) => { state.ecc = v; savedEcc = v; schedule(); });
  const eccHint = h('p', { class: 'qrt-hint' }, 'Higher levels survive more damage but make the code denser.');
  const eccField = h('div', { class: 'qrt-field' }, h('span', { class: 'qrt-label' }, 'Error correction'), eccSeg.el, eccHint);

  const sizeSel = h('select', { class: 'qrt-input qrt-mono' },
    [512, 1024, 2048, 4096].map((v) => h('option', { value: v }, `${v} × ${v} px`)));
  sizeSel.value = String(state.size);
  sizeSel.addEventListener('change', () => { state.size = +sizeSel.value; schedule(); });

  const formatHints = {
    png: 'Raster image. Best for web, social posts and documents.',
    svg: 'Vector. Stays sharp at any size. Best for print and design tools.',
    eps: 'Vector for print workflows. Gradients are flattened to one mid-tone color.',
  };
  const formatHint = h('p', { class: 'qrt-hint' }, formatHints.png);
  const formatSeg = seg('Export format', [['png', 'PNG'], ['svg', 'SVG'], ['eps', 'EPS']], state.format, (v) => { state.format = v; formatHint.textContent = formatHints[v]; });
  const downloadBtn = h('button', { type: 'button', class: 'qrt-btn qrt-btn--primary qrt-btn--block' }, 'Download High-Res QR Code');
  const toast = h('p', { class: 'qrt-toast', role: 'status', 'aria-live': 'polite' });

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  downloadBtn.addEventListener('click', async () => {
    const qr = current.qr;
    if (!qr) return;
    const px = state.size;
    const name = `qr-code-${state.type}`;
    try {
      let result;
      if (state.format === 'svg') {
        result = downloadBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${buildSvg(qr, s, px)}`], { type: 'image/svg+xml' }), `${name}.svg`);
      } else if (state.format === 'eps') {
        result = downloadBlob(new Blob([buildEps(qr, s, px)], { type: 'application/postscript' }), `${name}.eps`);
      } else {
        result = downloadBlob(await svgToPng(buildSvg(qr, s, px), px), `${name}.png`);
      }
      if (!result.ok) {
        showToast(result.reason, true);
        return;
      }
      showToast(`Downloaded ${name}.${state.format}`);
    } catch (e) {
      showToast('Export failed. Try a smaller size.', true);
    }
  });

  /* ---- preview column ---- */
  const stage = h('div', { class: 'qrt-stage' });
  const meta = h('p', { class: 'qrt-meta qrt-mono' });
  const checkTitle = h('p', { class: 'qrt-check-title' });
  const checkList = h('ul', { class: 'qrt-check-list' });
  const checkBox = h('div', { class: 'qrt-check', role: 'status' }, h('span', { class: 'qrt-check-dot', 'aria-hidden': 'true' }), h('div', {}, checkTitle, checkList));

  const presetBtns = Object.keys(PRESETS).map((key) => {
    const p = PRESETS[key];
    const b = h('button', { type: 'button', class: 'qrt-preset' },
      h('span', { class: 'qrt-preset-swatch', style: `background:${p.swatch};color:${p.ink}`, 'aria-hidden': 'true' }, 'QR'),
      h('span', {}, p.label));
    b.addEventListener('click', () => {
      Object.assign(s, { mode: 'solid', gradType: 'linear', angle: 45, transparent: false }, p);
      delete s.label; delete s.swatch; delete s.ink;
      syncControls();
      schedule();
    });
    return b;
  });

  function syncVisibility() {
    const g = s.mode === 'gradient';
    fg2.el.hidden = !g;
    bg2.el.hidden = !g || s.transparent;
    fgRow.classList.toggle('is-single', !g);
    bgRow.classList.toggle('is-single', !g || s.transparent);
    Array.from(fgRow.querySelectorAll('.qrt-pair-arrow')).forEach((a) => { a.hidden = !g; });
    Array.from(bgRow.querySelectorAll('.qrt-pair-arrow')).forEach((a) => { a.hidden = !g || s.transparent; });
    bgField.hidden = s.transparent;
    gradTypeField.hidden = !g;
    angleField.hidden = !g || s.gradType === 'radial';
  }

  function syncControls() {
    modeSeg.set(s.mode);
    gradTypeSeg.set(s.gradType);
    angle.set(s.angle);
    fg1.set(s.fg1); fg2.set(s.fg2); bg1.set(s.bg1); bg2.set(s.bg2);
    transparent.input.checked = s.transparent;
    dotSeg.set(s.dot);
    eyeSeg.set(s.eye);
    syncVisibility();
  }

  /* ---- render loop ---- */
  function schedule() {
    if (destroyed || raf) return;
    raf = requestAnimationFrame(update);
  }

  function renderCheck(result) {
    checkBox.className = `qrt-check is-${result.level}`;
    checkTitle.textContent = { good: 'Ready to scan', warn: 'Scannable, with caution', bad: 'May not scan' }[result.level];
    checkList.textContent = '';
    result.items.forEach((i) => checkList.appendChild(h('li', { class: `is-${i.level}` }, i.text)));
  }

  function showEmpty(message, isError) {
    current.qr = null;
    stage.textContent = '';
    stage.appendChild(h('div', { class: `qrt-empty${isError ? ' is-error' : ''}` }, message));
    meta.textContent = 'No code yet';
    downloadBtn.disabled = true;
    renderCheck({ level: isError ? 'bad' : 'warn', items: [{ level: isError ? 'bad' : 'warn', text: message }] });
  }

  function update() {
    raf = 0;
    if (destroyed) return;
    const payload = buildPayload(state);
    if (!payload) {
      showEmpty('Fill in the content on the left and your QR code appears here.', false);
      return;
    }
    let qr;
    try {
      qr = generateQr(payload, s.logo ? 'H' : state.ecc);
    } catch (e) {
      showEmpty(
        e.message === 'TOO_LONG'
          ? 'There is too much data for a QR code at this error-correction level. Shorten the content or choose a lower level.'
          : 'Could not generate a QR code from this content.',
        true
      );
      return;
    }
    current.qr = qr;
    stage.innerHTML = buildSvg(qr, s, 0);
    stage.classList.remove('is-pop');
    void stage.offsetWidth; // restart the short redraw animation
    stage.classList.add('is-pop');
    meta.textContent = `${state.size} × ${state.size} px · version ${qr.version} · ${qr.size}×${qr.size} modules`;
    downloadBtn.disabled = false;
    renderCheck(scanCheck(s, qr));
  }

  /* ---- assemble ---- */
  const card = (id, title, ...kids) => h('section', { class: `qrt-card qrt-card--${id}` }, h('h2', { class: 'qrt-card-title' }, title), ...kids);

  const root = h('div', { class: 'qrt' },
    h('header', { class: 'qrt-header' },
      h('h1', { class: 'qrt-title' }, 'QR Code Generator'),
      h('p', { class: 'qrt-sub' }, 'Create customized, high-resolution QR codes with logos and custom styles.')),
    h('div', { class: 'qrt-layout' },
      h('div', { class: 'qrt-col' },
        card('content', 'Content', field('Content type', typeSeg.el), Object.keys(panelEls).map((k) => panelEls[k])),
        card('appearance', 'Appearance and styling',
          field('Color mode', modeSeg.el),
          fgField, bgField, transparent.el, gradTypeField, angleField,
          field('Dot shape', dotSeg.el),
          field('Corner shape', eyeSeg.el),
          field('Center logo', drop),
          dropMsg,
          logoSizeField,
          field('Quiet zone', quiet.el, 'The blank border around the code. 4 is the standard.')),
        card('advanced', 'Advanced options', eccField, field('Export size', sizeSel))),
      h('div', { class: 'qrt-col qrt-col--sticky' },
        card('preview', 'Live preview', stage, meta, checkBox),
        card('presets', 'Quick styles', h('div', { class: 'qrt-presets' }, presetBtns)),
        card('export', 'Export', field('Format', formatSeg.el, null), formatHint, downloadBtn, toast))));

  container.appendChild(root);
  showPanel();
  syncControls();
  update();

  return {
    /** Remove the tool from the page and stop any pending work. */
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      container.textContent = '';
    },
    /** The text currently encoded in the QR code. */
    getPayload() {
      return buildPayload(state);
    },
  };
}

export default mountQrCodeGenerator;

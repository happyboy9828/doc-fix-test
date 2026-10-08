import { downloadBlob } from "../../shared/download";

const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const HISTORY_LIMIT = 10;
const MAX_DECODE_SIZE = 1280;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/* ---------------------------- Decoder ---------------------------- */

let jsQRPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsQRPromise) {
    jsQRPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_CDN;
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => {
        jsQRPromise = null;
        reject(new Error('Could not load the QR decoder. Check your connection.'));
      };
      document.head.appendChild(s);
    });
  }
  return jsQRPromise;
}

// Returns async fn(source) -> { text, points:[{x,y}x4] } | null
async function createDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (source) => {
          const found = await detector.detect(source);
          if (!found.length) return null;
          return {
            text: found[0].rawValue,
            points: found[0].cornerPoints.map((p) => ({ x: p.x, y: p.y })),
          };
        };
      }
    } catch (e) {
      /* fall through to jsQR */
    }
  }

  const jsQR = await loadJsQR();
  const work = document.createElement('canvas');
  const ctx = work.getContext('2d', { willReadFrequently: true });

  return async (source) => {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return null;
    const scale = Math.min(1, MAX_DECODE_SIZE / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    work.width = w;
    work.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const r = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (!r) return null;
    const l = r.location;
    const pts = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner];
    return { text: r.data, points: pts.map((p) => ({ x: p.x / scale, y: p.y / scale })) };
  };
}

/* ----------------------------- Parsing --------------------------- */

function parseWifi(body) {
  const out = { ssid: '', password: '', security: 'nopass', hidden: false };
  (body.match(/(?:\\.|[^;])+/g) || []).forEach((part) => {
    const key = part.charAt(0).toUpperCase();
    const val = part.slice(2).replace(/\\(.)/g, '$1');
    if (key === 'S') out.ssid = val;
    if (key === 'P') out.password = val;
    if (key === 'T') out.security = val || 'nopass';
    if (key === 'H') out.hidden = val === 'true';
  });
  return out;
}

function parsePayload(raw) {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) return { kind: 'url', label: 'Web URL', text };
  if (/^WIFI:/i.test(text)) return { kind: 'wifi', label: 'Wi-Fi Network', text, wifi: parseWifi(text.slice(5)) };
  if (/^BEGIN:VCARD/i.test(text)) return { kind: 'vcard', label: 'Contact Card (vCard)', text };
  if (/^mailto:/i.test(text)) return { kind: 'email', label: 'Email', text };
  if (/^tel:/i.test(text)) return { kind: 'tel', label: 'Phone Number', text };
  if (/^smsto?:/i.test(text)) return { kind: 'sms', label: 'SMS', text };
  if (/^geo:/i.test(text)) return { kind: 'geo', label: 'Location', text };
  return { kind: 'text', label: 'Plain Text', text };
}

/* ------------------------------ Helpers -------------------------- */

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
    } catch (e) {
      reject(e);
    }
    document.body.removeChild(ta);
  });
}

function drawBox(canvas, w, h, points) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!points || points.length < 4) return;
  ctx.lineWidth = Math.max(3, w / 160);
  ctx.strokeStyle = '#22c55e';
  ctx.fillStyle = 'rgba(34,197,94,0.18)';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const TEMPLATE = `
<section class="qrs">
  <header class="qrs-header">
    <h1>QR Code Scanner</h1>
    <p>Scan QR codes via live camera feed or upload image files instantly.</p>
  </header>

  <div class="qrs-grid">
    <div class="qrs-card">
      <div class="qrs-tabs">
        <button type="button" class="qrs-tab is-active" data-tab="camera">&#9679; Live Camera</button>
        <button type="button" class="qrs-tab" data-tab="upload">Upload File</button>
      </div>

      <div data-pane="camera">
        <div class="qrs-viewport" data-ref="viewport">
          <video playsinline muted data-ref="video"></video>
          <canvas class="qrs-overlay" data-ref="overlay"></canvas>
          <div class="qrs-reticle"><i></i><i></i><i></i><i></i></div>
          <div class="qrs-laser"></div>
          <div class="qrs-placeholder" data-ref="camMsg">Camera is off</div>
        </div>
        <div class="qrs-controls">
          <select class="qrs-select" data-ref="facing" aria-label="Camera">
            <option value="environment">Rear camera</option>
            <option value="user">Front camera</option>
          </select>
          <button type="button" class="qrs-btn qrs-btn-primary" data-ref="camToggle">Start Camera</button>
        </div>
      </div>

      <div data-pane="upload" hidden>
        <label class="qrs-drop" data-ref="drop">
          <input type="file" accept="image/png,image/jpeg,image/webp" data-ref="file" hidden />
          <canvas class="qrs-preview" data-ref="preview" hidden></canvas>
          <span data-ref="dropMsg">Drag &amp; drop a QR image here<br /><small>or click to browse (PNG, JPG, WEBP)</small></span>
        </label>
      </div>
    </div>

    <div class="qrs-card">
      <div class="qrs-status" data-ref="status">Status: Waiting for a code&hellip;</div>

      <div class="qrs-terminal">
        <div class="qrs-row"><span>Type:</span> <strong data-ref="type">&mdash;</strong></div>
        <div class="qrs-row-label">Payload:</div>
        <pre class="qrs-payload" data-ref="payload">Nothing scanned yet.</pre>
      </div>

      <div class="qrs-actions-title">Quick Actions</div>
      <div class="qrs-actions">
        <button type="button" class="qrs-btn qrs-btn-primary" data-ref="primary" hidden></button>
        <button type="button" class="qrs-btn" data-ref="copy" disabled>Copy Payload to Clipboard</button>
      </div>
      <p class="qrs-hint" data-ref="hint" hidden></p>

      <div class="qrs-actions-title">Scan History Log</div>
      <ul class="qrs-history" data-ref="history"><li class="qrs-empty">No scans yet.</li></ul>
    </div>
  </div>
</section>`;

/* ------------------------------ Main ----------------------------- */

export function createQRScanner(root) {
  root.innerHTML = TEMPLATE;

  const ui = {};
  root.querySelectorAll('[data-ref]').forEach((n) => { ui[n.dataset.ref] = n; });
  const tabs = root.querySelectorAll('[data-tab]');
  const panes = root.querySelectorAll('[data-pane]');

  let decoder = null;
  let stream = null;
  let rafId = 0;
  let lastTick = 0;
  let busy = false;
  let lastText = '';
  let lastTime = 0;
  let clearTimer = 0;
  let copyTimer = 0;
  let audioCtx = null;
  let current = null;
  let objectUrl = null;
  const history = [];
  const cleanups = [];

  const on = (target, evt, fn) => {
    target.addEventListener(evt, fn);
    cleanups.push(() => target.removeEventListener(evt, fn));
  };

  function setStatus(msg, state) {
    ui.status.textContent = 'Status: ' + msg;
    ui.status.className = 'qrs-status' + (state ? ' is-' + state : '');
  }

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch (e) { /* audio is optional */ }
  }

  /* ---------- Result rendering ---------- */

  function showHint(msg) {
    ui.hint.hidden = !msg;
    ui.hint.textContent = msg || '';
  }

  function runPrimary() {
    if (!current) return;
    const { kind, text, wifi } = current;
    if (kind === 'url') {
      window.open(text, '_blank', 'noopener,noreferrer');
    } else if (kind === 'wifi') {
      const done = () => showHint('Password copied. Open your device Wi-Fi settings, choose "' + wifi.ssid + '" and paste it. Browsers cannot join networks automatically.');
      wifi.password ? copyText(wifi.password).then(done, done) : showHint('Open network "' + wifi.ssid + '" in your device Wi-Fi settings (no password needed).');
    } else if (kind === 'vcard') {
      const blob = new Blob([text], { type: 'text/vcard' });
      const result = downloadBlob(blob, 'contact.vcf');
      if (!result.ok) {
        showHint(result.reason);
      } else {
        showHint('Contact file downloaded. Open it to add to your contacts.');
      }
    } else if (kind === 'geo') {
      const coords = text.replace(/^geo:/i, '').split('?')[0];
      window.open('https://www.google.com/maps?q=' + encodeURIComponent(coords), '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = text; // mailto:, tel:, sms:
    }
  }

  const PRIMARY_LABELS = {
    url: 'Open URL in New Tab',
    wifi: 'Connect to Network',
    vcard: 'Add to Contacts',
    email: 'Compose Email',
    tel: 'Call Number',
    sms: 'Send SMS',
    geo: 'Open in Maps',
  };

  function showResult(parsed) {
    current = parsed;
    ui.type.textContent = parsed.label;
    if (parsed.kind === 'wifi') {
      const w = parsed.wifi;
      ui.payload.textContent =
        'SSID: ' + w.ssid + '\nSecurity: ' + w.security + '\nPassword: ' + (w.password || '(none)') + (w.hidden ? '\nHidden network' : '');
    } else {
      ui.payload.textContent = parsed.text;
    }
    ui.copy.disabled = false;
    const label = PRIMARY_LABELS[parsed.kind];
    ui.primary.hidden = !label;
    if (label) ui.primary.textContent = label;
    showHint('');
    setStatus('Active Code Detected', 'ok');
  }

  function renderHistory() {
    ui.history.innerHTML = '';
    if (!history.length) {
      const li = document.createElement('li');
      li.className = 'qrs-empty';
      li.textContent = 'No scans yet.';
      ui.history.appendChild(li);
      return;
    }
    history.forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qrs-history-item';
      const time = document.createElement('time');
      time.textContent = item.time;
      const span = document.createElement('span');
      span.textContent = item.parsed.text.length > 60 ? item.parsed.text.slice(0, 60) + '…' : item.parsed.text;
      btn.append(time, span);
      btn.addEventListener('click', () => showResult(item.parsed));
      li.appendChild(btn);
      ui.history.appendChild(li);
    });
  }

  function handleHit(hit, canvas, w, h, pulseTarget) {
    drawBox(canvas, w, h, hit.points);
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      if (canvas.isConnected && canvas === ui.overlay) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }, 700);

    // Target-lock pulse
    pulseTarget.classList.remove('is-locked');
    void pulseTarget.offsetWidth;
    pulseTarget.classList.add('is-locked');

    const now = Date.now();
    if (hit.text !== lastText || now - lastTime > 3000) {
      const parsed = parsePayload(hit.text);
      beep();
      showResult(parsed);
      history.unshift({ time: new Date().toLocaleTimeString([], { hour12: false }), parsed });
      if (history.length > HISTORY_LIMIT) history.pop();
      renderHistory();
    }
    lastText = hit.text;
    lastTime = now;
  }

  /* ---------- Camera ---------- */

  function loop(t) {
    if (!stream) return;
    rafId = requestAnimationFrame(loop);
    if (t - lastTick < 150 || busy || ui.video.readyState < 2) return;
    lastTick = t;
    busy = true;
    decoder(ui.video)
      .then((hit) => {
        busy = false;
        if (hit && stream) handleHit(hit, ui.overlay, ui.video.videoWidth, ui.video.videoHeight, ui.viewport);
      })
      .catch(() => { busy = false; });
  }

  function stopCamera() {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    busy = false;
    ui.video.srcObject = null;
    ui.viewport.classList.remove('is-live');
    ui.camMsg.hidden = false;
    ui.camMsg.textContent = 'Camera is off';
    ui.camToggle.textContent = 'Start Camera';
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Camera needs HTTPS (or localhost) and a supported browser.', 'error');
      return;
    }
    try {
      ui.camMsg.hidden = false;
      ui.camMsg.textContent = 'Starting camera…';
      decoder = decoder || (await createDecoder());
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: ui.facing.value } },
        audio: false,
      });
      ui.video.srcObject = stream;
      await ui.video.play();
      if (ui.video.videoWidth) ui.viewport.style.aspectRatio = ui.video.videoWidth + ' / ' + ui.video.videoHeight;
      ui.viewport.classList.add('is-live');
      ui.camMsg.hidden = true;
      ui.camToggle.textContent = 'Stop Camera';
      setStatus('Scanning…');
      rafId = requestAnimationFrame(loop);
    } catch (err) {
      stopCamera();
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setStatus(denied ? 'Camera permission denied.' : (err && err.message) || 'Could not start camera.', 'error');
    }
  }

  /* ---------- Upload ---------- */

  async function handleFile(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus('Unsupported file. Use PNG, JPG or WEBP.', 'error');
      return;
    }
    try {
      setStatus('Reading image…');
      decoder = decoder || (await createDecoder());
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not read that image.'));
        img.src = objectUrl;
      });

      const cv = ui.preview;
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.hidden = false;
      ui.dropMsg.hidden = true;
      ui.drop.classList.add('has-image');

      const hit = await decoder(img);
      if (!hit) {
        setStatus('No QR code found in this image.', 'error');
        return;
      }
      lastText = ''; // always register an uploaded scan
      handleHit(hit, cv, cv.width, cv.height, ui.drop);
      // handleHit clears the box canvas, so redraw the image + box
      const ctx = cv.getContext('2d');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      drawBox(cv, img.naturalWidth, img.naturalHeight, hit.points);
      cv.getContext('2d').globalCompositeOperation = 'destination-over';
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.getContext('2d').globalCompositeOperation = 'source-over';
    } catch (err) {
      setStatus(err.message || 'Failed to scan image.', 'error');
    }
  }

  /* ---------- Events ---------- */

  tabs.forEach((tab) => {
    on(tab, 'click', () => {
      const name = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panes.forEach((p) => { p.hidden = p.dataset.pane !== name; });
      if (name === 'upload') stopCamera();
    });
  });

  on(ui.camToggle, 'click', () => (stream ? stopCamera() : startCamera()));
  on(ui.facing, 'change', () => { if (stream) { stopCamera(); startCamera(); } });
  on(ui.video, 'loadedmetadata', () => {
    ui.viewport.style.aspectRatio = ui.video.videoWidth + ' / ' + ui.video.videoHeight;
  });

  on(ui.file, 'change', () => { handleFile(ui.file.files[0]); ui.file.value = ''; });
  ['dragenter', 'dragover'].forEach((e) =>
    on(ui.drop, e, (ev) => { ev.preventDefault(); ui.drop.classList.add('is-over'); })
  );
  ['dragleave', 'drop'].forEach((e) =>
    on(ui.drop, e, (ev) => { ev.preventDefault(); ui.drop.classList.remove('is-over'); })
  );
  on(ui.drop, 'drop', (ev) => handleFile(ev.dataTransfer.files[0]));

  on(ui.primary, 'click', runPrimary);
  on(ui.copy, 'click', () => {
    if (!current) return;
    copyText(current.text).then(() => {
      ui.copy.textContent = '\u2713 Copied!';
      ui.copy.classList.add('is-done');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        ui.copy.textContent = 'Copy Payload to Clipboard';
        ui.copy.classList.remove('is-done');
      }, 1800);
    }, () => showHint('Copy failed. Select the text and copy manually.'));
  });

  /* ---------- Cleanup ---------- */

  return function destroy() {
    stopCamera();
    clearTimeout(clearTimer);
    clearTimeout(copyTimer);
    cleanups.forEach((fn) => fn());
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (audioCtx && audioCtx.close) audioCtx.close();
    root.innerHTML = '';
  };
}
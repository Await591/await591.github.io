import { state } from './state.js';

/**
 * Detects browser UA and platform. Drives the OS-detect panel (matching tile
 * highlight + readout). Hidden #sys-user-agent / #sys-platform spans remain
 * for backward compat with terminal commands and tweaks.
 */
export function detectPlatform() {
  const ua    = navigator.userAgent;
  const lower = ua.toLowerCase();
  let platform = 'unknown';

  if (/iphone|ipad|ipod/.test(lower))       platform = 'ios';
  else if (/android/.test(lower))            platform = 'android';
  else if (/win/.test(lower))                platform = 'windows';
  else if (/macintosh|mac os x/.test(lower)) platform = 'macos';
  else if (/linux/.test(lower))              platform = 'linux';

  const uaEl   = document.getElementById('sys-user-agent');
  const platEl = document.getElementById('sys-platform');
  if (uaEl)   uaEl.textContent   = ua;
  if (platEl) platEl.textContent = platform;

  /* Drive the visible OS-detect tile grid */
  const grid = document.getElementById('os-detect-grid');
  if (grid) {
    grid.querySelectorAll('.os-tile').forEach((tile) => {
      tile.classList.toggle('is-match', tile.dataset.os === platform);
    });
  }
  const nameEl = document.getElementById('os-detect-name');
  if (nameEl) nameEl.textContent = platform;
  const chip = document.getElementById('os-detect-chip');
  if (chip) chip.textContent = platform === 'unknown' ? '[ unknown ]' : `[ ${platform} ]`;
}

/**
 * Animated handshake canvas: scrolling waveform + rx/tx blip lines.
 * Visualises a stable 44.1khz "signal" that breathes with sine + jitter.
 * Self-cleans via state.intervals (raf id).
 */
export function initNetHandshake() {
  const canvas = document.getElementById('net-handshake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cssW = 0, cssH = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    cssW = rect.width;
    cssH = rect.height;
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  state.observers = state.observers || [];
  state.observers.push(ro);

  const SAMPLES = 96;
  const buf = new Float32Array(SAMPLES);
  let t = 0;
  let rafId = 0;
  let running = false;

  function frame() {
    if (!state.motionEnabled) {
      // Motion off: static render once, mark as paused. We listen for
      // motion-change below to resume the loop instead of dying silently.
      drawOnce(0);
      running = false;
      return;
    }
    t += 1;
    // Shift buffer left, push new sample
    for (let i = 0; i < SAMPLES - 1; i++) buf[i] = buf[i + 1];
    const phase = t * 0.12;
    const sample =
      Math.sin(phase) * 0.45 +
      Math.sin(phase * 2.3) * 0.25 +
      Math.sin(phase * 5.1) * 0.12 +
      (Math.random() - 0.5) * 0.18;
    buf[SAMPLES - 1] = sample;

    drawOnce(t);
    rafId = requestAnimationFrame(frame);
  }

  function drawOnce(tick) {
    if (cssW === 0 || cssH === 0) { resize(); if (cssW === 0) return; }
    ctx.clearRect(0, 0, cssW, cssH);

    // Faint grid
    ctx.strokeStyle = 'rgba(51, 255, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cssW; x += 12) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, cssH); ctx.stroke();
    }
    for (let y = 0; y < cssH; y += 12) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(cssW, y + 0.5); ctx.stroke();
    }

    // Center waveform
    const midY = cssH * 0.45;
    const amp  = cssH * 0.32;
    ctx.strokeStyle = 'rgba(51, 255, 0, 0.95)';
    ctx.shadowColor = 'rgba(51, 255, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < SAMPLES; i++) {
      const x = (i / (SAMPLES - 1)) * cssW;
      const y = midY + buf[i] * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // rx/tx blips — packets traveling left-to-right (rx) and right-to-left (tx)
    const blipY1 = cssH - 14;
    const blipY2 = cssH - 6;
    ctx.fillStyle = 'rgba(51, 255, 0, 0.85)';
    for (let i = 0; i < 4; i++) {
      const px = ((tick * 1.6) + i * (cssW / 4)) % cssW;
      ctx.fillRect(px, blipY1, 6, 1.4);
    }
    ctx.fillStyle = 'rgba(255, 176, 0, 0.85)';
    for (let i = 0; i < 4; i++) {
      const px = (cssW - ((tick * 1.6) + i * (cssW / 4)) % cssW);
      ctx.fillRect(px - 6, blipY2, 6, 1.4);
    }

    // Labels
    ctx.fillStyle = 'rgba(180, 220, 180, 0.5)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('rx →', 4, blipY1 - 3);
    ctx.fillText('tx ←', cssW - 28, blipY2 - 3);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  start();

  /* Resume rAF loop when user re-enables motion via the tweaks panel. */
  document.addEventListener('await591:motion-change', (e) => {
    if (e.detail?.enabled) start();
  });

  state.intervals.push({ cancel: () => { running = false; cancelAnimationFrame(rafId); } });
}

/**
 * Returns an ASCII progress bar string, e.g. "[|||||.....]".
 */
export function asciiMeter(value, total = 10) {
  const filled = Math.max(0, Math.min(total, Math.round((value / 100) * total)));
  return `[${'|'.repeat(filled)}${'.'.repeat(total - filled)}]`;
}

/**
 * Updates a meter widget (fill bar + ascii text + numeric label).
 */
export function setMeter(prefix, value) {
  const numericEl = document.getElementById(`${prefix}-value`);
  const fillEl    = document.getElementById(`${prefix}-fill`);
  const asciiEl   = document.getElementById(`${prefix}-ascii`);

  if (numericEl) numericEl.textContent = `${String(value).padStart(2, '0')}%`;
  if (fillEl)    fillEl.style.width    = `${value}%`;
  if (asciiEl)   asciiEl.textContent   = asciiMeter(value);
}

/**
 * Starts the live system-metrics ticker (CPU, memory, uptime, time).
 */
export function initStats() {
  const health = 82;
  const healthFill  = document.getElementById('health-fill');
  const healthAscii = document.getElementById('health-ascii');
  if (healthFill)  healthFill.style.width    = `${health}%`;
  if (healthAscii) healthAscii.textContent   = asciiMeter(health);

  function tick() {
    const cpu  = Math.floor(18 + Math.random() * 43);
    const mem  = Math.floor(29 + Math.random() * 37);
    const elapsed = Math.floor((performance.now() - state.start) / 1000);
    const h   = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m   = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s   = String(elapsed % 60).padStart(2, '0');
    const uptimeRatio = Math.min(100, Math.floor((elapsed / 180) * 100));

    setMeter('cpu', cpu);
    setMeter('mem', mem);

    const uptimeEl = document.getElementById('uptime-value');
    const uptimeFill  = document.getElementById('uptime-fill');
    const uptimeAscii = document.getElementById('uptime-ascii');
    const timeEl      = document.getElementById('sys-time');
    const sessionEl   = document.getElementById('sys-session');

    if (uptimeEl)    uptimeEl.textContent  = `${h}:${m}:${s}`;
    if (uptimeFill)  uptimeFill.style.width = `${uptimeRatio}%`;
    if (uptimeAscii) uptimeAscii.textContent = asciiMeter(uptimeRatio);
    if (timeEl)      timeEl.textContent    = new Date().toISOString().slice(11, 19);
    if (sessionEl)   sessionEl.textContent = elapsed < 8 ? 'warmup' : 'stable';
  }

  tick();
  const interval = window.setInterval(tick, 1000);
  state.intervals.push(interval);
}

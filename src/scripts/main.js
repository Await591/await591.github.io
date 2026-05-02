/**
 * Main client-side entry point.
 * Imported once by index.astro via <script>.
 */
import { state }                          from './state.js';
import { bootSequence, typeCommand }      from './boot.js';
import { detectPlatform, initStats, initNetHandshake } from './stats.js';
import { initTerminal, initFloatingTerminal } from './terminal.js';
import { initReveal, initTopbar, initCinemaFrames } from './cinema.js';
import { initTweaks, applyTheme }         from './tweaks.js';
import { initThree }                      from './three-bg.js';

/* Initialise shared start timestamp */
state.start = performance.now();

/* Respect prefers-reduced-motion */
if (window.matchMedia) {
  state.motionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── Boot & visual setup ── */
bootSequence();
typeCommand();
initReveal();
initTopbar();
initCinemaFrames();

/* ── Telemetry + handshake animation ── */
detectPlatform();
initStats();
initNetHandshake();

/* ── Interactive UI ── */
initTerminal();
initFloatingTerminal();
initTweaks();

/* ── Three.js background ── */
initThree();

/* ── Apply default theme (also syncs Three.js colours) ── */
applyTheme('green');

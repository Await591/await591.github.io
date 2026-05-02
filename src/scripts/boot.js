import { state } from './state.js';

const BOOT_STEPS = [
  'loading runtime modules...',
  'warming visual pipeline...',
  'binding external endpoints...',
  'launching public shell...',
];

/**
 * Drives the startup progress bar and boot-line animations,
 * then fades out the overlay once done.
 */
export function bootSequence() {
  const overlay     = document.getElementById('boot-overlay');
  const progressBar = document.getElementById('boot-progress-bar');
  const statusEl    = document.getElementById('boot-status');
  const lines       = Array.from(document.querySelectorAll('.boot-line'));

  let progress = 0;
  let lineIdx  = 0;

  const interval = window.setInterval(() => {
    progress += 4;
    progressBar.style.width = `${progress}%`;

    const stepIndex = Math.min(Math.floor(progress / 25), BOOT_STEPS.length - 1);
    statusEl.textContent = BOOT_STEPS[stepIndex];

    if (progress >= (lineIdx + 1) * 25 && lines[lineIdx]) {
      lines[lineIdx].classList.add('is-complete');
      lines[lineIdx].querySelector('.boot-line-status').textContent = '[ok ]';
      lineIdx += 1;
    }

    if (progress >= 100) {
      window.clearInterval(interval);
      window.setTimeout(() => overlay.classList.add('is-hidden'), 220);
    }
  }, 65);

  state.intervals.push(interval);
}

/**
 * Types out a command string character-by-character in the hero section.
 */
export function typeCommand() {
  const target = document.getElementById('type-target');
  if (!target) return;

  const text = 'whoami --verbose';
  let index = 0;

  function tick() {
    if (index <= text.length) {
      target.textContent = text.slice(0, index);
      index += 1;
      const delay = index < text.length ? 68 : 640;
      window.setTimeout(tick, delay);
    }
  }

  tick();
}

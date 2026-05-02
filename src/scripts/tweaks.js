import { state } from './state.js';

const THEME_MAP = {
  green: {
    primary:  '#33ff00',
    secondary:'#ffb000',
    muted:    '#1f521f',
    border:   '#1f521f',
    text:     '#c7ffc0',
    textDim:  '#74ad6f',
  },
  amber: {
    primary:  '#ffb000',
    secondary:'#33ff00',
    muted:    '#614713',
    border:   '#614713',
    text:     '#ffe0a6',
    textDim:  '#b08a43',
  },
};

function hexToRgba(hex, alpha) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >>  8) & 255;
  const b =  n        & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateActiveButtons(selector, activeValue) {
  document.querySelectorAll(selector).forEach((btn) => {
    const isActive = Object.values(btn.dataset).includes(activeValue);
    btn.classList.toggle('is-active', isActive);
  });
}

/**
 * Applies a named theme by updating CSS custom properties on :root,
 * then fires the 'await591:theme-change' event so three-bg can
 * update its material colours without a circular import.
 */
export function applyTheme(name) {
  const theme = THEME_MAP[name];
  if (!theme) return;

  const root = document.documentElement;
  root.style.setProperty('--primary',   theme.primary);
  root.style.setProperty('--secondary', theme.secondary);
  root.style.setProperty('--muted',     theme.muted);
  root.style.setProperty('--border',    theme.border);
  root.style.setProperty('--text',      theme.text);
  root.style.setProperty('--text-dim',  theme.textDim);
  root.style.setProperty('--glow',      `0 0 6px ${hexToRgba(theme.primary, 0.45)}`);

  state.accent = name;
  updateActiveButtons('[data-theme]', name);

  document.dispatchEvent(new CustomEvent('await591:theme-change'));
}

/**
 * Wires the Tweaks panel toggle, theme buttons, and motion buttons.
 */
export function initTweaks() {
  const toggle = document.getElementById('tweaks-toggle');
  const panel  = document.getElementById('tweaks-panel');
  if (!toggle || !panel) return;

  // Panel open/close
  toggle.addEventListener('click', () => {
    const open = panel.dataset.open === 'true';
    panel.dataset.open = String(!open);
    toggle.setAttribute('aria-expanded', String(!open));
  });

  // Theme buttons
  document.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  // Motion buttons
  document.querySelectorAll('[data-motion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const enabled = btn.dataset.motion === 'on';
      state.motionEnabled = enabled;
      updateActiveButtons('[data-motion]', enabled ? 'on' : 'off');
      // Hook for pure-CSS animations (e.g. background marquee) that need
      // to pause without listening to the JS event.
      document.documentElement.classList.toggle('motion-off', !enabled);
      document.dispatchEvent(
        new CustomEvent('await591:motion-change', { detail: { enabled } })
      );
    });
  });
}

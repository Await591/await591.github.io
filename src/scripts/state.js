/**
 * Shared mutable state. Imported as a singleton by all script modules.
 * Because ES modules are cached, every import gets the same object reference.
 */
export const state = {
  /** Whether motion / animation is enabled (respects prefers-reduced-motion). */
  motionEnabled: true,
  /** Active theme name: 'green' | 'amber' */
  accent: 'green',
  /** High-res timestamp of page init (set in main.js). */
  start: 0,
  /** requestAnimationFrame handle for Three.js loop. */
  animationFrame: 0,
  /** setInterval handles so they can be cleared if needed. */
  intervals: [],
};

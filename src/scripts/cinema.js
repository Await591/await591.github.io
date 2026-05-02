/**
 * Activates IntersectionObserver-based reveal animations for
 * all elements with the `.reveal` class.
 */
export function initReveal() {
  const items = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  items.forEach((item) => observer.observe(item));
}

/**
 * Shows the topbar border + background once the user scrolls past 16px.
 */
export function initTopbar() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  function update() {
    topbar.classList.toggle('is-scrolled', window.scrollY > 16);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
}

/**
 * Tracks how centered each [data-cinema] element is in the viewport
 * and writes --frame-progress (0–1) as a CSS custom property so the
 * CSS parallax/sheen effects know how far along the scroll they are.
 */
export function initCinemaFrames() {
  const frames = Array.from(document.querySelectorAll('[data-cinema]'));
  if (!frames.length) return;

  function update() {
    const viewportH = window.innerHeight;
    frames.forEach((frame) => {
      const rect     = frame.getBoundingClientRect();
      const center   = rect.top + rect.height / 2;
      const distance = Math.abs(viewportH / 2 - center);
      const progress = Math.max(0, 1 - distance / (viewportH * 0.85));
      frame.style.setProperty('--frame-progress', progress.toFixed(3));
    });
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

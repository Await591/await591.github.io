import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * 16:9 cinematic section with a Hitchcock dolly-zoom effect.
 *
 * Mechanism:
 *  - A CSS coordinate-grid background sits inside an overflow:hidden container.
 *  - As the section scrolls into the viewport, Framer Motion scales the grid
 *    from 1.0 → 1.22 (background rushes toward you).
 *  - Foreground text has no opposing scale, so it stays fixed — the dolly-zoom
 *    visual tension of subject vs. background moving in opposite directions.
 */
export function CinemaStage() {
  const ref = useRef<HTMLElement>(null);

  /* Track from when section enters viewport to when it's half-way through */
  const { scrollYProgress } = useScroll({
    target:  ref,
    offset: ['start end', 'center center'],
  });

  /* Background: zoom IN as section enters — Hitchcock effect */
  const bgScale   = useTransform(scrollYProgress, [0, 1], [1.0, 1.22]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.3, 0.9, 1], [0.1, 0.44, 0.44, 0.28]);

  /* Foreground: fade + lift */
  const fgOpacity = useTransform(scrollYProgress, [0.15, 0.42], [0, 1]);
  const fgY       = useTransform(scrollYProgress, [0.15, 0.42], [50, 0]);

  /* Eyebrow / sub text delays slightly */
  const subOpacity = useTransform(scrollYProgress, [0.28, 0.5], [0, 1]);

  return (
    <section ref={ref} className="cinema-stage-wrap">
      {/* Hitchcock-zooming coordinate grid */}
      <motion.div
        className="cinema-stage-bg"
        style={{ scale: bgScale, opacity: bgOpacity }}
      />

      {/* Radial burn overlay */}
      <div className="cinema-stage-burn" />

      {/* Foreground content — no counter-scale, stays fixed */}
      <motion.div
        className="cinema-stage-content"
        style={{ opacity: fgOpacity, y: fgY }}
      >
        <motion.p className="cinema-stage-eyebrow" style={{ opacity: subOpacity }}>
          await591@signal:~$ tail -f /var/log/releases.log
        </motion.p>

        <h2 className="cinema-stage-title glitch" data-text="CHRONOLOGICAL_RECORD">
          CHRONOLOGICAL_RECORD
        </h2>

        <motion.p className="cinema-stage-sub" style={{ opacity: subOpacity }}>
          [ scroll to navigate log ]
        </motion.p>
      </motion.div>
    </section>
  );
}

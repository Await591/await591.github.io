import { useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

/* ── Chapter data — each chapter pulls its own cover art as background ── */
const CHAPTERS = [
  {
    ts:      '2022-09-16T00:00:00Z',
    pid:     '0x2A4B',
    process: 'NAIDA_INIT',
    status:  'OK',
    bg:      '/assets/Lost%20Track%20Vol.3.jpg',
    lines: [
      'collab    ->  Windwan & Await591',
      'label     ->  LBD Records / LostTrackVol.3',
      'genre     ->  future riddim',
      'signal    ->  [|||||||...] 70% received',
    ],
    href: 'https://open.spotify.com/track/0wE78XeVwZ3dWJlAhcMdDj',
  },
  {
    ts:      '2022-11-11T00:00:00Z',
    pid:     '0x3F1C',
    process: 'IN_THE_BACK_VIP',
    status:  'OK',
    bg:      '/assets/In%20The%20Back%20(VIP%20Extended%20Mix).jpg',
    lines: [
      'collab    ->  JocularACE & Await591',
      'protocol  ->  carnival',
      'genre     ->  uk hardcore + melbourne bounce',
      'signal    ->  [||||||||||] 100% received',
    ],
    href: 'https://open.spotify.com/track/0u4QJqXx55XX9UViQs1ZVt',
  },
  {
    ts:      '2023-08-20T00:00:00Z',
    pid:     '0x6D2F',
    process: 'SURGE',
    status:  'OK',
    bg:      '/assets/Surge.jpg',
    lines: [
      'solo      ->  Await591',
      'hash      ->  0x2f1a822db3',
      'genre     ->  ambient / coastal',
      'signal    ->  [||||.......] 40% received',
    ],
    href: 'https://open.spotify.com/album/2hfjvVSgNzTYAbFlMkVqKT',
  },
  {
    ts:      '2025-01-01T00:00:00Z',
    pid:     '0x9A77',
    process: 'SYMMETRY_EP',
    status:  'OK',
    bg:      '/assets/SYMMETRY_EP.jpg',
    lines: [
      'solo      ->  Await591',
      'label     ->  Symmetrical Music',
      'tracks    ->  Depict / Expunge / Relinquish',
      'signal    ->  [||||||||||] 100% received',
    ],
    href: 'https://open.spotify.com/album/7LdvVyhTOP0QwtiIE8Mt7I',
  },
] as const;

const N = CHAPTERS.length;

/* Section is N+1 viewports tall: 1 intro ("opening titles" / letterbox open),
 * then N chapter slots. INTRO_FRAC is the share of total scroll progress
 * spent in the intro phase. */
const INTRO_FRAC = 1 / (N + 1);
const TOTAL_VH   = (N + 1) * 100;

/** Single chapter panel — fades in/out + bg drift based on its scroll window.
 *  The outer section is N*100vh tall. With offset ['start start','end end'],
 *  scrollYProgress 0..1 covers exactly the sticky-pinned scroll range, so each
 *  chapter occupies an even 1/N slice. Fade margins are tight (0.04) so the
 *  final chapter has time to be fully read before the next section appears. */
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function Chapter({
  chapter,
  index,
  progress,
}: {
  chapter: (typeof CHAPTERS)[number];
  index: number;
  /** Progress within the chapter phase only (0..1, intro already excluded). */
  progress: number;
}) {
  const start = index / N;
  const end   = (index + 1) / N;
  const fade  = 1 / N * 0.18;
  const isLast = index === N - 1;

  /* Manual piecewise-linear opacity. Last chapter holds at 1 until the very end
   * so the reader has time to finish before the section unpins. */
  let opacity: number;
  if (progress <= start) opacity = 0;
  else if (progress < start + fade) opacity = (progress - start) / fade;
  else if (isLast) opacity = 1;
  else if (progress < end - fade) opacity = 1;
  else if (progress < end) opacity = (end - progress) / fade;
  else opacity = 0;

  /* Slide-up offset, only during fade-in */
  const slideT = clamp01((progress - start) / (fade * 1.4));
  const y = (1 - slideT) * 36;

  /* Ken-burns drift across the chapter's own window */
  const winT = clamp01((progress - start) / (end - start));
  const bgScale = 1.05 + 0.13 * winT;
  const bgX = -2 + 4 * winT;

  return (
    <div className="scroll-chapter" style={{ opacity, transform: `translateY(${y}px)` }}>
      {/* Cover image background — heavily treated to read as terminal CRT */}
      <div
        className="scroll-chapter-bg"
        style={{
          backgroundImage: `url('${chapter.bg}')`,
          transform: `scale(${bgScale}) translateX(${bgX}%)`,
        }}
      />
      <div className="scroll-chapter-bg-overlay" />
      <div className="scroll-chapter-bg-grid" />

      {/* Foreground terminal log content */}
      <div className="scroll-chapter-content">
        <p className="chapter-timestamp">
          {chapter.ts.slice(0, 10)} &nbsp; PID:{chapter.pid} &nbsp; FRAME:{String(index + 1).padStart(2, '0')}/{String(N).padStart(2, '0')}
        </p>
        <p className="chapter-process">
          {'>>'}&nbsp; EXEC {chapter.process}.exe
        </p>
        <h3 className="chapter-title">{chapter.process}</h3>

        <div className="chapter-lines">
          {chapter.lines.map((line, i) => (
            <p key={i} className="chapter-line">{line}</p>
          ))}
        </div>

        <p className="chapter-status">
          exit code: <strong>[{chapter.status}]</strong>
        </p>

        <a
          className="chapter-link"
          href={chapter.href}
          target="_blank"
          rel="noreferrer"
        >
          open artifact &nbsp;────&gt;
        </a>
      </div>
    </div>
  );
}

/** Main export — rendered as an Astro island with client:visible.
 *  We deliberately drive the chapters via React state (not motion-value style
 *  bindings) because Framer Motion v12's scroll-timeline path generates buggy
 *  WAAPI keyframes for multi-stop opacity transforms on tall sticky sections.
 *  A plain useMotionValueEvent → setState gives us reliable inline styles. */
export function ScrollStory() {
  const outerRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target:  outerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => setProgress(v));

  /* Phase math.
   *   intro  : 0 → INTRO_FRAC      (letterbox bars open, title settles)
   *   chapters: INTRO_FRAC → 1     (existing chapter sequence)
   *
   * introT runs 0..1 across the intro slot. chapterProgress remaps the
   * post-intro range back to 0..1 so Chapter math stays unchanged. */
  const introT = clamp01(progress / INTRO_FRAC);
  const chapterProgress = clamp01(
    (progress - INTRO_FRAC) / (1 - INTRO_FRAC),
  );

  /* Letterbox bar height: starts at 50vh (top + bottom together cover the
   * whole sticky stage in solid black) and eases down to 8vh (cinematic 16:9
   * strips). Quadratic ease-out so the bars decelerate as they open. */
  const introEase = 1 - Math.pow(1 - introT, 2);
  const barHeight = `${50 - introEase * 42}vh`;

  /* Title-card opacity: visible during the first 70% of intro, fades out
   * as the chapters take over. */
  const titleCardOpacity =
    introT < 0.15 ? introT / 0.15 :
    introT < 0.7  ? 1 :
    introT < 1    ? 1 - (introT - 0.7) / 0.3 : 0;

  return (
    <section
      ref={outerRef}
      className="scroll-story-outer"
      style={{ height: `${TOTAL_VH}vh` }}
    >
      <div className="scroll-story-sticky">
        {/* Title bar */}
        <div className="scroll-story-titlebar">
          <span className="pane-title">+--- system / chronological-log ---+</span>
          <span className="status-chip">
            [ {N} entries ]
          </span>
        </div>

        {/* Chapter area */}
        <div className="scroll-story-body">
          {CHAPTERS.map((ch, i) => (
            <Chapter
              key={ch.pid}
              chapter={ch}
              index={i}
              progress={chapterProgress}
            />
          ))}

          {/* Cinematic letterbox bars — sit on top of chapters during intro,
           * shrink to thin 16:9 strips for the rest of the section so the
           * "filmstrip" framing persists. */}
          <div
            className="scroll-story-letterbox scroll-story-letterbox--top"
            style={{ height: barHeight }}
            aria-hidden="true"
          />
          <div
            className="scroll-story-letterbox scroll-story-letterbox--bottom"
            style={{ height: barHeight }}
            aria-hidden="true"
          />

          {/* Intro title card — 'projecting...' read */}
          <div
            className="scroll-story-titlecard"
            style={{ opacity: titleCardOpacity, pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <p className="scroll-story-titlecard-eyebrow">$ projecting frame buffer …</p>
            <h2 className="scroll-story-titlecard-title">CHRONOLOG.exe</h2>
            <p className="scroll-story-titlecard-meta">
              entries: {String(N).padStart(2, '0')}  ·  format: 16:9  ·  signal: locked
            </p>
            <div className="scroll-story-titlecard-bar">
              <span style={{ width: `${Math.round(introT * 100)}%` }} />
            </div>
          </div>

          {/* Scroll progress bar — manual scaleX, no motion value */}
          <div
            className="scroll-progress-bar"
            style={{ width: '100%', transform: `scaleX(${progress})`, transformOrigin: 'left' }}
          />
        </div>
      </div>
    </section>
  );
}

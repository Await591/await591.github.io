/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts,tsx,jsx,mdx}'],
  theme: {
    /* Zero-radius everywhere — no pill buttons, no rounded cards */
    borderRadius: {
      DEFAULT: '0px', none: '0px', sm: '0px',
      md: '0px', lg: '0px', xl: '0px', full: '0px',
    },
    extend: {
      /* ── Terminal colour palette ── */
      colors: {
        'terminal-bg':     '#0a0a0a',
        primary:           '#33ff00',
        secondary:         '#ffb000',
        muted:             '#1f521f',
        'terminal-border': '#1f521f',
        'terminal-text':   '#c7ffc0',
        'terminal-dim':    '#74ad6f',
        danger:            '#ff3333',
        panel:             'rgba(10,10,10,0.84)',
      },
      /* ── Monospace only ── */
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      /* ── Glow shadow ── */
      boxShadow: {
        glow:    '0 0 6px rgba(51,255,0,0.45)',
        'glow-lg': '0 0 18px rgba(51,255,0,0.30)',
      },
      /* ── Custom animations ── */
      animation: {
        blink:   'blink 1s steps(1) infinite',
        marquee: 'marquee-scroll 32s linear infinite',
        glitch:  'glitch-before 0.45s steps(1) infinite',
      },
      keyframes: {
        blink: {
          '0%':   { opacity: '1' },
          '49%':  { opacity: '1' },
          '50%':  { opacity: '0' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
};

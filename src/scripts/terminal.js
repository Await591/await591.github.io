/**
 * Appends one or more lines to the terminal output.
 */
export function appendTerminal(lines) {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  const items = Array.isArray(lines) ? lines : [lines];
  items.forEach(line => {
    const p = document.createElement('p');
    p.textContent = line;
    output.appendChild(p);
  });
  output.scrollTop = output.scrollHeight;
}

const COMMANDS = {
  help: () => [
    'available commands:',
    '  help     — show this list',
    '  about    — who is await591',
    '  skills   — tool stack',
    '  projects — release log',
    '  contact  — external links',
    '  clear    — wipe output',
  ],
  about: () => [
    'await591 // music producer // n00b developer',
    'makes sounds. sometimes writes code.',
  ],
  skills: () => [
    'audio -> ableton live / fl studio / bitwig / musescore',
    'web   -> node.js / javascript',
    'ops   -> docker',
    'code  -> python / javascript / verilog',
  ],
  projects: () => [
    'SYMMETRY EP   // math rock      // 2025-01-01',
    'Naida         // future riddim  // 2022-09-16',
    'Surge         // ambient        // 2023-08-20',
    'In The Back   // melbourne bounce // 2022-11-11',
  ],
  contact: () => [
    'github     -> github.com/Await591',
    'x          -> x.com/Await591',
    'instagram  -> instagram.com/await591_music',
    'email      -> await591@outlook.com',
  ],
  clear: (output) => {
    output.innerHTML = '';
    return null; // null signals "don't append anything"
  },
};

/**
 * Wires up the floating terminal input to respond to commands.
 */
export function initTerminal() {
  const input  = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  if (!input || !output) return;

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    const raw = input.value.trim();
    if (!raw) return;

    appendTerminal(`> ${raw}`);
    const key    = raw.toLowerCase();
    const fn     = COMMANDS[key];
    const result = fn ? fn(output) : [`command not found: ${key}`];

    if (result !== null && result.length) appendTerminal(result);
    input.value = '';
  });
}

/**
 * Wires up all opener links (nav "terminal" + hero "[ run commands ]")
 * and the close button on the floating terminal.
 */
export function initFloatingTerminal() {
  const terminal = document.getElementById('terminal-window');
  if (!terminal) return;

  const openers = [
    document.getElementById('open-terminal-link'),
    document.getElementById('hero-terminal-link'),
  ].filter(Boolean);

  /* Track the last opener so we can restore keyboard focus to it on close.
   * Without this, closing the shell drops focus on the (now-hidden) close
   * button, focus falls back to <body>, and the opener loses its focus-glow
   * — which read as a bug ("RUN COMMANDS no longer glows after closing"). */
  let lastOpener = null;

  openers.forEach(opener => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      lastOpener = opener;
      terminal.classList.add('is-visible');
      document.getElementById('terminal-input')?.focus();
    });
  });

  const closeBtn = document.getElementById('terminal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      terminal.classList.remove('is-visible');
      if (lastOpener) {
        // Defer until the close-click's focus shuffle settles, otherwise the
        // browser steals focus away to <body>.
        const target = lastOpener;
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    });
  }
}

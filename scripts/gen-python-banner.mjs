// A "personality break" banner between the hero and About Me: the Python
// mark over drifting colour bars, in the profile palette.
//
// The Python glyph comes from simple-icons (CC0-1.0). Python and the Python
// logo are trademarks of the Python Software Foundation; this is ordinary
// descriptive use — saying "I work in Python" on a personal profile.
//
//   node scripts/gen-python-banner.mjs > assets/python-banner.svg

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./assets/si-python.svg", import.meta.url), "utf8");
const d = src.match(/<path\s+d="([^"]+)"/)?.[1];
if (!d) {
  console.error("could not find the glyph path in si-python.svg");
  process.exit(1);
}

const W = 1200;
const H = 300;

// Bars that slide across behind the logo. Fixed table (no RNG) so rebuilds
// are byte-identical and the daily workflow doesn't churn a diff.
const BARS = [
  { y: 26, w: 300, h: 34, c: "#FFB000", o: 0.85, dur: 11, delay: 0 },
  { y: 62, w: 190, h: 26, c: "#FF6B57", o: 0.7, dur: 14, delay: 1.5 },
  { y: 214, w: 260, h: 30, c: "#F90001", o: 0.75, dur: 12, delay: 0.8 },
  { y: 246, w: 340, h: 24, c: "#FF8A65", o: 0.6, dur: 16, delay: 2.2 },
  { y: 132, w: 120, h: 18, c: "#C2185B", o: 0.5, dur: 18, delay: 3.4 },
];

const bars = BARS.map((b) => {
  const from = -b.w;
  const to = W;
  return `<rect x="0" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="${b.c}" opacity="${b.o}">
    <animate attributeName="x" from="${from}" to="${to}" dur="${b.dur}s" begin="${b.delay}s" repeatCount="indefinite" />
  </rect>`;
}).join("");

// Centre the 24x24 glyph, scaled up.
const GLYPH = 140;
const s = GLYPH / 24;
const gx = W / 2 - GLYPH / 2;
const gy = H / 2 - GLYPH / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  <defs>
    <linearGradient id="pyBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117" />
      <stop offset="100%" stop-color="#1A060C" />
    </linearGradient>
    <filter id="pyGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <clipPath id="frame"><rect x="0" y="0" width="${W}" height="${H}" rx="14" /></clipPath>
    <style>
      .tag { fill:#FF6B57; font:700 12px "JetBrains Mono",ui-monospace,monospace; letter-spacing:3px; }
    </style>
  </defs>

  <g clip-path="url(#frame)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#pyBg)" />
    <g opacity="0.55">${bars}</g>

    <g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)}) scale(${s.toFixed(4)})" filter="url(#pyGlow)">
      <path d="${d}" fill="#F90001" />
    </g>

    <!-- bottom-right: the only strip the drifting bars never cross -->
    <text x="${W - 40}" y="${H - 28}" text-anchor="end" class="tag">// THE LANGUAGE I THINK IN</text>
  </g>
</svg>
`;

process.stdout.write(svg);

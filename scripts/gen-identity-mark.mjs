// The profile's identity mark: the GitHub Octocat inside a pulsing,
// colour-cycling halo.
//
// The glyph path comes from simple-icons (github.svg), which is released
// under CC0-1.0 — a public-domain dedication, so it is free to use and
// modify here without attribution strings attached.
//
//   node scripts/gen-identity-mark.mjs > assets/identity-mark.svg

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./assets/si-github.svg", import.meta.url), "utf8");

// simple-icons files are a single <path d="..."/> on a 24x24 viewBox.
const d = src.match(/<path\s+d="([^"]+)"/)?.[1];
if (!d) {
  console.error("could not find the glyph path in si-github.svg");
  process.exit(1);
}

const SIZE = 240;
const c = SIZE / 2;

// Scale the 24x24 glyph up and centre it inside the halo.
const GLYPH = 118;
const s = GLYPH / 24;
const gx = c - GLYPH / 2;
const gy = c - GLYPH / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="55%" stop-color="#F90001" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#F90001" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="disc" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#FF7A66" />
      <stop offset="55%" stop-color="#F90001" />
      <stop offset="100%" stop-color="#8E0F0C" />
    </radialGradient>
    <filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="3.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>

  <!-- outer breathing halo -->
  <circle cx="${c}" cy="${c}" r="104" fill="url(#halo)">
    <animate attributeName="r" values="94;108;94" dur="3s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.55;1;0.55" dur="3s" repeatCount="indefinite" />
  </circle>

  <!-- expanding ping ring -->
  <circle cx="${c}" cy="${c}" r="82" fill="none" stroke="#FF6B57" stroke-width="2">
    <animate attributeName="r" values="80;112;80" dur="3s" repeatCount="indefinite" />
    <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
  </circle>

  <!-- the disc the mark sits on -->
  <g filter="url(#bloom)">
    <circle cx="${c}" cy="${c}" r="80" fill="url(#disc)">
      <animate attributeName="r" values="77;83;77" dur="3s" repeatCount="indefinite" />
    </circle>
  </g>

  <!-- Octocat glyph (simple-icons, CC0-1.0) -->
  <g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)}) scale(${s.toFixed(4)})">
    <path d="${d}" fill="#0D1117" />
  </g>
</svg>
`;

process.stdout.write(svg);

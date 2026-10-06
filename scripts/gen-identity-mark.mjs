// The profile's identity mark, as a live object detector would see it: the
// Octocat on its red disc, a detection box that hunts and locks on, a
// confidence label, a scan line and a HUD. It says "computer vision" before
// a visitor reads a word.
//
// The SVG paints its own rounded dark tile, so GitHub's grey image-fallback
// box never shows around it. Octocat glyph: simple-icons (CC0-1.0).
//
//   node scripts/gen-identity-mark.mjs

import { writeFileSync } from "node:fs";
import { MONO } from "./lib/gh.mjs";
import { icon, glyph } from "./lib/icons.mjs";

const S = 320;
const c = S / 2;
const BOX = 96; // half-size of the locked detection box
const L = 26; // bracket arm length

const octo = icon("github").path;

let ticks = "";
for (let i = 0; i < 72; i++) {
  const a = (i / 72) * 2 * Math.PI;
  const r1 = 134, r2 = i % 6 === 0 ? 144 : 139;
  ticks += `<line x1="${(c + r1 * Math.cos(a)).toFixed(1)}" y1="${(c + r1 * Math.sin(a)).toFixed(1)}" x2="${(c + r2 * Math.cos(a)).toFixed(1)}" y2="${(c + r2 * Math.sin(a)).toFixed(1)}" stroke="#F90001" stroke-opacity="${i % 6 === 0 ? 0.7 : 0.3}" stroke-width="1.5" />`;
}

// Four L-shaped corner brackets around the box.
const lo = c - BOX, hi = c + BOX;
const brackets = [
  `M${lo} ${lo + L} V${lo} H${lo + L}`,
  `M${hi - L} ${lo} H${hi} V${lo + L}`,
  `M${hi} ${hi - L} V${hi} H${hi - L}`,
  `M${lo + L} ${hi} H${lo} V${hi - L}`,
].map((d) => `<path d="${d}" />`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#11161d" /><stop offset="100%" stop-color="#1c0a0e" />
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#F90001" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#F90001" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="disc" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#FF7A66" /><stop offset="55%" stop-color="#F90001" /><stop offset="100%" stop-color="#8E0F0C" />
    </radialGradient>
    <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFB000" stop-opacity="0" />
      <stop offset="80%" stop-color="#FFB000" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#FFE08A" stop-opacity="0.95" />
    </linearGradient>
    <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M16 0H0V16" fill="none" stroke="#F90001" stroke-opacity="0.07" />
    </pattern>
    <clipPath id="tileClip"><rect width="${S}" height="${S}" rx="28" /></clipPath>
    <clipPath id="boxClip"><rect x="${lo}" y="${lo}" width="${BOX * 2}" height="${BOX * 2}" /></clipPath>
    <filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="3.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <style>
    text { font-family: ${MONO}; font-weight: 700; }
    .hud  { fill:#FF8A7A; font-size:11px; letter-spacing:1.5px; }
    .dim  { fill:#7a4a46; font-size:11px; letter-spacing:1.5px; }
    .tag  { fill:#0D1117; font-size:12px; }
    /* detector cycle (4 s): hunt wide → lock on → hold → release */
    .lock { transform-box: view-box; transform-origin: ${c}px ${c}px; animation: lock 4s cubic-bezier(.3,.7,.2,1) infinite; }
    @keyframes lock {
      0%   { transform: scale(1.32) rotate(8deg); stroke:#FFF5F0; opacity:.25; }
      30%  { transform: scale(.97); stroke:#FFB000; opacity:1; }
      38%,88% { transform: scale(1); stroke:#F90001; opacity:1; }
      100% { transform: scale(1.32) rotate(8deg); stroke:#FFF5F0; opacity:.25; }
    }
    .label { animation: label 4s steps(1) infinite; }
    @keyframes label { 0%,37% { opacity:0; } 38%,88% { opacity:1; } 89%,100% { opacity:0; } }
    .sweep { animation: sweep 2s linear infinite; }
    @keyframes sweep { from { transform: translateY(0); } to { transform: translateY(${BOX * 2 + 40}px); } }
    .spin  { transform-box: view-box; transform-origin: ${c}px ${c}px; animation: spin 30s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .rec   { animation: rec 1.2s steps(1) infinite; }
    @keyframes rec { 50% { opacity:0; } }
    .breathe { transform-box: fill-box; transform-origin: center; animation: breathe 3s ease-in-out infinite; }
    @keyframes breathe { 0%,100% { transform: scale(.96); } 50% { transform: scale(1.03); } }
  </style>

  <g clip-path="url(#tileClip)">
    <rect width="${S}" height="${S}" fill="url(#tile)" />
    <rect width="${S}" height="${S}" fill="url(#grid)" />

    <g class="spin">${ticks}</g>
    <circle cx="${c}" cy="${c}" r="112" fill="url(#halo)" class="breathe" />

    <g filter="url(#bloom)"><circle cx="${c}" cy="${c}" r="74" fill="url(#disc)" class="breathe" /></g>
    <g transform="translate(${c} ${c})">${glyph(octo, 104, "#0D1117")}</g>

    <g clip-path="url(#boxClip)">
      <rect class="sweep" x="${lo}" y="${lo - 40}" width="${BOX * 2}" height="40" fill="url(#scan)" />
    </g>

    <g class="lock" fill="none" stroke-width="4" stroke-linecap="square">${brackets}</g>

    <g class="label">
      <rect x="${lo - 2}" y="${lo - 24}" width="134" height="20" fill="#F90001" />
      <text x="${lo + 5}" y="${lo - 9}" class="tag">ai_engineer 0.99</text>
    </g>

    <text x="16" y="24" class="hud">CV-01 ▸ TRACK</text>
    <g class="rec"><circle cx="${S - 52}" cy="20" r="4" fill="#F90001" /></g>
    <text x="${S - 16}" y="24" text-anchor="end" class="hud">REC</text>
    <text x="16" y="${S - 14}" class="dim">ID ParsaVictor</text>
    <text x="${S - 16}" y="${S - 14}" text-anchor="end" class="dim">60 FPS</text>
  </g>
  <rect x="0.75" y="0.75" width="${S - 1.5}" height="${S - 1.5}" rx="28" fill="none" stroke="#F90001" stroke-opacity="0.45" stroke-width="1.5" />
</svg>
`;

writeFileSync(new URL("../assets/identity-mark.svg", import.meta.url), svg, "utf8");
console.log("Wrote assets/identity-mark.svg");

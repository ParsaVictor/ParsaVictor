// Renders the About Me "class ParsaKarkooti" snippet as an editor window
// that types itself out line by line. A fenced code block can't be styled or
// positioned on GitHub; an SVG card can, and it scales cleanly on mobile.
//
//   node scripts/gen-code-card.mjs

import { writeFileSync } from "node:fs";

import { MONO, esc } from "./lib/gh.mjs";

// [kind, text] tokens per line. Kinds map to the palette below.
const L = [
  [["k", "class "], ["c", "ParsaKarkooti"], ["p", ":"]],
  [["a", "    role      "], ["p", "= "], ["s", '"AI Engineer"']],
  [["a", "    focus     "], ["p", "= ["], ["s", '"Computer Vision"'], ["p", ", "], ["s", '"Deep Learning"'], ["p", ","]],
  [["p", "                 "], ["s", '"Video Intelligence"'], ["p", "]"]],
  [["a", "    domains   "], ["p", "= ["], ["s", '"Industrial AI"'], ["p", ", "], ["s", '"Video Analytics"'], ["p", ","]],
  [["p", "                 "], ["s", '"Recommenders"'], ["p", ", "], ["s", '"Multimodal AI"'], ["p", "]"]],
  [["a", "    education "], ["p", "= "], ["s", '"B.Sc. Computer Eng. · Razi University"']],
  [["a", "    approach  "], ["p", "= "], ["s", '"problem → research → build → fast"']],
  [["a", "    open_to   "], ["p", "= ["], ["s", '"AI roles"'], ["p", ", "], ["s", '"Research"'], ["p", ", "], ["s", '"Open source"'], ["p", "]"]],
  [],
  [["k", "    def "], ["f", "say_hi"], ["p", "("], ["a", "self"], ["p", "):"]],
  [["k", "        return "], ["s", '"Let\'s build something that ships."']],
];

const COL = { k: "#FF6B57", c: "#FFB000", a: "#FFC2B8", p: "#8B949E", s: "#7EE787", f: "#79C0FF" };

const W = 900;
const FS = 19;
const CH = FS * 0.6; // monospace advance
const LH = 34;
const TOP = 92;
const GUT = 64;
const H = TOP + L.length * LH + 36;

let t = 0.6; // seconds — typing clock
const lines = L.map((tokens, i) => {
  const y = TOP + i * LH;
  const text = tokens.map(([, s]) => s).join("");
  const width = text.length * CH + 4;
  const dur = Math.max(0.12, text.length * 0.011);
  const start = t;
  t += dur + 0.05;
  const spans = tokens.map(([k, s]) => `<tspan fill="${COL[k]}">${esc(s)}</tspan>`).join("");
  return `
  <text x="${GUT - 22}" y="${y}" text-anchor="end" class="ln">${i + 1}</text>
  <text x="${GUT}" y="${y}" class="code" xml:space="preserve">${spans}</text>
  ${width > 4 ? `<rect class="cover" x="${GUT - 2}" y="${y - FS - 2}" width="${(width + 16).toFixed(1)}" height="${LH}" fill="#0F0A0C"
    style="animation: wipe${i} ${dur.toFixed(2)}s steps(${Math.max(1, text.length)}) ${start.toFixed(2)}s forwards" />
  <style>@keyframes wipe${i} { to { transform: translateX(${(width + 16).toFixed(1)}px); width: 0; } }</style>` : ""}`;
}).join("");

const lastY = TOP + (L.length - 1) * LH;
const lastW = L.at(-1).map(([, s]) => s).join("").length * CH;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1A0B0E" /><stop offset="100%" stop-color="#2A0A10" />
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F90001" stop-opacity="0.8" /><stop offset="100%" stop-color="#FFB000" stop-opacity="0.4" />
    </linearGradient>
  </defs>
  <style>
    text { font-family: ${MONO}; }
    .code { font-size:${FS}px; }
    .ln   { fill:#4a3033; font-size:${FS - 3}px; }
    .tab  { fill:#FFF5F0; font-size:15px; font-weight:700; }
    .path { fill:#8a5550; font-size:14px; }
    .caret { animation: blink 1s steps(1) infinite; animation-delay:${t.toFixed(2)}s; opacity:0; }
    @keyframes blink { 0% { opacity:1; } 50% { opacity:0; } }
  </style>

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="#0F0A0C" stroke="url(#edge)" stroke-width="1.5" />
  <path d="M1 17 a16 16 0 0 1 16 -16 H ${W - 17} a16 16 0 0 1 16 16 V 48 H 1 Z" fill="url(#bar)" />
  <circle cx="30" cy="25" r="7" fill="#FF5F57" />
  <circle cx="54" cy="25" r="7" fill="#FEBC2E" />
  <circle cx="78" cy="25" r="7" fill="#28C840" />
  <rect x="110" y="10" width="150" height="38" rx="8" fill="#0F0A0C" />
  <circle cx="128" cy="29" r="5" fill="#FFB000" />
  <text x="142" y="34" class="tab">parsa.py</text>
  <text x="${W - 24}" y="32" text-anchor="end" class="path">~/ParsaVictor · Python 3</text>
  <line x1="${GUT - 12}" y1="62" x2="${GUT - 12}" y2="${H - 20}" stroke="#2a1518" />
  ${lines}
  <rect class="caret" x="${(GUT + lastW + 4).toFixed(1)}" y="${lastY - FS + 1}" width="10" height="${FS + 4}" fill="#F90001" />
</svg>
`;

writeFileSync(new URL("../assets/about-code.svg", import.meta.url), svg, "utf8");
console.log("Wrote assets/about-code.svg");

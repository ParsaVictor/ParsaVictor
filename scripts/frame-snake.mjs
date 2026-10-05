// Wraps Platane/snk's snake into an arcade-cabinet card: green contribution
// "fruit", a glowing red→gold snake in the profile palette, a score readout
// and CRT scanlines. snk's own SVG (and its CSS animation) is embedded
// untouched as a nested <svg>; only its colours are restyled from outside.
//
//   node scripts/frame-snake.mjs dist/snake-green.svg dist/snake-arcade.svg

import { readFileSync, writeFileSync } from "node:fs";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: frame-snake.mjs <snk.svg> <out.svg>");
  process.exit(1);
}

const raw = readFileSync(src, "utf8");
const vb = raw.match(/viewBox="([^"]+)"/)[1];
const [, , vw, vh] = vb.split(/\s+/).map(Number);
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// Each cell snk animates (`class="c cX"`) is a day with contributions — the
// fruit the snake eats over one loop.
const eaten = (raw.match(/class="c c[0-9a-z]+"/g) || []).length;

const W = 900;
const GX = 20, GY = 104;
const GW = W - 40;
const GH = (GW * vh) / vw;
const H = Math.round(GY + GH + 54);
const MONO = `"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117" /><stop offset="70%" stop-color="#0B1410" /><stop offset="100%" stop-color="#1A0A0D" />
    </linearGradient>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB000" /><stop offset="100%" stop-color="#F90001" />
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#39D353" /><stop offset="50%" stop-color="#F90001" /><stop offset="100%" stop-color="#FFB000" />
    </linearGradient>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1.4" fill="#000" opacity="0.35" />
    </pattern>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="#000" stop-opacity="0" /><stop offset="100%" stop-color="#000" stop-opacity="0.55" />
    </radialGradient>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.4" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <style>
    text { font-family: ${MONO}; }
    .kicker { fill:#39D353; font-size:15px; font-weight:700; letter-spacing:4px; }
    .title  { fill:#FFF5F0; font-size:30px; font-weight:800; }
    .hudL   { fill:#7d8b84; font-size:13px; font-weight:700; letter-spacing:3px; }
    .hudV   { fill:#39D353; font-size:28px; font-weight:800; }
    .foot   { fill:#7d8b84; font-size:14px; letter-spacing:2px; }
    .blink  { animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity:0; } }
    /* restyle snk from outside: neon fruit, glowing gradient snake */
    .s { fill:url(#sg) !important; filter:url(#glow); }
    .c { rx:3px; ry:3px; }
    .u { fill:#39D353 !important; opacity:.55; }
    .flick { animation: flick 5s infinite; }
    @keyframes flick { 0%,96%,100% { opacity:1; } 97% { opacity:.82; } 98% { opacity:1; } 99% { opacity:.9; } }
  </style>

  <rect width="${W}" height="${H}" rx="18" fill="url(#bg)" />
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="18" fill="none" stroke="url(#edge)" stroke-width="1.5" stroke-opacity="0.7" />

  <text x="40" y="50" class="kicker">// CONTRIBUTION SNAKE</text>
  <text x="40" y="86" class="title">ParsaVictor<tspan fill="#39D353">.exe</tspan></text>

  <text x="${W - 220}" y="44" class="hudL">SCORE</text>
  <text x="${W - 220}" y="78" class="hudV">${String(eaten).padStart(4, "0")}</text>
  <text x="${W - 110}" y="44" class="hudL">LEVEL</text>
  <text x="${W - 110}" y="78" class="hudV" fill="#FFB000" style="fill:#FFB000">${new Date().getUTCFullYear()}</text>

  <g class="flick">
    <svg x="${GX}" y="${GY}" width="${GW}" height="${GH.toFixed(1)}" viewBox="${vb}">${inner}</svg>
  </g>

  <text x="40" y="${H - 22}" class="foot"><tspan class="blink" fill="#F90001">▶</tspan> PLAYING · every green block is a day I shipped code</text>
  <text x="${W - 40}" y="${H - 22}" text-anchor="end" class="foot">1UP</text>

  <rect width="${W}" height="${H}" rx="18" fill="url(#scan)" pointer-events="none" />
  <rect width="${W}" height="${H}" rx="18" fill="url(#vig)" pointer-events="none" />
</svg>
`;

writeFileSync(dest, svg, "utf8");
console.log(`Framed snake → ${dest} (${eaten} days of fruit)`);

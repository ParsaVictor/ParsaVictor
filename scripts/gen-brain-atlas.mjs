// Neural Skill Atlas — anatomical brain edition.
//
// The brain anatomy comes from Wikimedia Commons' "Human-brain.SVG"
// (Brain_Surface_Gyri.SVG by James.mcd.nz, derivative work by Hguiney),
// licensed CC-BY-SA-3.0 — so it is genuinely reusable here as long as we
// attribute it and keep the same licence, which the README badge does.
// This script recolours those 200 anatomical paths into the profile's
// red/black neon palette and lays Parsa's REAL skill groups around them.
//
// Regenerate with:  node gen-brain-atlas.mjs > neural-skill-atlas.svg

import { readFileSync } from "node:fs";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ── 1. Load + recolour the anatomical brain ───────────────────── */

const raw = readFileSync(new URL("./assets/wiki-brain.svg", import.meta.url), "utf8");

// Pull just the drawable body out of the source file (drop its <svg> shell,
// XML prolog, metadata and <defs> — we supply our own).
let body = raw
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
  .replace(/<defs[\s\S]*?<\/defs>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "");

// The source is drawn in anatomical beiges over white. Map every one of its
// colours onto the neon-red palette. Order matters: longest/most specific
// first so a shorter hex never eats a longer one.
const COLOUR_MAP = [
  ["#ffffff", "#1a0508"], // page white  -> near-black tissue
  ["#fff0cd", "#3d0a10"], // lightest tissue
  ["#fdd99b", "#5c0f16"], // mid tissue
  ["#d9bb7a", "#7d141d"], // darker tissue
  ["#816647", "#FF6B57"], // outline brown -> warm neon
  ["#000000", "#F90001"], // black stroke  -> brand red
];
for (const [from, to] of COLOUR_MAP) {
  body = body.replaceAll(from, to);
  body = body.replaceAll(from.toUpperCase(), to);
}

/* ── 2. Parsa's real skill groups, mapped onto brain regions ───── */

const W = 1200;
const H = 760;

// Brain source is 1024x731; place it centred and scaled. Kept small enough
// that the six lobe cards sit clear of it instead of overlapping the gyri.
const BRAIN_SCALE = 0.5;
const BRAIN_W = 1024 * BRAIN_SCALE;
const BRAIN_H = 731 * BRAIN_SCALE;
const BRAIN_X = (W - BRAIN_W) / 2;
const BRAIN_Y = 128;

// Only real skills that already appear in the profile — nothing invented.
const LOBES = [
  {
    region: "FRONTAL · LOBE",
    icon: "👁",
    title: "Computer Vision",
    skills: "OpenCV · YOLOv8/v11 · CLIP · InsightFace",
    accent: "#F90001",
    x: 18,
    y: 214,
    anchor: "start",
    tie: [406, 330],
  },
  {
    region: "PARIETAL · LOBE",
    icon: "🧠",
    title: "Deep Learning",
    skills: "PyTorch · TensorFlow · Transformers · VideoMAE",
    accent: "#FF6B57",
    x: W / 2 - 168,
    y: 106,
    anchor: "middle",
    tie: [600, 268],
    wide: true,
  },
  {
    region: "OCCIPITAL · LOBE",
    icon: "📊",
    title: "ML & Data",
    skills: "scikit-learn · XGBoost · LightGBM · Pandas",
    accent: "#FFB000",
    x: W - 18 - 330,
    y: 214,
    anchor: "end",
    tie: [794, 330],
  },
  {
    region: "TEMPORAL · LOBE",
    icon: "⚙",
    title: "Systems & Deploy",
    skills: "Docker · FastAPI · VRAM-safe · Real-time",
    accent: "#FF3B30",
    x: W - 18 - 330,
    y: 452,
    anchor: "end",
    tie: [782, 452],
  },
  {
    region: "BRAINSTEM",
    icon: "🛠",
    title: "Tooling & Practice",
    skills: "Git · Linux · SQL · CI/CD · Reproducible runs",
    accent: "#C2185B",
    x: 18,
    y: 452,
    anchor: "start",
    tie: [418, 452],
  },
  {
    region: "CEREBELLUM",
    icon: "💻",
    title: "Languages",
    skills: "Python · C++ · Java · SQL",
    accent: "#FF8A65",
    x: W / 2 - 168,
    y: 612,
    anchor: "middle",
    tie: [600, 528],
    wide: true,
  },
];

const CARD_W = 330;
const CARD_H = 88;

let cards = "";
let ties = "";

LOBES.forEach((l, i) => {
  const w = l.wide ? 336 : CARD_W;
  const cxCard = l.x + w / 2;
  const cyCard = l.y + CARD_H / 2;
  const [tx, ty] = l.tie;

  // dotted connector from card edge toward the brain
  ties += `<line x1="${cxCard.toFixed(0)}" y1="${cyCard.toFixed(0)}" x2="${tx}" y2="${ty}" class="tie">
    <animate attributeName="stroke-dashoffset" from="12" to="0" dur="${(2 + i * 0.25).toFixed(2)}s" repeatCount="indefinite" />
  </line>`;

  cards += `
  <g>
    <rect x="${l.x}" y="${l.y}" width="${w}" height="${CARD_H}" rx="10"
          fill="#12060a" fill-opacity="0.92" stroke="${l.accent}" stroke-opacity="0.55" stroke-width="1.2" />
    <rect x="${l.x}" y="${l.y}" width="4" height="${CARD_H}" rx="2" fill="${l.accent}">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="${(2.4 + i * 0.3).toFixed(2)}s" repeatCount="indefinite" />
    </rect>
    <text x="${l.x + 18}" y="${l.y + 22}" class="region" fill="${l.accent}">${esc(l.region)}</text>
    <text x="${l.x + 18}" y="${l.y + 47}" class="lobe-title">${esc(l.icon)} ${esc(l.title)}</text>
    <text x="${l.x + 18}" y="${l.y + 70}" class="lobe-skills">${esc(l.skills)}</text>
  </g>`;
});

/* ── 3. Synapse sparks scattered over the brain ────────────────── */

// Fixed positions (no RNG) so the file is byte-stable between rebuilds.
// Coordinates sit inside the brain's drawn area for BRAIN_SCALE 0.5,
// i.e. roughly x 400–800, y 200–450.
const SPARKS = [
  [452, 300, "#FFB000"], [540, 262, "#FF6B57"], [648, 296, "#F90001"],
  [506, 356, "#FF3B30"], [712, 336, "#FFB000"], [420, 356, "#FF8A65"],
  [604, 392, "#FF6B57"], [578, 316, "#FFFFFF"],
];
const sparks = SPARKS.map(([x, y, c], i) =>
  `<circle cx="${x}" cy="${y}" r="3.5" fill="${c}" filter="url(#spark)">
     <animate attributeName="opacity" values="0.15;1;0.15" dur="${(1.6 + i * 0.35).toFixed(2)}s" repeatCount="indefinite" />
     <animate attributeName="r" values="2.5;5;2.5" dur="${(1.6 + i * 0.35).toFixed(2)}s" repeatCount="indefinite" />
   </circle>`
).join("");

/* ── 4. Compose ────────────────────────────────────────────────── */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  <defs>
    <radialGradient id="atlasBg" cx="50%" cy="45%" r="72%">
      <stop offset="0%" stop-color="#2B0A12" />
      <stop offset="60%" stop-color="#14060B" />
      <stop offset="100%" stop-color="#0D1117" />
    </radialGradient>
    <radialGradient id="brainHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F90001" stop-opacity="0.35" />
      <stop offset="70%" stop-color="#F90001" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#F90001" stop-opacity="0" />
    </radialGradient>
    <filter id="neon" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="4.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="spark" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="2.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <style>
      .kicker   { fill: #FF6B57; font: 700 11px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 4px; }
      .headline { fill: #FFF5F0; font: 800 30px "JetBrains Mono", ui-monospace, monospace; }
      .region   { font: 700 10px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 2.2px; }
      .lobe-title  { fill: #FFF5F0; font: 700 16px "JetBrains Mono", ui-monospace, monospace; }
      .lobe-skills { fill: #C99; font: 400 11px "JetBrains Mono", ui-monospace, monospace; }
      .tie      { stroke: #F90001; stroke-opacity: 0.3; stroke-width: 1; stroke-dasharray: 3 4; }
      .credit   { fill: #7a3b34; font: 400 10px "JetBrains Mono", ui-monospace, monospace; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#atlasBg)" />

  <text x="${W / 2}" y="44" text-anchor="middle" class="kicker">▸ NEURAL · SKILL · ATLAS ◂</text>
  <text x="${W / 2}" y="80" text-anchor="middle" class="headline">Parsa's Skill Brain</text>

  <ellipse cx="${W / 2}" cy="${BRAIN_Y + BRAIN_H / 2}" rx="${BRAIN_W * 0.46}" ry="${BRAIN_H * 0.44}" fill="url(#brainHalo)">
    <animate attributeName="opacity" values="0.55;1;0.55" dur="4s" repeatCount="indefinite" />
  </ellipse>

  <g>${ties}</g>

  <g transform="translate(${BRAIN_X.toFixed(1)} ${BRAIN_Y}) scale(${BRAIN_SCALE})" filter="url(#neon)" opacity="0.92">
    <animateTransform attributeName="transform" type="scale"
      additive="sum" values="1 1;1.012 1.012;1 1" dur="4s" repeatCount="indefinite" />
    ${body}
  </g>

  <g>${sparks}</g>

  ${cards}

  <text x="${W / 2}" y="${H - 14}" text-anchor="middle" class="credit">brain anatomy: James.mcd.nz / Hguiney — Wikimedia Commons, CC BY-SA 3.0</text>
</svg>
`;

console.log(svg);

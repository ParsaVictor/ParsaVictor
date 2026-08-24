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

/* ── 1b. EEG waveform helper ───────────────────────────────────── */

// One level "beat" of an EEG-like trace, 120px wide, net dy 0 so copies tile
// seamlessly. Scrolling a tiled copy under a clip gives an endless live
// readout with no scripting — SMIL only, which GitHub renders.
const EEG_BEAT =
  "l 12,0 l 6,-4 l 6,8 l 6,-6 l 8,2 l 10,0 l 5,-14 l 4,26 l 5,-18 " +
  "l 6,6 l 8,0 l 7,-3 l 5,5 l 6,-2 l 12,0 l 9,-5 l 5,5";
const EEG_PERIOD = 120;

let clipSeq = 0;
let extraDefs = "";

function eegStrip({ x, y, w, h, colour, dur, amp = 0.5, opacity = 0.85, sw = 1.4 }) {
  const id = `eeg${clipSeq++}`;
  extraDefs += `<clipPath id="${id}"><rect x="0" y="0" width="${w}" height="${h}" rx="3" /></clipPath>`;
  const reps = Math.ceil(w / EEG_PERIOD) + 2;
  const d = `M 0,0 ` + Array.from({ length: reps }, () => EEG_BEAT).join(" ");
  return `<g transform="translate(${x} ${y})" clip-path="url(#${id})">
      <g transform="translate(0 ${(h / 2).toFixed(1)}) scale(1 ${amp})">
        <path d="${d}" fill="none" stroke="${colour}" stroke-opacity="${opacity}"
              stroke-width="${(sw / amp).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">
          <animateTransform attributeName="transform" type="translate"
            from="0 0" to="-${EEG_PERIOD} 0" dur="${dur}s" repeatCount="indefinite" />
        </path>
      </g>
    </g>`;
}

/* ── 2. Parsa's real skill groups, mapped onto brain regions ───── */

const W = 1200;
const H = 800;

// Brain source is 1024x731; place it centred and scaled. Kept small enough
// that the six lobe cards sit clear of it instead of overlapping the gyri.
const BRAIN_SCALE = 0.5;
const BRAIN_W = 1024 * BRAIN_SCALE;
const BRAIN_H = 731 * BRAIN_SCALE;
const BRAIN_X = (W - BRAIN_W) / 2;
const BRAIN_Y = 128;

// Only real skills that already appear in the profile — nothing invented.
// `tie` is where the connector meets the brain: keep every one of these
// inside the drawn anatomy, or the travelling signal appears to float.
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
    tie: [770, 428],
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
    tie: [430, 428],
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
    tie: [600, 452],
    wide: true,
  },
];

const CARD_W = 330;
const CARD_H = 88;

let cards = "";
let ties = "";
let tiePulses = "";

LOBES.forEach((l, i) => {
  const w = l.wide ? 336 : CARD_W;
  const cxCard = l.x + w / 2;
  const cyCard = l.y + CARD_H / 2;
  const [tx, ty] = l.tie;
  const travel = (2.6 + i * 0.22).toFixed(2);
  const back = (i * 0.35 + Number(travel) / 2).toFixed(2);

  // dotted connector from card edge toward the brain, in the lobe's own colour
  ties += `<line x1="${cxCard.toFixed(0)}" y1="${cyCard.toFixed(0)}" x2="${tx}" y2="${ty}"
        class="tie" stroke="${l.accent}">
    <animate attributeName="stroke-dashoffset" from="12" to="0" dur="${(2 + i * 0.25).toFixed(2)}s" repeatCount="indefinite" />
    <animate attributeName="stroke-opacity" values="0.3;0.7;0.3" dur="${(3.6 + i * 0.4).toFixed(2)}s" repeatCount="indefinite" />
  </line>`;

  // a signal leaving the brain and arriving at the skill, plus a fainter
  // acknowledgement travelling back — the pair is what sells "alive".
  tiePulses += `
  <circle r="3.6" fill="${l.accent}" filter="url(#spark)" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.8;1"
             dur="${travel}s" begin="${(i * 0.35).toFixed(2)}s" repeatCount="indefinite" />
    <animateMotion dur="${travel}s" begin="${(i * 0.35).toFixed(2)}s" repeatCount="indefinite"
                   path="M ${tx},${ty} L ${cxCard.toFixed(0)},${cyCard.toFixed(0)}" />
  </circle>
  <circle r="2" fill="#FFF5F0" opacity="0">
    <animate attributeName="opacity" values="0;0.55;0" dur="${travel}s"
             begin="${back}s" repeatCount="indefinite" />
    <animateMotion dur="${travel}s" begin="${back}s" repeatCount="indefinite"
                   path="M ${cxCard.toFixed(0)},${cyCard.toFixed(0)} L ${tx},${ty}" />
  </circle>`;

  // live mini-readout in the card's top-right corner
  const strip = eegStrip({
    x: l.x + w - 18 - 92,
    y: l.y + 13,
    w: 92,
    h: 24,
    colour: l.accent,
    dur: (3.4 + i * 0.45).toFixed(2),
    amp: 0.42,
    opacity: 0.8,
    sw: 1.2,
  });

  cards += `
  <g>
    <rect x="${l.x}" y="${l.y}" width="${w}" height="${CARD_H}" rx="10"
          fill="#12060a" fill-opacity="0.92" stroke="${l.accent}" stroke-opacity="0.55" stroke-width="1.2">
      <animate attributeName="stroke-opacity" values="0.35;0.85;0.35"
               dur="${(3.6 + i * 0.4).toFixed(2)}s" repeatCount="indefinite" />
    </rect>
    <rect x="${l.x}" y="${l.y}" width="4" height="${CARD_H}" rx="2" fill="${l.accent}">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="${(2.4 + i * 0.3).toFixed(2)}s" repeatCount="indefinite" />
    </rect>
    ${strip}
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

// The order a signal walks the cortex. Firing the neurons in this sequence —
// rather than at independent phases — is what makes it read as one thought
// propagating instead of eight unrelated blinkers.
const CHAIN = [5, 0, 1, 7, 3, 6, 2, 4];
const CHAIN_STEP = 0.28;
const CHAIN_PERIOD = (CHAIN.length * CHAIN_STEP).toFixed(2);

const sparks = SPARKS.map(([x, y, c], i) => {
  const begin = (CHAIN.indexOf(i) * CHAIN_STEP).toFixed(2);
  return `<g>
     <circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${c}" stroke-width="1.3">
       <animate attributeName="r" values="3;24" dur="${CHAIN_PERIOD}s" begin="${begin}s" repeatCount="indefinite" />
       <animate attributeName="stroke-opacity" values="0.9;0" dur="${CHAIN_PERIOD}s" begin="${begin}s" repeatCount="indefinite" />
     </circle>
     <circle cx="${x}" cy="${y}" r="3.5" fill="${c}" filter="url(#spark)">
       <animate attributeName="opacity" values="0.2;1;0.2" dur="${CHAIN_PERIOD}s" begin="${begin}s" repeatCount="indefinite" />
       <animate attributeName="r" values="2.4;6;2.4" dur="${CHAIN_PERIOD}s" begin="${begin}s" repeatCount="indefinite" />
     </circle>
   </g>`;
}).join("");

// Axons between consecutive neurons in the chain. `pathLength="100"` lets a
// short dash travel the whole curve without measuring its real length.
const axons = CHAIN.slice(0, -1).map((from, step) => {
  const to = CHAIN[step + 1];
  const [x1, y1] = SPARKS[from];
  const [x2, y2] = SPARKS[to];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + (step % 2 ? 26 : -26);
  return `<path d="M ${x1},${y1} Q ${mx.toFixed(0)},${my.toFixed(0)} ${x2},${y2}"
        pathLength="100" fill="none" stroke="${SPARKS[to][2]}" stroke-width="1.6"
        stroke-opacity="0.75" stroke-linecap="round" stroke-dasharray="14 86">
     <animate attributeName="stroke-dashoffset" from="100" to="0"
              dur="${CHAIN_PERIOD}s" begin="${(step * CHAIN_STEP).toFixed(2)}s" repeatCount="indefinite" />
   </path>`;
}).join("");

/* ── 4. Compose ────────────────────────────────────────────────── */

const BCX = W / 2;
const BCY = BRAIN_Y + BRAIN_H / 2;
const HALO_RX = BRAIN_W * 0.46;
const HALO_RY = BRAIN_H * 0.44;

// Build these before serialising `extraDefs` below — eegStrip appends to it.
const headerEeg = eegStrip({
  x: 18, y: 26, w: 170, h: 26,
  colour: "#FF6B57", dur: "4.2", amp: 0.45, opacity: 0.7, sw: 1.2,
});
const footerEeg = eegStrip({
  x: 18, y: 726, w: W - 36, h: 30,
  colour: "#F90001", dur: "9", amp: 0.72, opacity: 0.55, sw: 1.5,
});

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
    <radialGradient id="brainCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF6B57" stop-opacity="0.42" />
      <stop offset="100%" stop-color="#FF6B57" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFB000" stop-opacity="0" />
      <stop offset="50%" stop-color="#FFD9A0" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#FFB000" stop-opacity="0" />
    </linearGradient>
    <clipPath id="brainClip">
      <ellipse cx="${BCX}" cy="${BCY}" rx="${HALO_RX.toFixed(1)}" ry="${HALO_RY.toFixed(1)}" />
    </clipPath>
    <filter id="neon" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="4.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="spark" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="2.5" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    ${extraDefs}
    <style>
      .kicker   { fill: #FF6B57; font: 700 11px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 4px; }
      .headline { fill: #FFF5F0; font: 800 30px "JetBrains Mono", ui-monospace, monospace; }
      .region   { font: 700 10px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 2.2px; }
      .lobe-title  { fill: #FFF5F0; font: 700 16px "JetBrains Mono", ui-monospace, monospace; }
      .lobe-skills { fill: #C99; font: 400 11px "JetBrains Mono", ui-monospace, monospace; }
      .tie      { stroke-opacity: 0.45; stroke-width: 1.3; stroke-dasharray: 3 5; }
      .credit   { fill: #7a3b34; font: 400 10px "JetBrains Mono", ui-monospace, monospace; }
      .hud      { fill: #FF6B57; font: 700 9px "JetBrains Mono", ui-monospace, monospace; letter-spacing: 2px; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#atlasBg)" />

  <!-- slow scan rings: depth, and a reason for the eye to keep moving -->
  <g fill="none" stroke="#F90001" stroke-opacity="0.09" stroke-dasharray="2 10">
    <circle cx="${BCX}" cy="${BCY}" r="204">
      <animateTransform attributeName="transform" type="rotate"
        from="0 ${BCX} ${BCY}" to="360 ${BCX} ${BCY}" dur="64s" repeatCount="indefinite" />
    </circle>
    <circle cx="${BCX}" cy="${BCY}" r="252">
      <animateTransform attributeName="transform" type="rotate"
        from="360 ${BCX} ${BCY}" to="0 ${BCX} ${BCY}" dur="96s" repeatCount="indefinite" />
    </circle>
  </g>

  <ellipse cx="${BCX}" cy="${BCY}" rx="${HALO_RX.toFixed(1)}" ry="${HALO_RY.toFixed(1)}" fill="url(#brainHalo)">
    <animate attributeName="opacity" values="0.55;1;0.55" dur="4s" repeatCount="indefinite" />
  </ellipse>
  <ellipse cx="${BCX}" cy="${BCY}" rx="${(HALO_RX * 0.62).toFixed(1)}" ry="${(HALO_RY * 0.62).toFixed(1)}" fill="url(#brainCore)">
    <animate attributeName="opacity" values="0.9;0.35;0.9" dur="4s" repeatCount="indefinite" />
  </ellipse>

  <g>${ties}</g>

  <g transform="translate(${BRAIN_X.toFixed(1)} ${BRAIN_Y}) scale(${BRAIN_SCALE})" filter="url(#neon)" opacity="0.92">
    <animateTransform attributeName="transform" type="scale"
      additive="sum" values="1 1;1.012 1.012;1 1" dur="4s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.86;1;0.86" dur="4s" repeatCount="indefinite" />
    ${body}
  </g>

  <!-- imaging sweep, clipped to the brain so it reads as a live scan -->
  <g clip-path="url(#brainClip)">
    <rect x="0" y="${(BCY - HALO_RY).toFixed(0)}" width="90" height="${(HALO_RY * 2).toFixed(0)}"
          fill="url(#sweep)" opacity="0.55">
      <animate attributeName="x" values="${(BCX - HALO_RX - 90).toFixed(0)};${(BCX + HALO_RX).toFixed(0)}"
               dur="5.5s" repeatCount="indefinite" />
    </rect>
  </g>

  <g>${axons}</g>
  <g>${sparks}</g>
  <g>${tiePulses}</g>

  ${cards}

  ${headerEeg}
  <text x="${W / 2}" y="44" text-anchor="middle" class="kicker">▸ NEURAL · SKILL · ATLAS ◂</text>
  <text x="${W / 2}" y="80" text-anchor="middle" class="headline">Parsa's Skill Brain</text>

  <g>
    <rect x="${W - 18 - 170}" y="26" width="170" height="26" rx="13"
          fill="#12060a" fill-opacity="0.9" stroke="#F90001" stroke-opacity="0.5" />
    <circle cx="${W - 18 - 152}" cy="39" r="3.5" fill="#F90001">
      <animate attributeName="opacity" values="1;0.15;1" dur="1.4s" repeatCount="indefinite" />
    </circle>
    <text x="${W - 18 - 140}" y="43" class="hud">6 REGIONS · LIVE</text>
  </g>

  <text x="18" y="716" class="hud" fill="#7a3b34">CONTINUOUS · LEARNING · SIGNAL</text>
  ${footerEeg}

  <text x="${W / 2}" y="${H - 14}" text-anchor="middle" class="credit">brain anatomy: James.mcd.nz / Hguiney — Wikimedia Commons, CC BY-SA 3.0</text>
</svg>
`;

console.log(svg);

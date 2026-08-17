// Builds the contribution skyline: an isometric city of the year's real
// contribution calendar, under a starfield and aurora.
//
// Every number in the output comes from GitHub's GraphQL contributionCalendar
// for the current year — nothing is padded or invented. If a day had no
// contributions, its tile stays flat, which is the honest picture.
//
//   GITHUB_TOKEN=... node scripts/gen-skyline.mjs > assets/skyline.svg

import { writeFileSync } from "node:fs";

const USERNAME = process.env.SKYLINE_USER || "ParsaVictor";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("GITHUB_TOKEN is not set");
  process.exit(1);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── real data ─────────────────────────────────────────────────── */

// A rolling 365-day window rather than Jan-1-to-today: it is the full
// picture GitHub itself shows on a profile, and it keeps the plate
// representative instead of mostly-empty every January.
const now = new Date();
const YEAR = now.getUTCFullYear();
const to = now.toISOString();
const from = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000).toISOString();

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `query($login:String!,$from:DateTime!,$to:DateTime!){
      user(login:$login){ contributionsCollection(from:$from,to:$to){
        contributionCalendar{ totalContributions
          weeks{ contributionDays{ date contributionCount weekday } } } } }
    }`,
    variables: { login: USERNAME, from, to },
  }),
});
const json = await res.json();
if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);

const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks;
const days = weeks.flatMap((w) => w.contributionDays);
const counts = days.map((d) => d.contributionCount);

const total = cal.totalContributions;
const peak = counts.length ? Math.max(...counts) : 0;
const activeDays = counts.filter((c) => c > 0).length;
const dailyAvg = activeDays ? (total / activeDays).toFixed(1) : "0";

/* ── canvas + isometric projection ─────────────────────────────── */

const W = 1200;
const H = 760;

const COLS = weeks.length;
const ROWS = 7;
const MAX_BAR = 132; // tallest bar in px, mapped from `peak`

// Area the plate must fit inside (leaves room for the header and the
// footer stats). Tile size is derived from this rather than hardcoded, so
// the plate stays inside the frame no matter how many weeks the year has —
// a hardcoded tile size ran the city straight off the bottom-right corner.
const PAD_X = 70;
const BOX_W = W - PAD_X * 2;
const BOX_TOP = 205;
const BOX_BOTTOM = H - 96;

// In a 2:1 isometric the diamond spans (COLS-1)+(ROWS-1) steps on each
// axis, so solve for the half-tile size that fits both dimensions.
const stepsX = COLS - 1 + (ROWS - 1);
const stepsY = COLS - 1 + (ROWS - 1);
const TILE_W = Math.min(BOX_W / stepsX, ((BOX_BOTTOM - BOX_TOP - MAX_BAR) / stepsY) * 2);
const TILE_H = TILE_W / 2;

// Project into an unshifted space first, measure the real bounding box of
// every tile corner, then translate so the plate is actually centred.
// Deriving the offset instead of guessing it is what stopped the city
// hanging off the edge of the frame.
const rawProject = (col, row) => [(col - row) * TILE_W, (col + row) * TILE_H];

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let col = 0; col < COLS; col++) {
  for (let row = 0; row < ROWS; row++) {
    const [x, y] = rawProject(col, row);
    minX = Math.min(minX, x - TILE_W);
    maxX = Math.max(maxX, x + TILE_W);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + TILE_H * 2);
  }
}
const offsetX = (W - (maxX - minX)) / 2 - minX;
const offsetY = BOX_TOP + MAX_BAR + ((BOX_BOTTOM - BOX_TOP - MAX_BAR) - (maxY - minY)) / 2 - minY;

const project = (col, row) => {
  const [x, y] = rawProject(col, row);
  return [x + offsetX, y + offsetY];
};

const heightFor = (c) => (peak > 0 && c > 0 ? Math.max(6, (c / peak) * MAX_BAR) : 0);

/* ── deterministic starfield (no RNG — must be byte-stable) ────── */

// Small LCG seeded on a constant so repeated builds produce identical files
// and the daily workflow doesn't churn a diff when nothing changed.
let seed = 20260818;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

let stars = "";
for (let i = 0; i < 140; i++) {
  const x = (rnd() * W).toFixed(1);
  const y = (rnd() * 420).toFixed(1);
  const r = (rnd() * 1.4 + 0.3).toFixed(2);
  const o = (rnd() * 0.6 + 0.25).toFixed(2);
  const dur = (rnd() * 3 + 2).toFixed(2);
  stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}">
    <animate attributeName="opacity" values="${o};${(Number(o) * 0.25).toFixed(2)};${o}" dur="${dur}s" repeatCount="indefinite" />
  </circle>`;
}

/* ── the city ──────────────────────────────────────────────────── */

// Painter's algorithm: draw far tiles first so near ones overlap correctly.
const cells = [];
weeks.forEach((wk, col) => {
  wk.contributionDays.forEach((d) => {
    cells.push({ col, row: d.weekday, count: d.contributionCount, date: d.date });
  });
});
cells.sort((a, b) => a.col + a.row - (b.col + b.row));

let ground = "";
let towers = "";

for (const c of cells) {
  const [x, y] = project(c.col, c.row);
  const h = heightFor(c.count);

  // ground tile (the plot this building stands on)
  ground += `<path d="M ${x} ${y} L ${x + TILE_W} ${y + TILE_H} L ${x} ${y + TILE_H * 2} L ${x - TILE_W} ${y + TILE_H} Z"
    fill="#2a0d13" fill-opacity="0.85" stroke="#F90001" stroke-opacity="0.28" stroke-width="0.6" />`;

  if (h <= 0) continue;

  // brighter as the day was busier
  const t = c.count / peak;
  const topC = t > 0.66 ? "#FF9A8A" : t > 0.33 ? "#FF6B57" : "#E03A2F";
  const leftC = t > 0.66 ? "#C41A16" : t > 0.33 ? "#A81410" : "#7d141d";
  const rightC = t > 0.66 ? "#8E0F0C" : t > 0.33 ? "#7A0C0A" : "#5c0f16";

  const ty = y - h;
  towers += `<g>
    <path d="M ${x} ${ty} L ${x + TILE_W} ${ty + TILE_H} L ${x} ${ty + TILE_H * 2} L ${x - TILE_W} ${ty + TILE_H} Z" fill="${topC}" />
    <path d="M ${x - TILE_W} ${ty + TILE_H} L ${x} ${ty + TILE_H * 2} L ${x} ${y + TILE_H * 2} L ${x - TILE_W} ${y + TILE_H} Z" fill="${leftC}" />
    <path d="M ${x + TILE_W} ${ty + TILE_H} L ${x} ${ty + TILE_H * 2} L ${x} ${y + TILE_H * 2} L ${x + TILE_W} ${y + TILE_H} Z" fill="${rightC}" />
    <title>${esc(c.date)}: ${c.count} contribution${c.count === 1 ? "" : "s"}</title>
  </g>`;
}

/* ── compose ───────────────────────────────────────────────────── */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0D1117" />
      <stop offset="55%" stop-color="#1A060C" />
      <stop offset="100%" stop-color="#2B0A12" />
    </linearGradient>
    <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F90001" stop-opacity="0" />
      <stop offset="35%" stop-color="#FF3B30" stop-opacity="0.30" />
      <stop offset="60%" stop-color="#C2185B" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#FFB000" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE9C4" />
      <stop offset="70%" stop-color="#FFC773" />
      <stop offset="100%" stop-color="#FFB000" stop-opacity="0.15" />
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
    <style>
      .kicker { fill:#FF6B57; font:700 12px "JetBrains Mono",ui-monospace,monospace; letter-spacing:3px; }
      .who    { fill:#FFF5F0; font:800 34px "JetBrains Mono",ui-monospace,monospace; }
      .meta   { fill:#FFC2B8; font:400 14px "JetBrains Mono",ui-monospace,monospace; }
      .metaN  { fill:#FF6B57; font:700 14px "JetBrains Mono",ui-monospace,monospace; }
      .year   { fill:#FFFFFF; font:800 108px "JetBrains Mono",ui-monospace,monospace; opacity:0.05; }
      .statL  { fill:#8a4a44; font:700 10px "JetBrains Mono",ui-monospace,monospace; letter-spacing:2px; }
      .statV  { fill:#FF6B57; font:800 22px "JetBrains Mono",ui-monospace,monospace; }
      .src    { fill:#6d3b36; font:400 11px "JetBrains Mono",ui-monospace,monospace; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#sky)" />

  <g>${stars}</g>

  <ellipse cx="${W * 0.42}" cy="188" rx="430" ry="46" fill="url(#aurora)" filter="url(#soft)">
    <animate attributeName="opacity" values="0.55;1;0.55" dur="7s" repeatCount="indefinite" />
  </ellipse>

  <circle cx="${W - 150}" cy="128" r="34" fill="url(#moon)">
    <animate attributeName="opacity" values="0.85;1;0.85" dur="5s" repeatCount="indefinite" />
  </circle>

  <text x="${W - 60}" y="150" text-anchor="end" class="year">${YEAR}</text>

  <text x="56" y="56" class="kicker">// CONTRIBUTION SKYLINE ·</text>
  <text x="56" y="96" class="who">${esc(USERNAME)}</text>
  <text x="56" y="124" class="meta"><tspan class="metaN">${total}</tspan> contributions · <tspan class="metaN">${peak}</tspan> peak · <tspan class="metaN">${activeDays}</tspan> active days · rolling 365 days</text>

  <g>${ground}</g>
  <g>${towers}</g>

  <g>
    <text x="56" y="${H - 52}" class="statL">DAILY AVG</text>
    <text x="56" y="${H - 26}" class="statV">${dailyAvg}</text>
    <text x="210" y="${H - 52}" class="statL">PEAK DAY</text>
    <text x="210" y="${H - 26}" class="statV">${peak}</text>
    <text x="360" y="${H - 52}" class="statL">ACTIVE</text>
    <text x="360" y="${H - 26}" class="statV">${activeDays} / ${days.length}</text>
  </g>

  <text x="${W - 56}" y="${H - 26}" text-anchor="end" class="src">github.com/${esc(USERNAME)}</text>
</svg>
`;

process.stdout.write(svg);

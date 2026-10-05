// Builds the self-hosted GitHub Activity section:
//   assets/activity-overview.svg  — lifetime scorecard + 365-day ring + streaks
//   assets/activity-pulse.svg     — 52-week contribution wave, weekday rhythm, languages
//   assets/trophies.svg           — ranked trophy cabinet
//
// Replaces five third-party stat-card services (each with its own theme and
// its own outages) with one consistent, animated set drawn from real GraphQL
// data. Byte-stable: no randomness, so the daily job only commits on change.
//
//   GITHUB_TOKEN=... node scripts/gen-activity.mjs

import { writeFileSync } from "node:fs";
import { gql, USERNAME, esc, C } from "./lib/gh.mjs";
import { W, defs, baseStyle, frame, liveTag } from "./lib/card.mjs";

const out = (name, svg) =>
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), svg, "utf8");

/* ── real data ─────────────────────────────────────────────────── */

const now = new Date();
const DAY = 24 * 3600 * 1000;

const base = await gql(
  `query($login:String!){ user(login:$login){
     createdAt
     followers { totalCount }
     repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: 100) {
       totalCount
       nodes { name stargazerCount forkCount primaryLanguage { name color } }
     }
   } }`,
  { login: USERNAME }
);
const user = base.user;
const firstYear = new Date(user.createdAt).getUTCFullYear();
const thisYear = now.getUTCFullYear();

// One aliased contributionsCollection per calendar year: lifetime totals and
// a full day-by-day history for streaks, in a single round trip.
const years = [];
for (let y = firstYear; y <= thisYear; y++) years.push(y);
const yearField = (y) => {
  const from = new Date(Date.UTC(y, 0, 1)).toISOString();
  const to = y === thisYear ? now.toISOString() : new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString();
  return `y${y}: contributionsCollection(from:"${from}", to:"${to}") {
    totalCommitContributions totalPullRequestContributions
    totalIssueContributions totalPullRequestReviewContributions
    contributionCalendar { weeks { contributionDays { date contributionCount } } } }`;
};
const hist = await gql(
  `query($login:String!){ user(login:$login){ ${years.map(yearField).join("\n")} } }`,
  { login: USERNAME }
);

const life = { commits: 0, prs: 0, issues: 0, reviews: 0 };
const allDays = new Map();
for (const y of years) {
  const c = hist.user[`y${y}`];
  life.commits += c.totalCommitContributions;
  life.prs += c.totalPullRequestContributions;
  life.issues += c.totalIssueContributions;
  life.reviews += c.totalPullRequestReviewContributions;
  for (const w of c.contributionCalendar.weeks)
    for (const d of w.contributionDays) allDays.set(d.date, d.contributionCount);
}

// Rolling 365-day calendar — the same window GitHub shows on the profile.
const roll = await gql(
  `query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){
     contributionsCollection(from:$from,to:$to){ contributionCalendar{ totalContributions
       weeks{ contributionDays{ date contributionCount weekday } } } } } }`,
  { login: USERNAME, from: new Date(now - 364 * DAY).toISOString(), to: now.toISOString() }
);
const cal = roll.user.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap((w) => w.contributionDays);
const total365 = cal.totalContributions;
const activeDays = days.filter((d) => d.contributionCount > 0).length;

// Streaks over the whole history. Today with zero contributions doesn't
// break the current streak — the day isn't over yet.
const dates = [...allDays.keys()].sort();
let longest = 0, longestEnd = null, run = 0;
for (const d of dates) {
  if (allDays.get(d) > 0) {
    run++;
    if (run > longest) { longest = run; longestEnd = d; }
  } else run = 0;
}
let current = 0;
for (let i = dates.length - 1; i >= 0; i--) {
  const n = allDays.get(dates[i]);
  if (n > 0) current++;
  else if (i === dates.length - 1) continue;
  else break;
}

const repos = user.repositories.nodes;
const stars = repos.reduce((n, r) => n + r.stargazerCount, 0);
const forks = repos.reduce((n, r) => n + r.forkCount, 0);

const weekly = cal.weeks.map((w) => ({
  start: w.contributionDays[0].date,
  sum: w.contributionDays.reduce((n, d) => n + d.contributionCount, 0),
}));

const byWeekday = [0, 0, 0, 0, 0, 0, 0];
for (const d of days) byWeekday[d.weekday] += d.contributionCount;

// Languages by number of repos (primary language). Byte counts would be
// swamped by notebook outputs and say nothing about what I actually write.
const langCount = new Map();
for (const r of repos) {
  if (!r.primaryLanguage) continue;
  const k = r.primaryLanguage.name;
  const e = langCount.get(k) ?? { n: 0, color: r.primaryLanguage.color || C.coral };
  e.n++;
  langCount.set(k, e);
}
const langs = [...langCount.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));

const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const STAMP = now.toISOString().slice(0, 10);

/* ── 1. overview ───────────────────────────────────────────────── */
{
  const H = 470;
  const cx = 190, cy = 275, r = 118;
  // The ring is the last 12 months: one arc per month, brighter the busier.
  const monthly = new Map();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    monthly.set(k, (monthly.get(k) ?? 0) + d.contributionCount);
  }
  const mKeys = [...monthly.keys()].sort().slice(-12);
  const mMax = Math.max(1, ...mKeys.map((k) => monthly.get(k)));
  const arcs = mKeys
    .map((k, i) => {
      const t = monthly.get(k) / mMax;
      const color = t === 0 ? C.edge : t > 0.66 ? C.gold : t > 0.33 ? C.coral : C.red;
      const op = t === 0 ? 1 : (0.45 + 0.55 * t).toFixed(2);
      return `<circle class="arc" style="animation-delay:${(0.3 + i * 0.09).toFixed(2)}s" cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-opacity="${op}" stroke-width="16" pathLength="12"
        stroke-dasharray="0.88 11.12" stroke-dashoffset="${-i}" transform="rotate(-90 ${cx} ${cy})" ${t > 0.33 ? 'filter="url(#glow)"' : ""}>
        <title>${k}: ${monthly.get(k)}</title></circle>`;
    })
    .join("");

  // 12 tick marks around the ring — one per month — for an instrument feel.
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const r1 = r + 16, r2 = r + (i % 5 === 0 ? 26 : 20);
    ticks += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}" stroke="${C.red}" stroke-opacity="${i % 5 === 0 ? 0.6 : 0.25}" stroke-width="2" />`;
  }

  const tiles = [
    ["COMMITS", life.commits],
    ["PULL REQS", life.prs],
    ["ISSUES", life.issues],
    ["BEST STREAK", `${longest}d`],
    ["STARS", stars],
    ["FOLLOWERS", user.followers.totalCount],
  ];
  const TX = 380, TY = 130, TW = 158, TH = 120, GAP = 12;
  const tileSvg = tiles
    .map(([label, v], i) => {
      const x = TX + (i % 3) * (TW + GAP);
      const y = TY + Math.floor(i / 3) * (TH + GAP);
      return `<g class="rise" style="animation-delay:${0.25 + i * 0.12}s">
        <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="12" fill="${C.panel}" stroke="${C.edge}" />
        <rect x="${x}" y="${y + TH - 4}" width="${TW}" height="4" rx="2" fill="url(#hot)" opacity="0.85" />
        <text x="${x + 18}" y="${y + 36}" class="lbl">${label}</text>
        <text x="${x + 18}" y="${y + 88}" class="val" font-size="44">${typeof v === "number" ? fmt(v) : v}</text>
      </g>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs()}
  <style>${baseStyle}
    .arc { opacity:0; animation: pop .5s ease-out forwards; }
    @keyframes pop { to { opacity:1; } }
    .mon { fill:${C.dim}; font-size:12px; font-weight:700; }
    .spin { animation: spin 24s linear infinite; transform-origin: ${cx}px ${cy}px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  ${frame(H, "// GITHUB ACTIVITY", "Lifetime scorecard", liveTag(STAMP))}

  <g class="spin">${ticks}</g>
  ${arcs}
  <text x="${cx}" y="${cy - 26}" text-anchor="middle" class="lbl">LAST 12 MONTHS</text>
  <text x="${cx}" y="${cy + 28}" text-anchor="middle" class="val" font-size="62">${fmt(total365)}</text>
  <text x="${cx}" y="${cy + 58}" text-anchor="middle" class="lbl">contributions</text>

  ${tileSvg}

  <g class="rise" style="animation-delay:1.1s">
    <text x="40" y="${H - 28}" class="foot"><tspan fill="${C.coral}" font-weight="700">${activeDays}</tspan> active days · streak <tspan fill="${C.coral}" font-weight="700">${current}</tspan> now / <tspan fill="${C.coral}" font-weight="700">${longest}</tspan> best · <tspan fill="${C.coral}" font-weight="700">${user.repositories.totalCount}</tspan> repos · <tspan fill="${C.coral}" font-weight="700">${forks}</tspan> forks · since ${firstYear}</text>
  </g>
</svg>
`;
  out("activity-overview.svg", svg);
}

/* ── 2. pulse ──────────────────────────────────────────────────── */
{
  const H = 640;
  const X0 = 60, X1 = W - 50, Y0 = 130, Y1 = 330;
  const peak = Math.max(1, ...weekly.map((w) => w.sum));
  const pts = weekly.map((w, i) => [
    X0 + (i / Math.max(1, weekly.length - 1)) * (X1 - X0),
    Y1 - (w.sum / peak) * (Y1 - Y0),
  ]);

  // Catmull-Rom → cubic Bézier for a smooth wave through every real point.
  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(Y1, p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(Y1, p2[1] - (p3[1] - p1[1]) / 6)];
    line += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${line} L ${X1} ${Y1} L ${X0} ${Y1} Z`;
  const last = pts[pts.length - 1];
  const peakIdx = weekly.findIndex((w) => w.sum === peak);
  const pk = pts[peakIdx];

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = Y1 - (i / 3) * (Y1 - Y0);
    grid += `<line x1="${X0}" x2="${X1}" y1="${y}" y2="${y}" stroke="${C.red}" stroke-opacity="${i === 0 ? 0.35 : 0.1}" stroke-dasharray="${i === 0 ? "" : "4 6"}" />
      <text x="${X0 - 12}" y="${y + 5}" text-anchor="end" class="axis">${Math.round((i / 3) * peak)}</text>`;
  }
  // Month labels at the first week that starts in each month.
  let months = "";
  let lastMonth = -1;
  weekly.forEach((w, i) => {
    const m = new Date(w.start).getUTCMonth();
    if (m !== lastMonth && i > 0) {
      months += `<text x="${pts[i][0].toFixed(1)}" y="${Y1 + 26}" text-anchor="middle" class="axis">${new Date(w.start).toLocaleString("en", { month: "short", timeZone: "UTC" })}</text>`;
    }
    lastMonth = m;
  });

  // Weekday bars
  const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const wdMax = Math.max(1, ...byWeekday);
  const BX = 40, BY = 420, BW = 400, BH = 160;
  const barW = 38;
  const bars = byWeekday
    .map((v, i) => {
      const h = Math.max(3, (v / wdMax) * (BH - 40));
      const x = BX + 28 + i * ((BW - 56) / 7) + 4;
      const best = v === wdMax;
      return `<g>
        <rect class="bar" style="animation-delay:${0.8 + i * 0.08}s" x="${x.toFixed(1)}" y="${(BY + BH - h).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="6" fill="${best ? "url(#hotV)" : "#5c0f16"}" ${best ? 'filter="url(#glow)"' : ""} />
        <text x="${(x + barW / 2).toFixed(1)}" y="${(BY + BH - h - 8).toFixed(1)}" text-anchor="middle" class="axis" ${best ? `style="fill:${C.text}"` : ""}>${v}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${BY + BH + 24}" text-anchor="middle" class="axis">${names[i]}</text>
      </g>`;
    })
    .join("");

  // Language donut
  const DX = 590, DY = 505, DR = 72;
  const dc = 2 * Math.PI * DR;
  const totalLang = langs.reduce((n, [, e]) => n + e.n, 0) || 1;
  const top = langs.slice(0, 5);
  const rest = langs.slice(5).reduce((n, [, e]) => n + e.n, 0);
  if (rest) top.push(["Other", { n: rest, color: "#6e3a36" }]);
  let acc = 0;
  const segs = top
    .map(([name, e], i) => {
      const len = (e.n / totalLang) * dc;
      const seg = `<circle cx="${DX}" cy="${DY}" r="${DR}" fill="none" stroke="${e.color}" stroke-width="22"
        stroke-dasharray="0 ${dc.toFixed(1)}" transform="rotate(${((acc / dc) * 360 - 90).toFixed(2)} ${DX} ${DY})">
        <animate attributeName="stroke-dasharray" from="0 ${dc.toFixed(1)}" to="${Math.max(0, len - 3).toFixed(1)} ${dc.toFixed(1)}" dur="1s" begin="${(0.9 + i * 0.18).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines=".3 .7 .2 1" keyTimes="0;1" />
      </circle>`;
      acc += len;
      return seg;
    })
    .join("");
  const legend = top
    .map(([name, e], i) => {
      const y = 448 + i * 26;
      return `<g class="rise" style="animation-delay:${1 + i * 0.12}s">
        <rect x="700" y="${y - 12}" width="14" height="14" rx="3" fill="${e.color}" />
        <text x="722" y="${y}" class="leg">${esc(name.replace("Jupyter Notebook", "Jupyter"))}</text>
        <text x="${W - 50}" y="${y}" text-anchor="end" class="legN">${Math.round((e.n / totalLang) * 100)}%</text>
      </g>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs(`
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F90001" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#F90001" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="hotV" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#F90001" />
      <stop offset="100%" stop-color="#FFB000" />
    </linearGradient>
    <clipPath id="reveal"><rect x="0" y="0" width="0" height="${H}">
      <animate attributeName="width" from="0" to="${W}" dur="2.4s" begin=".2s" fill="freeze" calcMode="spline" keySplines=".4 0 .2 1" keyTimes="0;1" />
    </rect></clipPath>`)}
  <style>${baseStyle}
    .axis { fill:${C.dim}; font-size:13px; }
    .leg  { fill:${C.peach}; font-size:15px; }
    .legN { fill:${C.text}; font-size:15px; font-weight:700; }
    .bar  { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); animation: grow .9s cubic-bezier(.2,.8,.2,1) forwards; }
    @keyframes grow { to { transform: scaleY(1); } }
  </style>
  ${frame(H, "// CONTRIBUTION PULSE", "52 weeks, week by week", liveTag(STAMP))}

  ${grid}
  ${months}
  <g clip-path="url(#reveal)">
    <path d="${area}" fill="url(#fill)" />
    <path d="${line}" fill="none" stroke="url(#hot)" stroke-width="3.5" stroke-linejoin="round" filter="url(#glow)" />
    <circle cx="${pk[0].toFixed(1)}" cy="${pk[1].toFixed(1)}" r="6" fill="${C.gold}" />
    <text x="${Math.min(X1 - 60, Math.max(X0 + 60, pk[0])).toFixed(1)}" y="${(pk[1] - 16).toFixed(1)}" text-anchor="middle" class="legN" style="fill:${C.gold}">peak · ${peak}/wk</text>
  </g>
  <circle class="pulse" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="7" fill="${C.red}" style="animation-delay:2.6s" />
  <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="#fff" />

  <rect x="${BX - 10}" y="${BY - 60}" width="${BW + 20}" height="${BH + 100}" rx="14" fill="${C.panel}" stroke="${C.edge}" />
  <text x="${BX + 12}" y="${BY - 28}" class="lbl">WEEKLY RHYTHM</text>
  ${bars}

  <rect x="470" y="${BY - 60}" width="${W - 500}" height="${BH + 100}" rx="14" fill="${C.panel}" stroke="${C.edge}" />
  <text x="492" y="${BY - 28}" class="lbl">LANGUAGES · ${totalLang} REPOS</text>
  <circle cx="${DX}" cy="${DY}" r="${DR}" fill="none" stroke="${C.edge}" stroke-width="22" />
  ${segs}
  <text x="${DX}" y="${DY + 10}" text-anchor="middle" class="val" font-size="30">${langs.length}</text>
  <text x="${DX}" y="${DY + 30}" text-anchor="middle" class="axis">langs</text>
  ${legend}
</svg>
`;
  out("activity-pulse.svg", svg);
}

/* ── 3. trophies ───────────────────────────────────────────────── */
{
  const RANKS = ["C", "B", "A", "AA", "AAA", "S", "SS", "SSS"];
  const T = [
    ["Commits", life.commits, [1, 10, 50, 100, 250, 500, 1000, 2000]],
    ["Pull Requests", life.prs, [1, 5, 10, 25, 50, 100, 200, 500]],
    ["Issues", life.issues, [1, 5, 10, 25, 50, 100, 200, 500]],
    ["Forks Earned", forks, [1, 5, 10, 20, 50, 100, 250, 500]],
    ["Stars", stars, [1, 5, 10, 25, 50, 100, 250, 500]],
    ["Followers", user.followers.totalCount, [1, 5, 10, 20, 50, 100, 250, 500]],
    ["Repositories", user.repositories.totalCount, [1, 3, 5, 10, 20, 30, 50, 100]],
    ["Best Streak", longest, [2, 5, 7, 14, 21, 30, 60, 100]],
  ];

  // Tier → cup metal. S-tier burns, A-tier is gold, B silver, C bronze.
  const metal = (rank) =>
    rank.startsWith("S") ? ["#FFE08A", "#FF6B57", "#B3000A"]
    : rank.startsWith("A") ? ["#FFF1B8", "#FFC233", "#9A6400"]
    : rank === "B" ? ["#FFFFFF", "#C9D1D9", "#6E7681"]
    : rank === "C" ? ["#FFD2A8", "#C77B3A", "#6B3A12"]
    : ["#3A2A2C", "#2A1D1F", "#1A1213"];

  const H = 560;
  const CW = W / 4;
  let gradDefs = "";
  const cells = T.map(([name, v, th], i) => {
    let level = -1;
    th.forEach((t, k) => { if (v >= t) level = k; });
    const rank = level >= 0 ? RANKS[level] : "–";
    const next = level < th.length - 1 ? th[level + 1] : null;
    const prev = level >= 0 ? th[level] : 0;
    const prog = next ? Math.max(0, Math.min(1, (v - prev) / (next - prev))) : 1;
    const [hi, mid, lo] = metal(rank);
    gradDefs += `<linearGradient id="m${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${hi}" /><stop offset="45%" stop-color="${mid}" /><stop offset="100%" stop-color="${lo}" /></linearGradient>`;

    const cx = CW * (i % 4) + CW / 2;
    const top = 120 + Math.floor(i / 4) * 215;
    const cy = top + 78;
    const isS = rank.startsWith("S");
    const delay = (0.15 + i * 0.12).toFixed(2);

    const cup = `M -36 -58 H 36 V -30 C 36 -2 18 12 0 12 C -18 12 -36 -2 -36 -30 Z`;
    return `<g class="rise" style="animation-delay:${delay}s">
      <rect x="${cx - CW / 2 + 10}" y="${top}" width="${CW - 20}" height="200" rx="14" fill="${C.panel}" stroke="${isS ? C.red : C.edge}" stroke-opacity="${isS ? 0.7 : 1}" />
      <g class="float" style="animation-delay:${(i * 0.37).toFixed(2)}s">
        <g transform="translate(${cx} ${cy})">
          ${isS ? `<circle r="56" cy="-22" fill="${C.red}" opacity="0.18" filter="url(#glow)" class="halo" />` : ""}
          <path d="M -36 -48 C -64 -48 -62 -14 -30 -12" fill="none" stroke="url(#m${i})" stroke-width="7" stroke-linecap="round" />
          <path d="M 36 -48 C 64 -48 62 -14 30 -12" fill="none" stroke="url(#m${i})" stroke-width="7" stroke-linecap="round" />
          <path d="${cup}" fill="url(#m${i})" />
          <rect x="-6" y="11" width="12" height="18" fill="url(#m${i})" />
          <rect x="-26" y="28" width="52" height="10" rx="3" fill="url(#m${i})" />
          <rect x="-34" y="38" width="68" height="12" rx="3" fill="#1d1012" stroke="${lo}" />
          <text y="-22" text-anchor="middle" class="rank" font-size="${rank.length > 2 ? 20 : 26}" fill="${level < 0 ? "#5b4547" : "#1A0A0C"}">${rank}</text>
          <g clip-path="url(#cupclip)"><rect class="shine" style="animation-delay:${(1 + i * 0.35).toFixed(2)}s" x="-90" y="-70" width="22" height="100" fill="#fff" opacity="0.55" transform="skewX(-20)" /></g>
        </g>
      </g>
      <text x="${cx}" y="${top + 152}" text-anchor="middle" class="tname">${name}</text>
      <text x="${cx}" y="${top + 174}" text-anchor="middle" class="tval">${fmt(v)}${next ? ` <tspan class="tnext">→ ${fmt(next)}</tspan>` : ` <tspan class="tnext">MAX</tspan>`}</text>
      <rect x="${cx - 70}" y="${top + 184}" width="140" height="4" rx="2" fill="${C.edge}" />
      <rect x="${cx - 70}" y="${top + 184}" width="${(140 * prog).toFixed(1)}" height="4" rx="2" fill="url(#hot)" />
    </g>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs(`${gradDefs}
    <clipPath id="cupclip"><path d="M -36 -58 H 36 V -30 C 36 -2 18 12 0 12 C -18 12 -36 -2 -36 -30 Z" /></clipPath>`)}
  <style>${baseStyle}
    .rank  { font-weight:900; }
    .tname { fill:${C.peach}; font-size:16px; font-weight:700; }
    .tval  { fill:${C.text}; font-size:16px; font-weight:800; }
    .tnext { fill:${C.dim}; font-size:13px; font-weight:400; }
    .float { animation: float 4s ease-in-out infinite; }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    .shine { animation: shine 4.5s ease-in-out infinite; }
    @keyframes shine { 0% { transform: skewX(-20deg) translateX(0); } 35%,100% { transform: skewX(-20deg) translateX(190px); } }
    .halo  { animation: halo 2.4s ease-in-out infinite; }
    @keyframes halo { 0%,100% { opacity:.12; } 50% { opacity:.32; } }
  </style>
  ${frame(H, "// TROPHY CABINET", "Ranked from real GitHub data", liveTag(STAMP))}
  ${cells}
</svg>
`;
  out("trophies.svg", svg);
}

console.log(
  `activity: ${total365} contribs/365d · ${activeDays} active · streak ${current}/${longest} · ` +
    `commits ${life.commits} prs ${life.prs} issues ${life.issues} reviews ${life.reviews} · stars ${stars}`
);

// Renders the guestbook wall: numbered signature slots. The next free slot
// always comes first and glows ("#001 is still unclaimed" — nobody likes
// leaving the first spot empty), then the newest signatures (open issues
// labelled `guestbook`) with the signer's avatar, then dim placeholders.
// Avatars are embedded as data URIs because GitHub won't load external
// images from inside an SVG.
//
// Moderation is just GitHub: close an issue and it drops off the wall on the
// next run.
//
//   GITHUB_TOKEN=... node scripts/gen-guestbook.mjs
//   GUESTBOOK_FIXTURE=issues.json node scripts/gen-guestbook.mjs   (preview)

import { readFileSync, writeFileSync } from "node:fs";
import { rest, USERNAME, esc, C } from "./lib/gh.mjs";
import { W, defs, baseStyle, frame } from "./lib/card.mjs";

const SHOW = 5;
const issues = (
  process.env.GUESTBOOK_FIXTURE
    ? JSON.parse(readFileSync(process.env.GUESTBOOK_FIXTURE, "utf8"))
    : await rest(`repos/${USERNAME}/${USERNAME}/issues?labels=guestbook&state=open&per_page=100&sort=created&direction=desc`)
).filter((i) => !i.pull_request);

// The issue form renders as "### What brings you here?\n\n<reason>\n\n### Your message\n\n<text>".
function parse(body = "") {
  const section = (title) => {
    const m = body.match(new RegExp(`###\\s*${title}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###|$)`, "i"));
    return m ? m[1].trim() : "";
  };
  const reason = section("What brings you here");
  const message = section("Your message") || body.replace(/###.*\n/g, "").trim();
  return { reason: reason === "_No response_" ? "" : reason, message };
}

const RTL = /[֐-ࣿיִ-ﻼ]/;

function wrap(text, width, maxLines) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) out.push(cur);
      cur = w.length > width ? w.slice(0, width - 1) + "…" : w;
    } else cur = (cur + " " + w).trim();
    if (out.length === maxLines) break;
  }
  if (out.length < maxLines && cur) out.push(cur);
  if (out.length === maxLines && words.join(" ").length > out.join(" ").length + 1) {
    out[maxLines - 1] = out[maxLines - 1].replace(/.{0,2}$/, "") + "…";
  }
  return out;
}

async function avatar(url) {
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}s=96`);
    // A deleted account or a rate-limit page must fall back to the plain
    // circle, not get embedded as a broken "image".
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const entries = await Promise.all(
  issues.slice(0, SHOW).map(async (i) => ({
    login: i.user.login,
    date: i.created_at.slice(0, 10),
    av: await avatar(i.user.avatar_url),
    ...parse(i.body || ""),
  }))
);

const style = `
  .count  { fill:${C.peach}; font-size:15px; font-weight:700; }
  .num    { fill:#6a3c3a; font-size:14px; font-weight:800; letter-spacing:2px; }
  .numHot { fill:${C.gold}; font-size:16px; font-weight:800; letter-spacing:2px; }
  .who    { fill:${C.text}; font-size:17px; font-weight:800; }
  .when   { fill:${C.dim}; font-size:13px; }
  .msg    { fill:${C.peach}; font-size:15px; }
  .open   { fill:${C.text}; font-size:23px; font-weight:800; }
  .openS  { fill:${C.gold}; font-size:16px; font-weight:700; }
  .ghost  { fill:#4a2a2c; font-size:14px; font-weight:700; }
  .q      { fill:${C.gold}; font-size:28px; font-weight:800; }
  .dash   { animation: march 1.2s linear infinite; }
  @keyframes march { to { stroke-dashoffset: -15; } }
  .halo   { transform-box: fill-box; transform-origin: center; animation: halo 2.2s ease-in-out infinite; }
  @keyframes halo { 0%,100% { opacity:.15; } 50% { opacity:.55; } }
  .caret  { animation: caret 1s steps(1) infinite; }
  @keyframes caret { 50% { opacity:0; } }
`;

const COLS = 3, CW = 266, CH = 170, GX = 30, GY = 118, GAP = 18;
const total = issues.length;
const tag = (n) => "#" + String(n).padStart(3, "0");

const slots = [{ kind: "open", n: total + 1 }];
entries.forEach((e, i) => slots.push({ kind: "entry", n: total - i, e }));
for (let n = total + 2; slots.length % COLS; n++) slots.push({ kind: "ghost", n });

const rows = slots.length / COLS;
const H = GY + rows * (CH + GAP) + 40;

function openSlot(x, y, n) {
  const first = n === 1;
  return `
    <rect x="${x - 3}" y="${y - 3}" width="${CW + 6}" height="${CH + 6}" rx="17" fill="${C.gold}" class="halo" filter="url(#glow)" />
    <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="14" fill="#1a110a" />
    <rect x="${x + 1}" y="${y + 1}" width="${CW - 2}" height="${CH - 2}" rx="13" fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="8 7" class="dash" />
    <text x="${x + 20}" y="${y + 34}" class="numHot">${tag(n)} · OPEN</text>
    <g transform="translate(${x + CW - 44} ${y + 42})">
      <circle r="23" fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="4 4" class="dash" />
      <text y="10" text-anchor="middle" class="q">?</text>
    </g>
    <text x="${x + 20}" y="${y + 94}" class="open">${first ? "Be the first" : "This spot"}</text>
    <text x="${x + 20}" y="${y + 120}" class="open">${first ? "to sign the wall" : "is yours"}<tspan fill="${C.gold}" class="caret">▌</tspan></text>
    <text x="${x + 20}" y="${y + 152}" class="openS">2 questions · 30 sec →</text>`;
}

function ghostSlot(x, y, n) {
  return `
    <rect x="${x + 1}" y="${y + 1}" width="${CW - 2}" height="${CH - 2}" rx="13" fill="none" stroke="#3a1a1d" stroke-width="1.5" stroke-dasharray="6 8" />
    <text x="${x + 20}" y="${y + 34}" class="num">${tag(n)}</text>
    <circle cx="${x + CW - 44}" cy="${y + 42}" r="22" fill="none" stroke="#3a1a1d" stroke-dasharray="4 5" />
    <rect x="${x + 20}" y="${y + 84}" width="150" height="10" rx="5" fill="#22111a" />
    <rect x="${x + 20}" y="${y + 106}" width="104" height="10" rx="5" fill="#22111a" />
    <text x="${x + 20}" y="${y + 152}" class="ghost">waiting…</text>`;
}

function entrySlot(x, y, n, e) {
  const rtl = RTL.test(e.message);
  const msg = wrap(e.message, 25, 3)
    .map((l, k) => `<text x="${rtl ? x + CW - 20 : x + 20}" y="${y + 98 + k * 22}" class="msg"${rtl ? ' direction="rtl" unicode-bidi="embed"' : ""}>${esc(l)}</text>`)
    .join("");
  const login = e.login.length > 13 ? e.login.slice(0, 12) + "…" : e.login;
  return `
    <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="14" fill="${C.panel}" stroke="${C.edge}" />
    <rect x="${x}" y="${y + 14}" width="3" height="${CH - 28}" rx="1.5" fill="url(#hot)" />
    <g transform="translate(${x + 42} ${y + 42})">
      <circle r="25" fill="none" stroke="url(#hot)" stroke-width="2" />
      ${e.av ? `<image href="${e.av}" x="-22" y="-22" width="44" height="44" clip-path="url(#round)" />` : `<circle r="22" fill="${C.edge}" />`}
    </g>
    <text x="${x + 78}" y="${y + 38}" class="who">@${esc(login)}</text>
    <text x="${x + 78}" y="${y + 58}" class="when">${tag(n)} · ${e.date}</text>
    ${msg}`;
}

const body = slots
  .map((slot, i) => {
    const x = GX + (i % COLS) * (CW + GAP);
    const y = GY + Math.floor(i / COLS) * (CH + GAP);
    const inner =
      slot.kind === "open" ? openSlot(x, y, slot.n) : slot.kind === "ghost" ? ghostSlot(x, y, slot.n) : entrySlot(x, y, slot.n, slot.e);
    return `<g class="rise" style="animation-delay:${(0.15 + i * 0.12).toFixed(2)}s">${inner}</g>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs('<clipPath id="round"><circle cx="0" cy="0" r="22" /></clipPath>')}
  <style>${baseStyle}${style}</style>
  ${frame(H, "// GUESTBOOK", "Sign the wall",
    `<text x="${W - 40}" y="50" text-anchor="end" class="count">${total} signed · ${tag(total + 1)} open</text>`)}
  ${body}
  <text x="40" y="${H - 20}" class="foot">↳ click the wall to sign — your avatar and note land in the next slot</text>
</svg>
`;

writeFileSync(new URL("../assets/guestbook.svg", import.meta.url), svg, "utf8");
console.log(`guestbook: ${total} signatures, showing ${entries.length}`);

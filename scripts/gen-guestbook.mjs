// Renders the guestbook wall: the latest signatures (open issues labelled
// `guestbook`) as cards with the signer's avatar, embedded as data URIs
// because GitHub won't load external images from inside an SVG.
//
// Moderation is just GitHub: close an issue and it drops off the wall on the
// next run. With no signatures yet, the wall invites the first one.
//
//   GITHUB_TOKEN=... node scripts/gen-guestbook.mjs

import { writeFileSync } from "node:fs";
import { rest, USERNAME, esc, C } from "./lib/gh.mjs";
import { W, defs, baseStyle, frame } from "./lib/card.mjs";

const SHOW = 6;
const issues = (
  await rest(`repos/${USERNAME}/${USERNAME}/issues?labels=guestbook&state=open&per_page=50&sort=created&direction=desc`)
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
  .who    { fill:${C.text}; font-size:17px; font-weight:800; }
  .when   { fill:${C.dim}; font-size:13px; }
  .chip   { fill:${C.gold}; font-size:13px; font-weight:700; }
  .msg    { fill:${C.peach}; font-size:16px; }
  .big    { fill:${C.text}; font-size:34px; font-weight:800; }
  .sub    { fill:${C.peach}; font-size:17px; }
  .ink    { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ink 2.6s ease-in-out .6s infinite alternate; }
  @keyframes ink { to { stroke-dashoffset: 0; } }
  .float  { animation: float 4s ease-in-out infinite; }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
`;

let body, H;
if (entries.length === 0) {
  H = 330;
  body = `
  <g transform="translate(${W / 2} 150)"><g class="float">
    <rect x="-90" y="-50" width="180" height="110" rx="10" fill="${C.panel}" stroke="${C.red}" stroke-opacity=".6" />
    <line x1="0" y1="-50" x2="0" y2="60" stroke="${C.red}" stroke-opacity=".4" />
    <path class="ink" pathLength="1" d="M -72 -20 C -55 -34, -40 -6, -24 -20 S 0 -10, -14 6 M -72 14 H -24 M 16 -20 H 72 M 16 0 H 60 M 16 20 H 68"
      fill="none" stroke="url(#hot)" stroke-width="3" stroke-linecap="round" />
  </g></g>
  <text x="${W / 2}" y="262" text-anchor="middle" class="big rise" style="animation-delay:.3s">The first page is still blank.</text>
  <text x="${W / 2}" y="296" text-anchor="middle" class="sub rise" style="animation-delay:.5s">Sign it and your avatar and note show up here.</text>`;
} else {
  const CW = 405, CH = 150, GX = 30, GY = 115, GAP = 30;
  const rows = Math.ceil(entries.length / 2);
  H = GY + rows * (CH + 20) + 20;
  body = entries
    .map((e, i) => {
      const x = GX + (i % 2) * (CW + GAP);
      const y = GY + Math.floor(i / 2) * (CH + 20);
      const rtl = RTL.test(e.message);
      const lines = wrap(e.message, 40, 2);
      const msg = lines
        .map((l, k) => `<text x="${rtl ? x + CW - 22 : x + 22}" y="${y + 100 + k * 24}" class="msg" ${rtl ? 'direction="rtl" unicode-bidi="embed"' : ""}>${esc(l)}</text>`)
        .join("");
      const reason = e.reason.replace(/\s*\p{Extended_Pictographic}.*$/u, "").trim();
      return `<g class="rise" style="animation-delay:${(0.2 + i * 0.15).toFixed(2)}s">
        <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="14" fill="${C.panel}" stroke="${C.edge}" />
        <rect x="${x}" y="${y}" width="4" height="${CH}" rx="2" fill="url(#hot)" />
        <g transform="translate(${x + 50} ${y + 46})">
          <circle r="29" fill="none" stroke="url(#hot)" stroke-width="2" />
          ${e.av ? `<image href="${e.av}" x="-26" y="-26" width="52" height="52" clip-path="url(#round)" />` : `<circle r="26" fill="${C.edge}" />`}
        </g>
        <text x="${x + 92}" y="${y + 42}" class="who">@${esc(e.login)}</text>
        <text x="${x + 92}" y="${y + 64}" class="when">${e.date}${reason ? ` · <tspan class="chip">${esc(reason)}</tspan>` : ""}</text>
        ${msg}
      </g>`;
    })
    .join("");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
  ${defs('<clipPath id="round"><circle cx="0" cy="0" r="26" /></clipPath>')}
  <style>${baseStyle}${style}</style>
  ${frame(H, "// GUESTBOOK", "Notes from visitors",
    `<text x="${W - 40}" y="50" text-anchor="end" class="count">${issues.length} signature${issues.length === 1 ? "" : "s"}</text>`)}
  ${body}
</svg>
`;

writeFileSync(new URL("../assets/guestbook.svg", import.meta.url), svg, "utf8");
console.log(`guestbook: ${issues.length} signatures, showing ${entries.length}`);

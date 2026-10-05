// Refreshes the live-data blocks in README.md from real GitHub data only.
// No external API keys — everything here comes from the GitHub REST API
// using the workflow's own GITHUB_TOKEN. If a section has no real data yet
// (e.g. no releases), it says so honestly instead of being faked.
//
// The stats, trophies and guestbook are images built by their own scripts
// (gen-activity.mjs, gen-guestbook.mjs); this file only owns the text blocks.

import { readFileSync, writeFileSync } from "node:fs";
import { rest, USERNAME } from "./lib/gh.mjs";

const README_PATH = new URL("../README.md", import.meta.url);

function replaceBlock(content, marker, body) {
  const re = new RegExp(`(<!-- ${marker}:START -->)([\\s\\S]*?)(<!-- ${marker}:END -->)`);
  if (!re.test(content)) {
    throw new Error(`Marker ${marker} not found in README.md`);
  }
  return content.replace(re, `$1\n${body}\n$3`);
}

// ---------------------------------------------------------------------
// 1. Repository Index — every public repo, auto-categorised by topics
// ---------------------------------------------------------------------
const CATEGORIES = [
  {
    name: "🤖 AI & Computer Vision",
    match: (r) =>
      /computer-vision|deep-learning|machine-learning|yolo|pytorch|opencv|ai|zero-shot|explainable|surveillance|mcp|llm/i.test(
        (r.topics || []).join(" ")
      ),
  },
  {
    name: "🧮 Research, Data & Geometry",
    match: (r) =>
      /point-cloud|computational-geometry|curve-reconstruction|noise-removal|3d-printing|b-spline/i.test(
        (r.topics || []).join(" ")
      ),
  },
  {
    name: "🧰 Templates & Tooling",
    match: (r) => /template|boilerplate|mlops|reproducible/i.test((r.topics || []).join(" ")),
  },
  {
    name: "🌐 Web & Full-Stack",
    match: () => true, // whatever is left
  },
];

// Descriptions are free text: strip the decorative emoji runs at either end
// so the list reads cleanly, and keep stray HTML from leaking into the page.
const tidy = (s) =>
  s
    .replace(/^[\p{Extended_Pictographic}‍️\s]+|[\p{Extended_Pictographic}‍️\s]+$/gu, "")
    .replace(/[<>]/g, "")
    .replace(/\r?\n/g, " ");

// One line on a phone: the first sentence, capped at a word boundary.
function short(s, max = 110) {
  const first = s.split(/(?<=[.!?])\s|\s[—–-]\s|:\s/)[0];
  if (first.length <= max) return first.replace(/[.\s]+$/, "");
  return first.slice(0, first.lastIndexOf(" ", max)).replace(/[,;\s]+$/, "") + "…";
}

function buildRepoIndex(repos) {
  const listed = repos.filter((r) => r.name !== USERNAME && !r.fork);

  // Each repo lands in exactly one bucket — the first category whose
  // keywords match — so nothing is ever listed twice.
  const buckets = new Map(CATEGORIES.map((c) => [c.name, []]));
  for (const r of listed) {
    const cat = CATEGORIES.find((c) => c.match(r));
    buckets.get(cat.name).push(r);
  }

  // A list, not a table: a 4-column table with long descriptions is
  // unreadable on a phone, a list wraps naturally.
  const sections = [];
  for (const cat of CATEGORIES) {
    const items = buckets.get(cat.name);
    if (items.length === 0) continue;
    const rows = items.map((r) => {
      const lang = r.language ? ` · <sub>${r.language}</sub>` : "";
      const desc = short(tidy(r.description || ""));
      return `- **[\`${r.name}\`](https://github.com/${USERNAME}/${r.name})** · ⭐ ${r.stargazers_count}${lang}${desc ? `<br><sub>${desc}</sub>` : ""}`;
    });
    sections.push([`**${cat.name}** · ${items.length} repo${items.length === 1 ? "" : "s"}`, "", ...rows, ""].join("\n"));
  }
  return sections.join("\n");
}

// ---------------------------------------------------------------------
// 2. Recent Activity — real public events, denoised, last 8
// ---------------------------------------------------------------------
function describeEvent(e) {
  const repo = `[\`${e.repo.name}\`](https://github.com/${e.repo.name})`;
  switch (e.type) {
    case "PushEvent": {
      const n = e.payload.commits?.length ?? 1;
      return `⬆️ Pushed ${n} commit${n === 1 ? "" : "s"} to ${repo}`;
    }
    case "WatchEvent":
      return `⭐ Starred ${repo}`;
    case "CreateEvent":
      return `✨ Created ${e.payload.ref_type} ${e.payload.ref ? `\`${e.payload.ref}\` ` : ""}in ${repo}`;
    case "ReleaseEvent":
      return `📦 Released [\`${e.payload.release.tag_name}\`](${e.payload.release.html_url}) of ${repo}`;
    case "PullRequestEvent":
      return `🔀 ${e.payload.action === "closed" && e.payload.pull_request?.merged ? "Merged" : e.payload.action[0].toUpperCase() + e.payload.action.slice(1)} a PR in ${repo}`;
    case "IssuesEvent":
      return `📋 ${e.payload.action[0].toUpperCase() + e.payload.action.slice(1)} an issue in ${repo}`;
    case "ForkEvent":
      return `🍴 Forked ${repo}`;
    default:
      return null; // deletes, member changes, etc. say nothing to a visitor
  }
}

async function buildActivity() {
  // Fetch more than we show so the denoise pass below still has material.
  const events = await rest(`users/${USERNAME}/events/public?per_page=50`);

  // Noise rules:
  //  - branch creations are dropped when the same batch already has a push to
  //    that repo — the push is the event that matters;
  //  - identical lines (a session split across pushes) collapse.
  const pushedTo = new Set(events.filter((e) => e.type === "PushEvent").map((e) => e.repo.name));

  const seen = new Set();
  const kept = [];
  for (const e of events) {
    // Stars are bookmarks, not work — and other people's repo names don't
    // belong on my profile without context.
    if (e.type === "WatchEvent") continue;
    if (e.type === "CreateEvent" && e.payload.ref_type !== "repository" && pushedTo.has(e.repo.name)) continue;
    // The profile repo's own bot commits are housekeeping, not work.
    if (e.type === "PushEvent" && e.repo.name === `${USERNAME}/${USERNAME}`) continue;
    const line = describeEvent(e);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    kept.push(`${line} <sub>· ${e.created_at.slice(0, 10)}</sub>`);
    if (kept.length >= 8) break;
  }

  if (kept.length === 0) return "_No public activity yet._";
  return kept.map((line) => `- ${line}`).join("\n");
}

// ---------------------------------------------------------------------
// 3. Latest Releases — real releases across the user's own public repos
// ---------------------------------------------------------------------
async function buildReleases(repos) {
  const releases = [];
  for (const repo of repos) {
    const repoReleases = await rest(`repos/${USERNAME}/${repo.name}/releases?per_page=5`);
    for (const r of repoReleases) {
      releases.push({
        repo: repo.name,
        tag: r.tag_name,
        name: r.name || r.tag_name,
        url: r.html_url,
        date: (r.published_at || r.created_at || "").slice(0, 10),
      });
    }
  }
  if (releases.length === 0) {
    return "_No releases published yet — this section will fill in automatically the day I ship one._";
  }
  releases.sort((a, b) => (a.date < b.date ? 1 : -1));
  return releases
    .slice(0, 6)
    .map((r) => `- 📦 [\`${r.repo}\` \`${r.tag}\`](${r.url})${r.name !== r.tag ? ` — ${r.name}` : ""} <sub>· ${r.date}</sub>`)
    .join("\n");
}

// ---------------------------------------------------------------------

// One shared fetch of the repo list for the index and the release scan.
const repos = await rest(`users/${USERNAME}/repos?type=owner&per_page=100&sort=pushed`);

const [activity, releases] = await Promise.all([buildActivity(), buildReleases(repos)]);

let readme = readFileSync(README_PATH, "utf8");
readme = replaceBlock(readme, "ACTIVITY", activity);
readme = replaceBlock(readme, "LATEST_RELEASES", releases);
readme = replaceBlock(readme, "REPO_INDEX", buildRepoIndex(repos));

writeFileSync(README_PATH, readme, "utf8");
console.log("README.md updated.");

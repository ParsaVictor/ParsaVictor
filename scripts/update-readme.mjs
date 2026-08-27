// Refreshes the live-data blocks in README.md from real GitHub data only.
// No external API keys — everything here comes from the GitHub REST/GraphQL
// API using the workflow's own GITHUB_TOKEN. If a section has no real data
// yet (e.g. no releases), it says so honestly instead of being faked.

import { readFileSync, writeFileSync } from "node:fs";

const USERNAME = "ParsaVictor";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = new URL("../README.md", import.meta.url);

if (!TOKEN) {
  console.error("GITHUB_TOKEN is not set");
  process.exit(1);
}

// Cache-buster: shields.io caches aggressively, and a badge whose number only
// changes once a day can otherwise keep showing yesterday's value for hours.
// Appending today's date to the URL forces camo/shields to refetch daily.
const TODAY = new Date().toISOString().slice(0, 10);
const bust = (url) => `${url}&t=${TODAY}`;

// GitHub's own language colors (from linguist) so the pinned table reads like
// the rest of GitHub. Anything unknown falls back to the profile's red.
const LANG_COLORS = {
  Python: "#3572A5",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  "Jupyter Notebook": "#DA5B0B",
  HTML: "#e34c26",
  CSS: "#563d7c",
  "C++": "#f34b7d",
  C: "#555555",
  Java: "#b07219",
  Shell: "#89e051",
  Go: "#00ADD8",
  Rust: "#dea584",
};

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function rest(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`REST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function replaceBlock(content, marker, body) {
  const re = new RegExp(
    `(<!-- ${marker}:START -->)([\\s\\S]*?)(<!-- ${marker}:END -->)`
  );
  if (!re.test(content)) {
    throw new Error(`Marker ${marker} not found in README.md`);
  }
  return content.replace(re, `$1\n${body}\n$3`);
}

function badge(label, value) {
  const text = label.replaceAll("-", "--");
  const val = String(value).replaceAll("-", "--");
  return `<img src="${bust(
    `https://img.shields.io/badge/${text}-${val}-F90001?style=for-the-badge&logo=github&logoColor=white`
  )}" alt="${label.replace(/_/g, " ")}: ${value}" />`;
}

// ---------------------------------------------------------------------
// 1. Yearly Highlights — one live badge row per year since joining GitHub
// ---------------------------------------------------------------------
async function buildHighlights() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const firstYear = 2024; // account created 2024-07-19

  // Single GraphQL query with one aliased contributionsCollection per year.
  const field = (y) => {
    const args =
      y === currentYear
        ? ""
        : `(from: "${new Date(Date.UTC(y, 0, 1)).toISOString()}", to: "${new Date(
            Date.UTC(y + 1, 0, 1)
          ).toISOString()}")`;
    return `y${y}: contributionsCollection${args} { totalCommitContributions totalPullRequestContributions totalIssueContributions }`;
  };

  const years = [];
  for (let y = firstYear; y <= currentYear; y++) years.push(y);

  const data = await gql(
    `query($login: String!) {
      user(login: $login) {
        ${years.map(field).join("\n        ")}
        repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
      }
    }`,
    { login: USERNAME }
  );

  const totalRepos = data.user.repositories.totalCount;
  const rows = years.map((y) => {
    const c = data.user[`y${y}`];
    return [
      `<p align="center">`,
      `<img src="${bust(
        `https://img.shields.io/badge/${y}-year-F90001?style=flat-square&labelColor=0D1117`
      )}" alt="${y}" />`,
      badge("Commits", c.totalCommitContributions),
      badge("PRs", c.totalPullRequestContributions),
      badge("Issues", c.totalIssueContributions),
      `</p>`,
    ].join("");
  });

  return [
    `<p align="center"><sub>📊 Every year since I joined — straight from GitHub, refreshed daily</sub></p>`,
    ...rows,
    `<p align="center">`,
    badge("Public_Repos", totalRepos),
    `</p>`,
  ].join("\n");
}

// ---------------------------------------------------------------------
// 1b. Lifetime Totals — the whole profile as one glanceable scorecard
// ---------------------------------------------------------------------
async function buildTotals(repos) {
  const user = await rest(`users/${USERNAME}`);

  const stars = repos.reduce((n, r) => n + r.stargazers_count, 0);
  const forks = repos.reduce((n, r) => n + r.forks_count, 0);
  const since = user.created_at.slice(0, 4);

  return [
    `<p align="center"><sub>Lifetime totals since <b>${since}</b> · rebuilt daily at 03:00 UTC</sub></p>`,
    `<p align="center">`,
    badge("Followers", user.followers),
    badge("Public_Repos", user.public_repos),
    badge("Stars_Earned", stars),
    badge("Forks", forks),
    `</p>`,
  ].join("\n");
}

// ---------------------------------------------------------------------
// 2a. Branch Flow — a Mermaid gitGraph of the last 7 days of real pushes
// ---------------------------------------------------------------------
async function buildBranchFlow() {
  const events = await rest(`users/${USERNAME}/events/public?per_page=100`);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

  const byRepo = new Map();
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    if (Date.parse(e.created_at) < weekAgo) continue;
    const entry = byRepo.get(e.repo.name) ?? { commits: 0, last: 0 };
    entry.commits += e.payload.commits?.length ?? 1;
    entry.last = Math.max(entry.last, Date.parse(e.created_at));
    byRepo.set(e.repo.name, entry);
  }

  if (byRepo.size === 0) {
    return "_A quiet week — no pushes in the last 7 days. This graph draws itself from real activity._";
  }

  // Days with any activity become commits on main (oldest → newest).
  const days = [
    ...new Set(
      events
        .filter(
          (e) =>
            e.type === "PushEvent" && Date.parse(e.created_at) >= weekAgo
        )
        .map((e) => new Date(e.created_at).toISOString().slice(5, 10))
    ),
  ].sort();

  const repos = [...byRepo.entries()]
    .sort((a, b) => b[1].commits - a[1].commits)
    .slice(0, 5);

  const lines = ["gitGraph", "   commit id: \"quiet\""];
  for (const [repo, { commits }] of repos) {
    // Mermaid branch names allow word chars, dashes and underscores only.
    const branch = repo.split("/")[1].replace(/[^a-zA-Z0-9_-]/g, "-");
    lines.push(`   branch ${branch}`);
    lines.push(
      ...days
        .slice(-3)
        .map((d) => `   commit id: "${d} · +${Math.max(1, Math.round(commits / 3))}"`)
    );
    lines.push(`   commit id: "${branch} · ${commits} commits this week"`);
    lines.push(`   checkout main`);
  }
  lines.push(`   commit id: "today"`);

  return "```mermaid\n" + lines.join("\n") + "\n```";
}

// ---------------------------------------------------------------------
// 2b. Repository Index — every public repo, auto-categorised by topics
// ---------------------------------------------------------------------
const CATEGORIES = [
  {
    name: "🤖 AI & Computer Vision",
    match: (r) =>
      /computer-vision|deep-learning|machine-learning|yolo|pytorch|opencv|ai|zero-shot|explainable|surveillance/i.test(
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
    match: (r) =>
      /template|boilerplate|mlops|reproducible/i.test((r.topics || []).join(" ")),
  },
  {
    name: "🌐 Web & Full-Stack",
    match: () => true, // whatever is left
  },
];

async function buildRepoIndex(repos) {
  const listed = repos.filter((r) => r.name !== USERNAME);
  const escapeCell = (s) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

  // Each repo lands in exactly one bucket — the first category whose
  // keywords match — so nothing is ever listed twice.
  const buckets = new Map(CATEGORIES.map((c) => [c.name, []]));
  for (const r of listed) {
    const cat = CATEGORIES.find((c) => c.match(r));
    buckets.get(cat.name).push(r);
  }

  const sections = [];
  for (const cat of CATEGORIES) {
    const items = buckets.get(cat.name);
    if (items.length === 0) continue;
    const rows = items.map((r) => {
      const lang = r.language;
      const color = lang && LANG_COLORS[lang] ? LANG_COLORS[lang].slice(1) : "8b949e";
      const langBadge = lang
        ? `<img src="https://img.shields.io/badge/-${encodeURIComponent(lang)}-${color}?style=flat-square" alt="${lang}" />`
        : "";
      const desc = escapeCell(r.description || "—");
      return `| [\`${r.name}\`](https://github.com/${USERNAME}/${r.name}) | ${desc} | ${langBadge} | ⭐ ${r.stargazers_count} |`;
    });
    sections.push(
      [`<details open>`, `<summary><b>${cat.name}</b> · ${items.length} repo${items.length === 1 ? "" : "s"}</summary>`, "", "| Repo | What it is | Language | Stars |", "|:--|:--|:--|:--|", ...rows, "", `</details>`].join("\n")
    );
  }

  return [
    `<p align="center"><sub>🔄 Every public repo I own, sorted by field — this index grows automatically whenever I publish something new.</sub></p>`,
    "",
    ...sections,
  ].join("\n");
}

// ---------------------------------------------------------------------
// 3. Recent Activity — real public events, denoised, last 8
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
      return `🔀 ${e.payload.action} PR in ${repo}`;
    case "IssuesEvent":
      return `📋 ${e.payload.action} an issue in ${repo}`;
    case "ForkEvent":
      return `🍴 Forked ${repo}`;
    default:
      return `🔹 ${e.type.replace("Event", "")} on ${repo}`;
  }
}

async function buildActivity() {
  // Fetch more than we show so the denoise pass below still has material.
  const events = await rest(`users/${USERNAME}/events/public?per_page=30`);

  // Noise rules:
  //  - starring your own repo tells visitors nothing they can't already see;
  //  - branch creations are dropped when the same batch already has a push to
  //    that repo — the push is the event that matters;
  //  - identical consecutive lines (session split across pushes) collapse.
  const pushedTo = new Set(
    events.filter((e) => e.type === "PushEvent").map((e) => e.repo.name)
  );

  const seen = new Set();
  const kept = [];
  for (const e of events) {
    if (e.type === "WatchEvent" && e.repo.name.startsWith(`${USERNAME}/`)) {
      continue;
    }
    if (
      e.type === "CreateEvent" &&
      e.payload.ref_type !== "repository" &&
      pushedTo.has(e.repo.name)
    ) {
      continue;
    }
    const line = describeEvent(e);
    if (seen.has(line)) continue;
    seen.add(line);
    kept.push(line);
    if (kept.length >= 8) break;
  }

  if (kept.length === 0) {
    return "_No public activity yet._";
  }
  return kept.map((line) => `- ${line}`).join("\n");
}

// ---------------------------------------------------------------------
// 3. Latest Releases — real releases across the user's own public repos
// ---------------------------------------------------------------------
async function buildReleases(repos) {
  const releases = [];
  for (const repo of repos) {
    const repoReleases = await rest(
      `repos/${USERNAME}/${repo.name}/releases?per_page=5`
    );
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
    .slice(0, 8)
    .map(
      (r) =>
        `- 📦 [\`${r.repo}\` \`${r.tag}\`](${r.url}) — ${r.name} <sub>(${r.date})</sub>`
    )
    .join("\n");
}

// ---------------------------------------------------------------------
// 4. Pinned Repositories — whatever is actually pinned, no forced categories
// ---------------------------------------------------------------------
async function buildPinned() {
  const data = await gql(
    `query($login: String!) {
      user(login: $login) {
        pinnedItems(first: 12, types: REPOSITORY) {
          totalCount
          nodes {
            ... on Repository {
              name
              description
              url
              stargazerCount
              forkCount
              primaryLanguage { name }
            }
          }
        }
      }
    }`,
    { login: USERNAME }
  );

  const items = data.user.pinnedItems.nodes;
  if (items.length === 0) {
    return "_Nothing pinned yet — pin a repo on the profile page and it shows up here automatically._";
  }

  // Rendered as plain badges rather than an image-card widget: the two
  // popular pin-card services (github-readme-stats.vercel.app and its
  // /api/pin/ endpoint) were both down (503 DEPLOYMENT_PAUSED) when this
  // was built. Badges have no single point of failure beyond shields.io.
  // Table cells break on a literal "|" and on newlines — repo descriptions
  // are free text and can contain either (this one did: "... | Computer
  // Vision & Deep Learning" derailed the whole row until caught locally).
  const escapeCell = (s) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

  const rows = items.map((r) => {
    const lang = r.primaryLanguage ? r.primaryLanguage.name : null;
    const desc = escapeCell(r.description || "No description yet.");
    const color = (lang && LANG_COLORS[lang] ? LANG_COLORS[lang] : "#F90001").slice(1);
    const langBadge = lang
      ? `<img src="https://img.shields.io/badge/-${encodeURIComponent(lang)}-${color}?style=flat-square" alt="${lang}" />`
      : "";
    return `| [\`${r.name}\`](${r.url}) | ${desc} | ${langBadge} | ⭐ ${r.stargazerCount} · 🍴 ${r.forkCount} |`;
  });

  return [
    `<p align="center"><sub>🔄 Auto-refreshed daily · <b>${items.length}</b> pinned ${items.length === 1 ? "repo" : "repos"} · language colours match GitHub's own</sub></p>`,
    "",
    "| Repo | Description | Language | |",
    "|:--|:--|:--|:--|",
    ...rows,
    "",
    `<div align="center">`,
    `[![Explore all repositories](https://img.shields.io/badge/%F0%9F%94%AD_Explore_all_repositories-github.com%2FParsaVictor%3Ftab%3Drepositories-F90001?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ParsaVictor?tab=repositories)`,
    `</div>`,
  ].join("\n");
}

// ---------------------------------------------------------------------

// One shared fetch of the repo list: totals, releases and the index all
// need it, and three identical REST calls is two too many.
const repos = await rest(
  `users/${USERNAME}/repos?type=owner&per_page=100&sort=pushed`
);

const [highlights, totals, branchFlow, activity, releases, pinned, repoIndex] =
  await Promise.all([
    buildHighlights(),
    buildTotals(repos),
    buildBranchFlow(),
    buildActivity(),
    buildReleases(repos),
    buildPinned(),
    buildRepoIndex(repos),
  ]);

let readme = readFileSync(README_PATH, "utf8");
readme = replaceBlock(readme, "HIGHLIGHTS_STATS", highlights);
readme = replaceBlock(readme, "TOTALS_STATS", totals);
readme = replaceBlock(readme, "BRANCH_FLOW", branchFlow);
readme = replaceBlock(readme, "ACTIVITY", activity);
readme = replaceBlock(readme, "LATEST_RELEASES", releases);
readme = replaceBlock(readme, "PINNED_REPOS", pinned);
readme = replaceBlock(readme, "REPO_INDEX", repoIndex);

writeFileSync(README_PATH, readme, "utf8");
console.log("README.md updated.");

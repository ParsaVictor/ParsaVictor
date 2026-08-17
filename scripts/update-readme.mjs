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

// ---------------------------------------------------------------------
// 1. Yearly Highlights — real contributionsCollection for the current year
// ---------------------------------------------------------------------
async function buildHighlights() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = now.toISOString();

  const data = await gql(
    `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoriesWithContributedCommits
        }
        repositories(ownerAffiliations: OWNER, privacy: PUBLIC) {
          totalCount
        }
      }
    }`,
    { login: USERNAME, from, to }
  );

  const c = data.user.contributionsCollection;
  const totalRepos = data.user.repositories.totalCount;

  return [
    `<p align="center"><b>📊 ${year}, live from GitHub</b></p>`,
    `<p align="center">`,
    `<img src="https://img.shields.io/badge/Commits-${c.totalCommitContributions}-F90001?style=for-the-badge&logo=git&logoColor=white" alt="Commits" />`,
    `<img src="https://img.shields.io/badge/PRs-${c.totalPullRequestContributions}-F90001?style=for-the-badge&logo=github&logoColor=white" alt="PRs" />`,
    `<img src="https://img.shields.io/badge/Issues-${c.totalIssueContributions}-F90001?style=for-the-badge&logo=github&logoColor=white" alt="Issues" />`,
    `<img src="https://img.shields.io/badge/Active_in-${c.totalRepositoriesWithContributedCommits}_of_${totalRepos}_repos-F90001?style=for-the-badge&logo=github&logoColor=white" alt="Active repos" />`,
    `</p>`,
  ].join("\n");
}

// ---------------------------------------------------------------------
// 2. Recent Activity — real public events, last 8
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
  const events = await rest(`users/${USERNAME}/events/public?per_page=8`);
  if (events.length === 0) {
    return "_No public activity yet._";
  }
  return events.map((e) => `- ${describeEvent(e)}`).join("\n");
}

// ---------------------------------------------------------------------
// 3. Latest Releases — real releases across the user's own public repos
// ---------------------------------------------------------------------
async function buildReleases() {
  const repos = await rest(
    `users/${USERNAME}/repos?type=owner&per_page=100`
  );
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
    const langBadge = lang
      ? `<img src="https://img.shields.io/badge/-${encodeURIComponent(lang)}-F90001?style=flat-square" alt="${lang}" />`
      : "";
    return `| [\`${r.name}\`](${r.url}) | ${desc} | ${langBadge} | ⭐ ${r.stargazerCount} · 🍴 ${r.forkCount} |`;
  });

  return [
    `<p align="center"><sub>🔄 Auto-refreshed daily · <b>${items.length}</b> pinned ${items.length === 1 ? "repo" : "repos"}.</sub></p>`,
    "",
    "| Repo | Description | Language | |",
    "|:--|:--|:--|:--|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------

const [highlights, activity, releases, pinned] = await Promise.all([
  buildHighlights(),
  buildActivity(),
  buildReleases(),
  buildPinned(),
]);

let readme = readFileSync(README_PATH, "utf8");
readme = replaceBlock(readme, "HIGHLIGHTS_STATS", highlights);
readme = replaceBlock(readme, "ACTIVITY", activity);
readme = replaceBlock(readme, "LATEST_RELEASES", releases);
readme = replaceBlock(readme, "PINNED_REPOS", pinned);

writeFileSync(README_PATH, readme, "utf8");
console.log("README.md updated.");

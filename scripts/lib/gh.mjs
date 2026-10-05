// Tiny GitHub API helpers shared by the asset generators.
// Uses the workflow's own GITHUB_TOKEN — no third-party services. The token
// is only required by the functions that call the API, so token-free
// generators (nav chips, code card) can still import the shared constants.

export const USERNAME = process.env.PROFILE_USER || "ParsaVictor";

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) {
    console.error("GITHUB_TOKEN is not set");
    process.exit(1);
  }
  return t;
}

export async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

export async function rest(path) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `bearer ${token()}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Shared palette so every generated card reads as one system.
export const C = {
  bg: "#0D1117",
  panel: "#140A0D",
  edge: "#3A1218",
  red: "#F90001",
  coral: "#FF6B57",
  peach: "#FFC2B8",
  text: "#FFF5F0",
  dim: "#9A6A64",
  gold: "#FFB000",
};

export const MONO = `"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace`;

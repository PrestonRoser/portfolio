// Saves recent commits and language stats to src/data/github-snapshot.json so
// the GitHub tiles have something to render before the live API responds.
//
// This deliberately sends no credentials; the token only exists inside the
// Worker. It asks the live site's API first (already cached, no rate limit),
// then GitHub directly. Anonymous GitHub requests are capped at 60/hour per IP
// and CI machines share IPs, so if both fail we keep the last snapshot (or write
// an empty one) rather than failing the build.
import { existsSync, statSync, writeFileSync } from "node:fs";
import config from "../src/data/github.json" with { type: "json" };
import { buildPayload } from "../worker/github.js";

const OUT = new URL("../src/data/github-snapshot.json", import.meta.url);
const SITE_API = "https://prestonroser.dev/api/github";
const MAX_AGE_MS = 10 * 60 * 1000;

if (existsSync(OUT) && Date.now() - statSync(OUT).mtimeMs < MAX_AGE_MS) process.exit(0);

async function getJson(url, headers) {
  const res = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

async function fromSite() {
  const data = await getJson(SITE_API, { accept: "application/json" });
  // Same shape the Worker produces, but check it again rather than trust it.
  const commits = (Array.isArray(data.commits) ? data.commits : [])
    .filter(
      (c) =>
        config.repos.includes(c?.repo) &&
        /^[0-9a-f]{7}$/.test(c.sha) &&
        typeof c.message === "string" &&
        Number.isSafeInteger(c.additions) &&
        Number.isSafeInteger(c.deletions) &&
        !Number.isNaN(Date.parse(c.date)) &&
        typeof c.url === "string" &&
        c.url.startsWith(`https://github.com/${config.owner}/`),
    )
    .map(({ repo, sha, message, additions, deletions, date, url }) => ({
      repo,
      sha,
      message: message.slice(0, 120),
      additions,
      deletions,
      date,
      url,
    }));
  if (commits.length === 0) throw new Error("the site API had no commits");

  const languages = (Array.isArray(data.languages) ? data.languages : [])
    .filter((l) => typeof l?.name === "string" && typeof l.percent === "number")
    .map(({ name, percent }) => ({ name, percent }));

  return { commits, languages, fetchedAt: new Date().toISOString() };
}

async function fromGitHub() {
  const headers = { accept: "application/vnd.github+json", "user-agent": "prestonroser.dev build" };
  const api = (path) => getJson(`https://api.github.com${path}`, headers);

  const repos = [];
  for (const repo of config.repos) {
    const list = await api(`/repos/${config.owner}/${repo}/commits?per_page=${config.commits}`);
    const commits = [];
    for (const item of list.slice(0, config.commits)) {
      const detail = await api(`/repos/${config.owner}/${repo}/commits/${item.sha}`);
      commits.push({
        oid: detail.sha,
        messageHeadline: String(detail.commit?.message ?? "").split("\n")[0],
        committedDate: detail.commit?.committer?.date,
        additions: detail.stats?.additions,
        deletions: detail.stats?.deletions,
      });
    }
    const languages = Object.entries(await api(`/repos/${config.owner}/${repo}/languages`));
    repos.push({ repo, commits, languages });
  }
  return buildPayload(repos, Date.now());
}

const save = (data) => writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);

try {
  save(await fromSite());
  console.log("github: snapshot updated from prestonroser.dev");
} catch (siteError) {
  try {
    save(await fromGitHub());
    console.log("github: snapshot updated from GitHub");
  } catch (githubError) {
    const hadSnapshot = existsSync(OUT);
    if (!hadSnapshot) save({ commits: [], languages: [], fetchedAt: null });
    console.warn(
      `github: snapshot not refreshed (${siteError.message}; ${githubError.message}), using the ${hadSnapshot ? "previous" : "empty"} one`,
    );
  }
}

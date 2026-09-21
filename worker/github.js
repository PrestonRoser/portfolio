/**
 * GET /api/github: recent commits and a language breakdown for the home page.
 *
 * The GitHub token lives in env.GITHUB_TOKEN and must never end up in a
 * response, so a few rules hold everywhere in this file:
 *
 *   - nothing from the incoming request is used to build the GitHub call
 *   - responses are rebuilt from validated fields, never passed through
 *   - anything that looks like a token blocks the response and the cache write
 *   - no dependencies, so no other code runs with access to env
 */
import config from "../src/data/github.json" with { type: "json" };

export const ROUTE = "/api/github";

const FRESH_SECONDS = 600;
const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_UPSTREAM_BYTES = 1_000_000;
const TOKEN_SHAPE = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
const FRAGMENT_LENGTH = 16;
const RECENT_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

if (
  !/^[A-Za-z0-9-]{1,39}$/.test(config.owner) ||
  !Array.isArray(config.repos) ||
  !config.repos.every((repo) => /^[A-Za-z0-9._-]{1,100}$/.test(repo))
) {
  throw new Error("src/data/github.json: invalid owner or repo name");
}

const COMMIT_LIMIT = Number.isInteger(config.commits)
  ? Math.min(Math.max(config.commits, 1), 20)
  : 5;

const QUERY = `query{${config.repos
  .map(
    (repo, i) =>
      `r${i}:repository(owner:"${config.owner}",name:"${repo}"){` +
      `defaultBranchRef{target{...on Commit{history(first:${COMMIT_LIMIT}){nodes{oid messageHeadline committedDate additions deletions}}}}}` +
      `languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}`,
  )
  .join("")}}`;

const EMPTY = Object.freeze({ commits: [], languages: [], fetchedAt: null });

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

/** Dependencies are passed in so the tests can swap in fakes. */
export async function handle(request, deps) {
  const { pathname } = new URL(request.url);

  if (!pathname.startsWith("/api/")) {
    return deps.assets ? deps.assets.fetch(request) : new Response("Not found", { status: 404 });
  }
  if (pathname !== ROUTE) return fixed(404, { error: "not found" });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return fixed(405, { error: "method not allowed" }, { allow: "GET, HEAD" });
  }

  const token = deps.env?.GITHUB_TOKEN;
  const cacheKey = new Request(new URL(ROUTE, request.url).href);
  const cached = await readCache(deps.cache, cacheKey);

  if (cached && deps.now() - Date.parse(cached.fetchedAt) < FRESH_SECONDS * 1000) {
    return respond(request.method, cached, { stale: false, token });
  }
  if (cached) {
    deps.ctx?.waitUntil?.(refresh(deps, token, cacheKey));
    return respond(request.method, cached, { stale: true, token });
  }

  const fresh = await refresh(deps, token, cacheKey);
  return fresh
    ? respond(request.method, fresh, { stale: false, token })
    : respond(request.method, EMPTY, { stale: true, status: 503, token });
}

/** Validates and reshapes commit and language data. Shared with scripts/github-snapshot.mjs. */
export function buildPayload(repos, now) {
  const commits = [];
  const bytes = new Map();

  for (const { repo, commits: rawCommits, languages } of repos) {
    if (!config.repos.includes(repo)) continue;

    for (const c of Array.isArray(rawCommits) ? rawCommits : []) {
      const sha = typeof c?.oid === "string" && /^[0-9a-f]{40}$/.test(c.oid) ? c.oid : null;
      const time = typeof c?.committedDate === "string" ? Date.parse(c.committedDate) : Number.NaN;
      if (!sha || Number.isNaN(time)) continue;
      commits.push({
        repo,
        sha: sha.slice(0, 7),
        message: cleanText(c.messageHeadline, 120),
        additions: count(c.additions),
        deletions: count(c.deletions),
        date: new Date(time).toISOString(),
        url: `https://github.com/${config.owner}/${repo}/commit/${sha}`,
      });
    }

    for (const [name, size] of Array.isArray(languages) ? languages : []) {
      if (typeof name !== "string" || !/^[\w#+.\- ]{1,40}$/.test(name)) continue;
      bytes.set(name, (bytes.get(name) ?? 0) + count(size));
    }
  }

  const measured = [...bytes].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = measured.reduce((sum, [, n]) => sum + n, 0);

  return {
    commits: pickCommits(commits, now),
    languages: measured
      .slice(0, 6)
      .map(([name, n]) => ({ name, percent: Math.round((n / total) * 1000) / 10 })),
    fetchedAt: new Date(now).toISOString(),
  };
}

/**
 * Chooses which commits the tile shows, newest first.
 *
 * If only one repo has commits from the last RECENT_DAYS days, it gets every
 * slot. If several do, the repo with the newest commit keeps half the slots
 * (rounded up) and the rest go round-robin to the other recent repos, newest
 * repo first. Older commits only fill slots that would otherwise be empty.
 */
export function pickCommits(commits, now, limit = COMMIT_LIMIT) {
  const sorted = [...commits].sort((a, b) => b.date.localeCompare(a.date));
  const cutoff = now - RECENT_DAYS * DAY_MS;

  // Map keeps insertion order, so repos end up ordered by their newest commit.
  const recent = new Map();
  for (const commit of sorted) {
    if (Date.parse(commit.date) < cutoff) continue;
    if (!recent.has(commit.repo)) recent.set(commit.repo, []);
    recent.get(commit.repo).push(commit);
  }
  const [lead = [], ...others] = recent.values();

  const picked = lead.slice(0, others.length > 0 ? Math.ceil(limit / 2) : limit);
  for (let i = 0; picked.length < limit; i += 1) {
    const round = others.map((list) => list[i]).filter(Boolean);
    if (round.length === 0) break;
    picked.push(...round.slice(0, limit - picked.length));
  }
  for (const commit of sorted) {
    if (picked.length >= limit) break;
    if (!picked.includes(commit)) picked.push(commit);
  }

  return picked.sort((a, b) => b.date.localeCompare(a.date));
}

function fromGraphQL(json, now) {
  return buildPayload(
    config.repos.map((repo, i) => {
      const node = json?.data?.[`r${i}`];
      return {
        repo,
        commits: node?.defaultBranchRef?.target?.history?.nodes,
        languages: (node?.languages?.edges ?? []).map((edge) => [edge?.node?.name, edge?.size]),
      };
    }),
    now,
  );
}

async function refresh(deps, token, cacheKey) {
  if (typeof token !== "string" || token.length === 0) return null;

  let payload;
  try {
    const upstream = await deps.fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "prestonroser.dev",
      },
      body: JSON.stringify({ query: QUERY }),
      // Never follow a redirect while carrying the token. Workers only support
      // "follow" and "manual", so a redirect comes back as a 3xx and fails the ok check.
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      console.warn(`api/github: upstream status ${upstream.status}`);
      return null;
    }
    if (Number(upstream.headers.get("content-length")) > MAX_UPSTREAM_BYTES) {
      console.warn("api/github: upstream response too large");
      return null;
    }
    const text = await upstream.text();
    if (text.length > MAX_UPSTREAM_BYTES) {
      console.warn("api/github: upstream response too large");
      return null;
    }
    payload = fromGraphQL(JSON.parse(text), deps.now());
  } catch {
    // The error is deliberately not logged or returned: its message is not ours to trust.
    console.warn("api/github: upstream request failed");
    return null;
  }

  const body = JSON.stringify(payload);
  if (leaks(body, token)) {
    console.error("api/github: upstream data blocked by leak check");
    return null;
  }
  try {
    await deps.cache.put(
      cacheKey,
      new Response(body, {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
      }),
    );
  } catch {
    console.warn("api/github: cache write failed");
  }
  return payload;
}

async function readCache(cache, key) {
  try {
    const hit = await cache.match(key);
    if (!hit) return null;
    const data = await hit.json();
    return typeof data?.fetchedAt === "string" ? data : null;
  } catch {
    return null;
  }
}

function respond(method, payload, { stale, status = 200, token }) {
  let body = JSON.stringify({ ...payload, stale });
  if (leaks(body, token)) {
    console.error("api/github: response blocked by leak check");
    body = JSON.stringify({ ...EMPTY, stale: true });
    status = 503;
  }
  return new Response(method === "HEAD" ? null : body, { status, headers: HEADERS });
}

function fixed(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...HEADERS, "cache-control": "no-store", ...extraHeaders },
  });
}

function leaks(text, token) {
  if (TOKEN_SHAPE.test(text)) return true;
  if (typeof token !== "string" || token.length === 0) return false;
  if (token.length < FRAGMENT_LENGTH) return text.includes(token);
  for (let i = 0; i + FRAGMENT_LENGTH <= token.length; i += 1) {
    if (text.includes(token.slice(i, i + FRAGMENT_LENGTH))) return true;
  }
  return false;
}

function count(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, " ")
    .trim()
    .slice(0, max);
}

export interface Commit {
  repo: string;
  sha: string;
  message: string;
  additions: number;
  deletions: number;
  date: string;
  url: string;
}

export interface Language {
  name: string;
  percent: number;
}

export interface Activity {
  commits: Commit[];
  languages: Language[];
  fetchedAt: string | null;
  stale: boolean;
}

const REFRESH_MS = 5 * 60 * 1000;

let request: Promise<Activity | null> | null = null;
let requestedAt = 0;

// Both GitHub tiles call this, so they share one request per page (and at
// most one every five minutes after that).
export function loadActivity(): Promise<Activity | null> {
  if (!request || Date.now() - requestedAt > REFRESH_MS) {
    requestedAt = Date.now();
    request = fetch("/api/github", { headers: { accept: "application/json" } })
      .then((res) => (res.ok || res.status === 503 ? res.json() : null))
      .then(parseActivity)
      .catch(() => null);
  }
  return request;
}

const commitDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export const formatCommitDate = (iso: string) => commitDate.format(new Date(iso));

const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

function isCommit(value: unknown): value is Commit {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isString(c.repo) &&
    isString(c.sha) &&
    isString(c.message) &&
    isCount(c.additions) &&
    isCount(c.deletions) &&
    isString(c.date) &&
    !Number.isNaN(Date.parse(c.date)) &&
    isString(c.url) &&
    c.url.startsWith("https://github.com/")
  );
}

function isLanguage(value: unknown): value is Language {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return isString(l.name) && typeof l.percent === "number" && l.percent >= 0 && l.percent <= 100;
}

function parseActivity(data: unknown): Activity | null {
  if (typeof data !== "object" || data === null) return null;
  const { commits, languages, fetchedAt, stale } = data as Record<string, unknown>;
  if (!Array.isArray(commits) || !Array.isArray(languages)) return null;
  return {
    commits: commits.filter(isCommit),
    languages: languages.filter(isLanguage),
    fetchedAt: isString(fetchedAt) ? fetchedAt : null,
    stale: stale !== false,
  };
}

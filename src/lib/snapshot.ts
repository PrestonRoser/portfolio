import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Activity } from "./github";

const EMPTY: Activity = { commits: [], languages: [], fetchedAt: null, stale: true };

// scripts/github-snapshot.mjs writes this before dev and build. The GitHub
// tiles render it as plain HTML, then refresh from /api/github in the browser.
export function readSnapshot(): Activity {
  const file = join(process.cwd(), "src/data/github-snapshot.json");
  if (!existsSync(file)) return EMPTY;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return {
      commits: Array.isArray(data.commits) ? data.commits : [],
      languages: Array.isArray(data.languages) ? data.languages : [],
      fetchedAt: typeof data.fetchedAt === "string" ? data.fetchedAt : null,
      stale: true,
    };
  } catch {
    return EMPTY;
  }
}

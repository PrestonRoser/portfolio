import { execSync } from "node:child_process";

function git(args: string) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// Shown in the footer so it's obvious which build is live.
export const buildCommitSha = git("rev-parse HEAD");
export const buildCommit = buildCommitSha.slice(0, 7);

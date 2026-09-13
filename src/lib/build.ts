import { execSync } from "node:child_process";

function shortCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// Shown in the footer so it's obvious which build is live.
export const buildCommit = shortCommit();

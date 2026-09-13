<script lang="ts">
  import { onMount } from "svelte";
  import { formatCommitDate, loadActivity, type Commit } from "../lib/github";

  let { commits, profile }: { commits: Commit[]; profile: string } = $props();

  let fresh = $state<Commit[] | null>(null);
  let live = $state(false);
  const shown = $derived(fresh ?? commits);

  onMount(() => {
    const refresh = async () => {
      const activity = await loadActivity();
      if (!activity || activity.commits.length === 0) return;
      fresh = activity.commits;
      live = !activity.stale;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });
</script>

<div class="flex items-center justify-between gap-2">
  <h2 class="t-label">Recent commits</h2>
  <span class="pill" data-state={live ? "live" : "cached"}>{live ? "Live" : "Cached"}</span>
</div>

{#if shown.length === 0}
  <p class="mt-4 text-small text-subtext1">Commit history isn't available right now.</p>
{:else}
  <ul class="mt-4 flex flex-col gap-3">
    {#each shown as commit (commit.url)}
      <li class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-small">
        <a
          class="min-w-0 truncate transition-colors hover:text-text"
          href={commit.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="font-code text-accent-ink">{commit.repo}</span>
          <span class="text-subtext1">{commit.message}</span>
        </a>
        <span class="font-code text-[0.8125rem] tabular-nums">
          <span class="text-ink-green">+{commit.additions}</span>
          <span class="text-ink-red">−{commit.deletions}</span>
        </span>
        <span class="col-span-2 font-code text-[0.75rem] text-subtext0">
          {commit.sha} · {formatCommitDate(commit.date)}
        </span>
      </li>
    {/each}
  </ul>
{/if}

<a
  class="link mt-5 inline-block text-small"
  href={profile}
  target="_blank"
  rel="noopener noreferrer"
>
  More on GitHub
</a>

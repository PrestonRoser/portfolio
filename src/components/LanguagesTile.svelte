<script lang="ts">
  import { onMount } from "svelte";
  import { loadActivity, type Language } from "../lib/github";

  let { languages }: { languages: Language[] } = $props();

  const COLORS = ["blue", "peach", "green", "mauve", "yellow", "teal"];

  let fresh = $state<Language[] | null>(null);
  const shown = $derived(fresh ?? languages);

  onMount(() => {
    loadActivity().then((activity) => {
      if (activity && activity.languages.length > 0) fresh = activity.languages;
    });
  });

  const color = (i: number) => `var(--ctp-${COLORS[i % COLORS.length]})`;
</script>

<h2 class="t-label">Languages</h2>

{#if shown.length === 0}
  <p class="mt-4 text-small text-subtext1">Language stats aren't available right now.</p>
{:else}
  <div
    class="langbar mt-5"
    role="img"
    aria-label={shown.map((l) => `${l.name} ${l.percent}%`).join(", ")}
  >
    {#each shown as language, i (language.name)}
      <span style:width="{language.percent}%" style:background-color={color(i)}></span>
    {/each}
  </div>
  <ul class="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-small">
    {#each shown as language, i (language.name)}
      <li class="flex items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-2.5 flex-none rounded-full" style:background-color={color(i)}></span>
          <span class="truncate">{language.name}</span>
        </span>
        <span class="font-code tabular-nums text-subtext0">{language.percent}%</span>
      </li>
    {/each}
  </ul>
{/if}

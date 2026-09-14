<script lang="ts">
  import { onMount } from "svelte";
  import { ACCENTS, FLAVORS, type Accent, type Flavor } from "../data/site";

  type FlavorChoice = Flavor | "system";
  type AccentChoice = Accent | "rolling";

  const FLAVOR_OPTIONS: { value: FlavorChoice; label: string }[] = [
    { value: "system", label: "System" },
    { value: "latte", label: "Latte" },
    { value: "frappe", label: "Frappé" },
    { value: "macchiato", label: "Macchiato" },
    { value: "mocha", label: "Mocha" },
  ];

  const SWATCH =
    "block size-5 rounded-full ring-offset-2 ring-offset-mantle peer-checked:ring-2 peer-checked:ring-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent-ink";

  let open = $state(false);
  let picker = $state<HTMLDivElement>();
  let flavor = $state<FlavorChoice>("system");
  let accent = $state<AccentChoice>("rolling");

  // The inline script in Layout.astro has already applied the saved flavour and
  // either the saved accent or this visit's roll; read back which is in effect.
  onMount(() => {
    const root = document.documentElement;
    flavor = FLAVORS.find((f) => root.classList.contains(f)) ?? "system";
    const saved = read("accent");
    accent = ACCENTS.find((a) => a === saved) ?? "rolling";
  });

  function read(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function remember(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage is blocked: the choice lasts until the page is closed.
    }
  }

  function setFlavor(next: FlavorChoice) {
    const root = document.documentElement;
    const apply = () => {
      root.classList.remove(...FLAVORS);
      if (next !== "system") root.classList.add(next);
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(apply);
    else apply();
    flavor = next;
    remember("flavor", next === "system" ? null : next);
  }

  function setAccent(next: AccentChoice) {
    const root = document.documentElement;
    if (next === "rolling") {
      // Roll straight away so the choice visibly does something, then keep that
      // roll for the rest of the visit, as the head script does.
      const pool = ACCENTS.filter((a) => a !== root.dataset.accent);
      const rolled = pool[Math.floor(Math.random() * pool.length)];
      root.dataset.accent = rolled;
      try {
        sessionStorage.setItem("accent-roll", rolled);
        localStorage.setItem("accent-last", rolled);
      } catch {
        // Storage is blocked: the roll lasts until the page is closed.
      }
      remember("accent", null);
    } else {
      root.dataset.accent = next;
      remember("accent", next);
    }
    accent = next;
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") open = false;
  }}
  onpointerdown={(event) => {
    if (open && !picker?.contains(event.target as Node)) open = false;
  }}
/>

<!-- Tabbing past the panel closes it, same as clicking outside. -->
<div
  class="relative"
  bind:this={picker}
  onfocusout={(event) => {
    const next = event.relatedTarget as Node | null;
    if (next && !picker?.contains(next)) open = false;
  }}
>
  <button
    type="button"
    class="flex items-center gap-2 rounded-control border border-surface1 px-2.5 py-1 text-small transition-colors hover:border-accent-ink"
    aria-expanded={open}
    aria-controls="theme-panel"
    onclick={() => (open = !open)}
  >
    <span class="size-3 rounded-full bg-accent" aria-hidden="true"></span>
    Theme
  </button>

  {#if open}
    <div
      id="theme-panel"
      class="absolute right-0 z-40 mt-2 w-72 rounded-tile border border-surface0 bg-mantle p-4 shadow-xl"
    >
      <fieldset>
        <legend class="t-label">Flavor</legend>
        <div
          class="mt-2 flex flex-wrap gap-0.5 rounded-control border border-surface0 bg-base p-0.5"
        >
          {#each FLAVOR_OPTIONS as option (option.value)}
            <label class="cursor-pointer">
              <input
                class="peer sr-only"
                type="radio"
                name="flavor"
                value={option.value}
                checked={flavor === option.value}
                onchange={() => setFlavor(option.value)}
              />
              <span
                class="block rounded-[3px] px-2 py-1 text-small text-subtext0 transition-colors peer-checked:bg-surface0 peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink"
              >
                {option.label}
              </span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="mt-4">
        <legend class="t-label">Accent</legend>
        <div class="mt-2 flex flex-wrap gap-2">
          <label class="cursor-pointer" title="Rolling: a new accent each visit">
            <input
              class="peer sr-only"
              type="radio"
              name="accent"
              value="rolling"
              checked={accent === "rolling"}
              onchange={() => setAccent("rolling")}
            />
            <span
              class={SWATCH}
              style="background: conic-gradient(var(--ctp-red), var(--ctp-peach), var(--ctp-yellow), var(--ctp-green), var(--ctp-sapphire), var(--ctp-mauve), var(--ctp-red))"
            ></span>
            <span class="sr-only">Rolling</span>
          </label>
          {#each ACCENTS as name (name)}
            <label class="cursor-pointer" title={name}>
              <input
                class="peer sr-only"
                type="radio"
                name="accent"
                value={name}
                checked={accent === name}
                onchange={() => setAccent(name)}
              />
              <span class={SWATCH} style={`background-color: var(--ctp-${name})`}></span>
              <span class="sr-only">{name}</span>
            </label>
          {/each}
        </div>
        <p class="mt-2 text-[0.75rem] text-subtext0">
          {accent === "rolling" ? "Rolling: a new accent each visit." : "Saved on this device."}
        </p>
      </fieldset>
    </div>
  {/if}
</div>

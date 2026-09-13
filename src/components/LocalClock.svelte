<script lang="ts">
  import { onMount } from "svelte";

  let { timeZone }: { timeZone: string } = $props();

  let time = $state("");

  onMount(() => {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const tick = () => (time = format.format(new Date()));
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  });
</script>

<span class="inline-block min-w-[9ch] text-right font-code text-small tabular-nums text-subtext0">
  {time}
</span>

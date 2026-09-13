<script lang="ts">
  import { onMount } from "svelte";
  import type { Map } from "leaflet";
  import "leaflet/dist/leaflet.css";

  let { lat, lng, zoom, label }: { lat: number; lng: number; zoom: number; label: string } =
    $props();

  let container: HTMLDivElement;

  onMount(() => {
    let map: Map | undefined;
    let cancelled = false;

    import("leaflet").then(({ default: L }) => {
      if (cancelled) return;

      map = L.map(container, {
        center: [lat, lng],
        zoom,
        minZoom: 6,
        maxZoom: 16,
        zoomControl: false,
        scrollWheelZoom: false,
        // Dragging a map with one finger hijacks page scrolling on phones.
        dragging: !L.Browser.mobile,
      });

      L.control.zoom({ position: "bottomleft" }).addTo(map);
      map.attributionControl.setPrefix(false);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "map-tiles",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.circleMarker([lat, lng], { radius: 7, className: "map-pin", interactive: false }).addTo(
        map,
      );
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  });
</script>

<div bind:this={container} class="map" role="region" aria-label={label}></div>

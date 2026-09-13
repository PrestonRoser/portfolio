import counties from "../data/geo/noco-counties.json";

type Point = number[];
type Ring = Point[];
type Geometry =
  { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

// Colorado's borders run along lines of latitude and longitude, so in a simple
// equirectangular projection the state is just a rectangle. Longitude is
// scaled by cos(39°) to keep its proportions.
const CO = { west: -109.06, east: -102.04, south: 36.99, north: 41.0 };

export const WIDTH = 120;
export const HEIGHT =
  WIDTH * ((CO.north - CO.south) / ((CO.east - CO.west) * Math.cos((39 * Math.PI) / 180)));

export function project([lon, lat]: Point): [number, number] {
  return [
    ((lon - CO.west) / (CO.east - CO.west)) * WIDTH,
    ((CO.north - lat) / (CO.north - CO.south)) * HEIGHT,
  ];
}

const geometries = counties.features.map((feature) => feature.geometry as unknown as Geometry);

// Larimer and Weld counties, which is what most people mean by Northern Colorado.
export const regionPath = geometries
  .flatMap((g) => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat()))
  .map(
    (ring) =>
      `M${ring
        .map((point) =>
          project(point)
            .map((n) => n.toFixed(1))
            .join(" "),
        )
        .join("L")}Z`,
  )
  .join("");

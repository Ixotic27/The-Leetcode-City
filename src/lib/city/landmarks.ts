import type { CityDecoration } from "@/lib/github";

/** Positions of the downtown lots the master plan reserves for the custom landmarks, in plan order. */
export function placeCityLandmarks(decorations: CityDecoration[], count = 16): [number, number, number][] {
  const sites = decorations.filter((d) => d.type === "landmarkSite").map((d) => d.position);
  // Only an empty city has no downtown; park the models on the downtown origin until residents arrive.
  while (sites.length < count) sites.push([500, 0, 500]);
  return sites.slice(0, count);
}

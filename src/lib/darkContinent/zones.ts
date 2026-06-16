// ─── Zone determination ─────────────────────────────────────────
// Zones arranged in a ring: angle determines biome
export const ZONE_COUNT = 6;

export const ZONE_NAMES = [
  "Ancient Jungle",
  "Volcanic Badlands",
  "Frozen Highlands",
  "Void Wastes",
  "World Tree",
  "Desert Ruins",
];

export function getZone(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const normalized = ((angle + Math.PI) / (Math.PI * 2)) * ZONE_COUNT;
  return Math.floor(normalized) % ZONE_COUNT;
}

// Zone angle ranges (for smooth blending)
export function getZoneWeight(x: number, z: number, zone: number): number {
  const angle = ((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * ZONE_COUNT;
  const zoneMid = zone + 0.5;
  const dist = Math.abs(angle - zoneMid);
  const wrapped = Math.min(dist, ZONE_COUNT - dist);
  return Math.max(0, 1 - wrapped * 1.5);
}

// ─── Zone color palettes ────────────────────────────────────────
export const ZONE_PALETTES = {
  jungle: {
    terrain: "#0a2a12", terrainEmissive: "#041a08",
    treeCanopy: ["#1a5a28", "#0d4818", "#22c87a", "#0f3d1a"],
    treeTrunk: "#2a1a08",
    accent: "#22c87a", accentAlt: "#7affb0",
    ruins: "#3a3a30", ruinsEmissive: "#1a1a10",
    mushroom: "#22c87a", mushroomAlt: "#3a1060",
    fog: "#051a0a",
  },
  volcanic: {
    terrain: "#1a0a05", terrainEmissive: "#0a0200",
    lava: "#ff4800", lavaAlt: "#ff8030",
    obsidian: "#1a1a1e", obsidianEmissive: "#0a0505",
    deadTree: "#2a2020",
    accent: "#c84022", accentAlt: "#ff8030",
    forge: "#3d0f00",
    fog: "#0a0505",
  },
  frozen: {
    terrain: "#0a1830", terrainEmissive: "#050c18",
    ice: "#3090e0", iceAlt: "#80d4ff",
    snow: "#c0d8f0", snowEmissive: "#4060a0",
    crystal: "#a0ffcc",
    fortress: "#4a4a58", fortressEmissive: "#1a1a28",
    aurora: ["#30e090", "#3090e0", "#9060e0"],
    fog: "#05080f",
  },
  void: {
    terrain: "#0a0518", terrainEmissive: "#050210",
    island: "#1a1030", islandEmissive: "#0a0818",
    obelisk: "#2a1848", obeliskEmissive: "#9060e0",
    bridge: "#2a2030",
    accent: "#9060e0", accentAlt: "#d4a0ff",
    tear: "#ffffff",
    fog: "#05020f",
  },
  worldTree: {
    trunk: "#2a1a08", trunkEmissive: "#e8a030",
    canopy: ["#40b870", "#2a8040", "#60d080"],
    canopyGlow: "#a0ffc0",
    beacon: "#ffe060",
    roots: "#1a1208",
    houses: "#4a3018",
    fog: "#020a04",
  },
  desert: {
    terrain: "#2a1a04", terrainEmissive: "#1a0e02",
    sand: "#c8900a", sandAlt: "#e0c060",
    pyramid: "#8a6a30", pyramidEmissive: "#4a3a10",
    oasis: "#20b8a0",
    buried: "#3a3040",
    accent: "#ff8800",
    fog: "#0a0804",
  },
};

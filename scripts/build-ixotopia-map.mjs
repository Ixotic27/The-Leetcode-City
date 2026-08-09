// ─────────────────────────────────────────────────────────────
// build-ixotopia-map.mjs
// Regenerates public/pokemon_resources/ixotopia-converted.json from
// the original Tiled map (tuxemon-town.json) so the collision layer
// and tileProperties are derived from the authoritative per-tile
// `collides` flag instead of hand-maintained arrays.
//
// It also:
//   • injects the interactive NPC objects (town residents + quiz master)
//   • repoints the "Return to Overworld" door at the lobby so it doesn't
//     loop back into Ixotopia through the /arcade/overworld redirect
//
// Usage: node scripts/build-ixotopia-map.mjs
// ─────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tmxPath = path.join(root, "public/pokemon_resources/tuxemon-town.json");
const mapPath = path.join(root, "public/pokemon_resources/ixotopia-converted.json");

const tmx = JSON.parse(fs.readFileSync(tmxPath, "utf8"));
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const width = map.width;

// ─── 1. Authoritative per-tile collision from the Tiled tileset ──
const tiles = tmx.tilesets?.[0]?.tiles ?? [];
const collides = new Map();
for (const t of tiles) {
  const prop = (t.properties ?? []).find((p) => p.name === "collides");
  collides.set(t.id, prop ? !!prop.value : false);
}

// ─── 2. tileProperties for every GID used in any tile layer ─────
const usedGids = new Set();
for (const layer of [map.layers.ground, map.layers.world, map.layers.abovePlayer]) {
  for (const g of layer) if (g) usedGids.add(g);
}
const tileProperties = {};
for (const g of usedGids) {
  const c = collides.get(g - 1) ?? false; // converted GIDs are 1-indexed
  tileProperties[String(g)] = { walkable: !c, type: c ? "wall" : "floor" };
}

// ─── 3. Collision = colliding ground ∪ colliding world tiles ────
// Above-player tiles (tree canopies etc.) render OVER players, so
// they intentionally do NOT block movement.
const collision = new Array(map.layers.collision.length).fill(0);
const blockFrom = (layer) => {
  for (let i = 0; i < layer.length; i++) {
    if (layer[i] && collides.get(layer[i] - 1)) collision[i] = 1;
  }
};
blockFrom(map.layers.ground);
blockFrom(map.layers.world);

// ─── 4. Interactive NPCs (town residents) ───────────────────────
const NPCS = [
  {
    id: "mayor",
    type: "npc",
    x: 41,
    y: 37,
    dir: "down",
    label: "Mayor Gupta",
    preset: "mayor",
    dialogue: [
      "Welcome to Ixotopia, wanderer! This town is compiled fresh every sunrise.",
      "Beyond these paths lie the Ponds of Off-by-One and the Grove of Edge Cases.",
      "If you ever feel lost, just remember: every maze is a graph with extra steps.",
      "Pro tip: talk to Prof. Algorithm by the plaza — she has a challenge for you.",
    ],
  },
  {
    id: "quizmaster",
    type: "npc",
    x: 44,
    y: 40,
    dir: "down",
    label: "Prof. Algorithm",
    preset: "quizmaster",
    quiz: "leetcode-quiz",
    dialogue: [
      "Ah, a challenger! I have been waiting to test your LeetCode mettle.",
      "Answer a few questions correctly and I will crown you with the rank you deserve.",
      "Shall we begin?",
    ],
  },
  {
    id: "pondsage",
    type: "npc",
    x: 31,
    y: 40,
    dir: "down",
    label: "Pond Sage",
    preset: "pondsage",
    dialogue: [
      "These waters hold many secrets... mostly memory leaks.",
      "They say the first bug in Ixotopia was a single floating-point error near the fountain.",
      "Careful where you step — the edge cases are sharp.",
      "The pond is always trying to reach its base case.",
    ],
  },
  {
    id: "blacksmith",
    type: "npc",
    x: 40,
    y: 42,
    dir: "down",
    label: "Coder Smith",
    preset: "blacksmith",
    dialogue: [
      "I forge ranks from pure effort. Grind daily and your rating will shine.",
      "My hammer is O(1), but my patience is O(n²).",
      "Come back after a few solves — maybe I will have something for you.",
    ],
  },
  {
    id: "archivist",
    type: "npc",
    x: 47,
    y: 37,
    dir: "down",
    label: "Archivist Ada",
    preset: "archivist",
    dialogue: [
      "I keep the chronicles of every accepted submission in the town hall.",
      "Two Sum was the first legend ever recorded here. Many have walked that path.",
      "The rarest artifact? A solution accepted on the very first try.",
      "Keep exploring — the town hides more than it shows.",
    ],
  },
];

// Every NPC must stand on a walkable tile
for (const npc of NPCS) {
  if (collision[npc.y * width + npc.x] !== 0) {
    throw new Error(
      `NPC "${npc.label}" at (${npc.x},${npc.y}) is on a blocked tile — pick a walkable spot`,
    );
  }
}

// ─── 5. Apply to map ───────────────────────────────────────────
map.tileProperties = tileProperties;
map.layers.collision = collision;

// Keep existing objects (spawn / door) but drop any stale NPCs
map.objects = (map.objects ?? []).filter((o) => o.type !== "npc");
const door = map.objects.find((o) => o.type === "door");
if (door) {
  // The old destination ("overworld") redirects straight back to /arcade/ixotopia,
  // making the exit door a no-op loop. Point it at the real lobby instead.
  door.destination = "lobby";
  door.label = "Enter E.Arcade Lobby";
}
map.objects.push(...NPCS);

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));

// ─── Report ────────────────────────────────────────────────────
let blocked = 0;
for (const c of collision) if (c !== 0) blocked++;
console.log(`✅ regenerated ${path.basename(mapPath)}`);
console.log(`   tileProperties entries : ${Object.keys(tileProperties).length}`);
console.log(`   blocked collision tiles: ${blocked} / ${collision.length}`);
console.log(`   npc objects            : ${map.objects.filter((o) => o.type === "npc").length}`);

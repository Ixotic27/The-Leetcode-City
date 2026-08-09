import type { AvatarLoadout } from "./types";
import { getDefaultLoadout } from "./engine/sprites";

// ─── Named avatar presets for interactive town NPCs ─────────
// Each preset is a full AvatarLoadout. Only item ids registered by
// DEFAULT_ITEMS (hair/clothes/pants/shoes) are guaranteed to resolve;
// unknown shop items are silently skipped by the renderer.
export const NPC_PRESETS: Record<string, AvatarLoadout> = {
  // Mayor Gupta — distinguished elder
  mayor: {
    ...getDefaultLoadout(),
    skin_color: "#c99a6c",
    hair_id: "gentleman",
    hair_color: "#2c2c2c",
    clothes_top_id: "basic",
    clothes_top_color: "#3a3f47",
    clothes_bottom_id: "pants",
    clothes_bottom_color: "#242830",
    shoes_id: "shoes",
    shoes_color: "#1a1c22",
  },
  // Prof. Algorithm — quiz master with white hair
  quizmaster: {
    ...getDefaultLoadout(),
    skin_color: "#e8c4a0",
    hair_id: "curly",
    hair_color: "#d8d8d8",
    clothes_top_id: "basic",
    clothes_top_color: "#7f5af0",
    clothes_bottom_id: "pants",
    clothes_bottom_color: "#2c2c3e",
    shoes_id: "shoes",
    shoes_color: "#3a3a4a",
  },
  // Pond Sage — teal robes near the water
  pondsage: {
    ...getDefaultLoadout(),
    skin_color: "#d9a97a",
    hair_id: "bob",
    hair_color: "#2f6b8f",
    clothes_top_id: "basic",
    clothes_top_color: "#2d6a4f",
    clothes_bottom_id: "pants",
    clothes_bottom_color: "#1f4a36",
    shoes_id: "shoes",
    shoes_color: "#173327",
  },
  // Coder Smith — rust-toned forge master
  blacksmith: {
    ...getDefaultLoadout(),
    skin_color: "#b07840",
    hair_id: "buzzcut",
    hair_color: "#5a3a1a",
    clothes_top_id: "basic",
    clothes_top_color: "#c05621",
    clothes_bottom_id: "pants",
    clothes_bottom_color: "#5c3a1e",
    shoes_id: "shoes",
    shoes_color: "#3a2512",
  },
  // Archivist Ada — crimson scholar
  archivist: {
    ...getDefaultLoadout(),
    skin_color: "#f0d2b0",
    hair_id: "ponytail",
    hair_color: "#1a1a2e",
    clothes_top_id: "basic",
    clothes_top_color: "#b23a48",
    clothes_bottom_id: "pants",
    clothes_bottom_color: "#2b1d3a",
    shoes_id: "shoes",
    shoes_color: "#24182f",
  },
};

/** Resolve an NPC's avatar loadout by preset name, falling back to a default villager. */
export function getNpcLoadout(preset?: string): AvatarLoadout {
  return NPC_PRESETS[preset ?? ""] ?? NPC_PRESETS.mayor;
}

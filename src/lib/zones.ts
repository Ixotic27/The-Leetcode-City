// ─── Shared zone & item constants ────────────────────────────
// Single source of truth — imported by Building3D, ShopClient, loadout API, ShopPreview

export const ZONE_ITEMS: Record<string, string[]> = {
  crown: ["flag", "helipad", "spire", "satellite_dish", "crown_item", "github_star", "ac_badge"],
  roof: ["antenna_array", "rooftop_garden", "rooftop_fire", "pool_party", "tle_fire", "binary_tree"],
  aura: ["neon_trim", "spotlight", "hologram_ring", "lightning_aura", "neon_outline", "particle_aura"],
  faces: ["custom_color", "billboard", "led_banner"],
};

export const ZONE_LABELS: Record<string, string> = {
  crown: "Crown",
  roof: "Roof",
  aura: "Aura",
  faces: "Faces",
};

export const ITEM_NAMES: Record<string, string> = {
  flag: "Flag",
  helipad: "Helipad",
  spire: "Water Tower",
  satellite_dish: "Satellite Dish",
  crown_item: "Crown",
  antenna_array: "Solar Panels",
  rooftop_garden: "Rooftop Garden",
  rooftop_fire: "Rooftop Fire",
  pool_party: "Pool Party",
  neon_trim: "Neon Trim",
  spotlight: "Spotlight",
  hologram_ring: "Hologram Ring",
  lightning_aura: "Lightning Aura",
  custom_color: "Custom Color",
  billboard: "Billboard",
  led_banner: "LED Banner",
  neon_outline: "Neon Outline",
  particle_aura: "Particle Aura",
  streak_freeze: "Streak Freeze",
  // Raid vehicles
  raid_helicopter: "Helicopter",
  raid_drone: "Stealth Drone",
  raid_rocket: "Rocket",
  raid_b2_bomber: "B-2 Bomber",
  raid_ufo: "UFO",
  vehicle_tank: "Heavy Tank",
  // Raid tags
  tag_neon: "Neon Tag",
  tag_fire: "Fire Tag",
  tag_gold: "Gold Tag",
  // Raid boosters & consumables
  raid_boost_small: "War Paint",
  raid_boost_medium: "Battle Armor",
  raid_boost_large: "EMP Device",
  anti_missile_system: "Anti-Missile System",
  anti_tank_mines: "Anti-Tank Mines",
  emp_shield: "Faraday Cage",
  stealth_cloak: "Hologram Cloak",
  emp_device: "EMP Offense Device",
  sabotage_virus: "Sabotage Virus",
  white_rabbit: "White Rabbit",
  github_star: "GitHub Star",
  ac_badge: "Accepted Badge",
  tle_fire: "TLE Fire",
  binary_tree: "Binary Tree",
  scouting_satellite: "Tactical Satellite",
};

// Correct mapping: item_id → achievement that unlocks it (managed by LeetCode migration)
export const ACHIEVEMENT_ITEMS: Record<string, { achievement: string; label: string }> = {
  flag: { achievement: "first_push", label: "First Blood (Solve 1 LeetCode problem)" },
  custom_color: { achievement: "committed", label: "Problem Solver (Solve 100 LeetCode problems)" },
  neon_trim: { achievement: "grinder", label: "Grinder (Solve 500 LeetCode problems)" },
  antenna_array: { achievement: "builder", label: "Easy Breezy (Solve 100 Easy LeetCode problems)" },
  rooftop_garden: { achievement: "architect", label: "Medium Master (Solve 250 Medium LeetCode problems)" },
  helipad: { achievement: "recruiter", label: "Recruiter (Refer 10 developers to LeetCode City)" },
  white_rabbit: { achievement: "white_rabbit", label: "Found the White Rabbit" },
  scouting_satellite: { achievement: "leetcode_questions", label: "Solve 10 Medium or 5 Hard LeetCode Questions" },
};

export const ITEM_UNLOCK_LEVELS: Record<string, number> = {
  anti_missile_system: 5,
  anti_tank_mines: 7,
  emp_shield: 10,
  stealth_cloak: 15,
  raid_drone: 8,
  raid_rocket: 12,
  raid_b2_bomber: 20,
  raid_ufo: 30,
  sabotage_virus: 22,
  raid_boost_small: 3,
  raid_boost_medium: 12,
  raid_boost_large: 25,
  tag_neon: 5,
  tag_fire: 15,
  tag_gold: 25,
};

export const ITEM_EMOJIS: Record<string, string> = {
  flag: "🏁", helipad: "🚁", spire: "🪣", satellite_dish: "📡", crown_item: "👑",
  antenna_array: "☀️", rooftop_garden: "🌿", rooftop_fire: "🔥", pool_party: "🏊",
  neon_trim: "💡", spotlight: "🔦", hologram_ring: "💫", lightning_aura: "⚡",
  custom_color: "🎨", billboard: "📺", led_banner: "🪧",
  neon_outline: "🔮", particle_aura: "✨",
  streak_freeze: "🧊",
  // Raid
  raid_helicopter: "🚁",
  raid_drone: "🛸",
  raid_rocket: "🚀",
  raid_b2_bomber: "🛩️",
  raid_ufo: "👽",
  vehicle_tank: "🛡️",
  tag_neon: "🌈",
  tag_fire: "🔥",
  tag_gold: "🥇",
  raid_boost_small: "🎨",
  raid_boost_medium: "🛡️",
  raid_boost_large: "💣",
  anti_missile_system: "🚀",
  anti_tank_mines: "💥",
  emp_shield: "🔋",
  stealth_cloak: "👻",
  emp_device: "🔌",
  sabotage_virus: "🦠",
  scouting_satellite: "🛰️",
  white_rabbit: "🐇",
  github_star: "⭐",
  ac_badge: "✅",
  tle_fire: "🔥",
  binary_tree: "🌲",
};

export const FACES_ITEMS = ["custom_color", "billboard", "led_banner"];

export const RAID_VEHICLE_ITEMS = ["raid_helicopter", "raid_drone", "raid_rocket", "raid_b2_bomber", "raid_ufo", "vehicle_tank"];
export const RAID_TAG_ITEMS = ["tag_neon", "tag_fire", "tag_gold"];
export const RAID_BOOST_ITEMS = ["raid_boost_small", "raid_boost_medium", "raid_boost_large"];
export const RAID_CONSUMABLE_ITEMS = ["anti_missile_system", "anti_tank_mines", "emp_shield", "stealth_cloak", "emp_device", "sabotage_virus", "scouting_satellite"];

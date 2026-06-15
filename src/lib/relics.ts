export interface Relic {
  id: string;
  name: string;
  era: "Lith" | "Meso" | "Neo" | "Axi" | "Requiem";
  description: string;   // General description of the relic
  abilities: string;     // Abilities/Effects
  howToAchieve: string;  // How it is achieved (steps)
  target_x: number;
  target_y: number;
  target_z: number;
  locked?: boolean;
}

export const STATIC_RELICS: Relic[] = [
  {
    id: "relic_lith_dawnstone",
    name: "Lith Dawnstone",
    era: "Lith",
    description: "A warm, pulsing amber gemstone that holds the first light of day.",
    abilities: "Transits camera to the Central Spire Plaza.",
    howToAchieve: "Achieved by maintaining a 7-day coding streak.",
    target_x: 0.0,
    target_y: 10.0,
    target_z: 50.0,
  },
  {
    id: "relic_lith_harbor_key",
    name: "Lith Harbor Key",
    era: "Lith",
    description: "A weather-worn brass key encrusted with sea salt and barnacles.",
    abilities: "Transits camera to the South Harbor Docks.",
    howToAchieve: "Achieved by visiting the South Harbor Docks 5 times.",
    target_x: 120.0,
    target_y: 5.0,
    target_z: 150.0,
  },
  {
    id: "relic_meso_core_oscillator",
    name: "Meso Core Oscillator",
    era: "Meso",
    description: "A humming mechanical core that vibrates with steady clockwork precision.",
    abilities: "Transits camera to the Central Transit Loop.",
    howToAchieve: "Achieved by completing 5 medium-difficulty problems.",
    target_x: -80.0,
    target_y: 15.0,
    target_z: -100.0,
  },
  {
    id: "relic_meso_steam_turbine",
    name: "Meso Steam Turbine",
    era: "Meso",
    description: "A beautifully crafted miniature steam engine that spins silently.",
    abilities: "Transits camera to the North Industrial Sector.",
    howToAchieve: "Achieved by contributing to the open-source community.",
    target_x: 200.0,
    target_y: 8.0,
    target_z: -250.0,
  },
  {
    id: "relic_neo_cyber_sigil",
    name: "Neo Cyber-Sigil",
    era: "Neo",
    description: "A glowing neon sigil projecting holographic digital encryption.",
    abilities: "Transits camera to the Neon Boulevard Crossroads.",
    howToAchieve: "Achieved by unlocking a legendary profile effect.",
    target_x: -150.0,
    target_y: 20.0,
    target_z: 50.0,
  },
  {
    id: "relic_neo_holo_visor",
    name: "Neo Holo-Visor",
    era: "Neo",
    description: "Advanced cybernetic headgear displaying real-time tactical overlays.",
    abilities: "Transits camera to the Virtual Arena Grandstand.",
    howToAchieve: "Achieved by submitting 20 correct solutions in the Virtual Arena.",
    target_x: 50.0,
    target_y: 30.0,
    target_z: -180.0,
  },
  {
    id: "relic_axi_astral_prism",
    name: "Axi Astral Prism",
    era: "Axi",
    description: "A stellar prism that refracts light into pure cosmic energy lines.",
    abilities: "Transits camera to the Upper Sky Gardens.",
    howToAchieve: "Achieved by reaching Level 30 in LeetCode City.",
    target_x: -40.0,
    target_y: 60.0,
    target_z: 120.0,
  },
  {
    id: "relic_axi_chronometer",
    name: "Axi Chronometer",
    era: "Axi",
    description: "An intricate gold pocketwatch that moves slightly out of sync with time.",
    abilities: "Transits camera to the Legendary Spire Observatory.",
    howToAchieve: "Achieved by claiming your building and customizing it.",
    target_x: 0.0,
    target_y: 120.0,
    target_z: 0.0,
  },
  {
    id: "relic_requiem_void_core",
    name: "Requiem Void Core",
    era: "Requiem",
    description: "A heavy, dark artifact humming with pure, unstable void energy.",
    abilities: "Transits camera to the Void Obelisk.",
    howToAchieve: "Achieved by defeating a Raid boss in the Battle Zone.",
    target_x: 300.0,
    target_y: 50.0,
    target_z: 300.0,
  },
  {
    id: "relic_new_world",
    name: "New World",
    era: "Requiem",
    description: "An ancient compass pointing to uncharted lands beyond the horizon.",
    abilities: "Allows to travel over the horizon via plane.",
    howToAchieve: "365 days streak or 182 all daily questions of our website.",
    target_x: -300.0,
    target_y: 40.0,
    target_z: -300.0,
  },
];

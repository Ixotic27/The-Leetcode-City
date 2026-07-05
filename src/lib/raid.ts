// ─── Raid System Utilities ────────────────────────────────────
// Pure functions for raid calculations, titles, and estimates.

import { ITEM_NAMES } from "./zones";

export const RAID_TITLES = [
  { xp: 0, title: null },
  { xp: 100, title: "Pickpocket" },
  { xp: 500, title: "Burglar" },
  { xp: 2000, title: "Heist Master" },
  { xp: 10000, title: "Kingpin" },
] as const;

export function getRaidTitle(xp: number): string | null {
  let title: string | null = null;
  for (const t of RAID_TITLES) {
    if (xp >= t.xp) title = t.title;
  }
  return title;
}

export type StrengthEstimate = "weak" | "medium" | "strong";

export function getStrengthEstimate(score: number): StrengthEstimate {
  if (score <= 15) return "weak";
  if (score <= 40) return "medium";
  return "strong";
}

// ─── Score Calculation ────────────────────────────────────────

export interface AttackInputs {
  weeklyContributions: number;
  appStreak: number;
  weeklyKudosGiven: number;
  boostBonus?: number;
  empShieldActive?: boolean;
  vehicle?: string;
}

export interface DefenseInputs {
  weeklyContributions: number;
  appStreak: number;
  weeklyKudosReceived: number;
  sabotageVirusActive?: boolean;
  antiMissileActive?: boolean;
  antiTankActive?: boolean;
  isAirAttack?: boolean;
  isGroundAttack?: boolean;
}

export interface ScoreBreakdown {
  commits: number;
  streak: number;
  kudos: number;
  boost?: number;
  boost_item?: string;
  vehicle_bonus?: number;
}

export function calculateAttackScore(inputs: AttackInputs): {
  total: number;
  breakdown: ScoreBreakdown;
} {
  const commits = inputs.weeklyContributions * 3;
  const streak = inputs.appStreak * 1;
  const kudos = inputs.weeklyKudosGiven * 2;
  const boost = inputs.boostBonus ?? 0;
  
  // Calculate vehicle bonus/damage points
  let vehicle_bonus = 0;
  switch (inputs.vehicle) {
    case "raid_helicopter":
      vehicle_bonus = 5;
      break;
    case "vehicle_tank":
      vehicle_bonus = 10;
      break;
    case "raid_drone":
      vehicle_bonus = 15;
      break;
    case "raid_rocket":
      vehicle_bonus = 20;
      break;
    case "raid_b2_bomber":
      vehicle_bonus = 25;
      break;
    case "raid_ufo":
      vehicle_bonus = 35;
      break;
    default:
      vehicle_bonus = 0;
      break;
  }
  
  let total = commits + streak + kudos + boost + vehicle_bonus;
  
  // EMP Shield reduces final attack score by 20%
  if (inputs.empShieldActive) {
    total = Math.floor(total * 0.8);
  }

  return {
    total,
    breakdown: {
      commits,
      streak,
      kudos,
      ...(boost > 0 ? { boost } : {}),
      ...(vehicle_bonus > 0 ? { vehicle_bonus } : {}),
    },
  };
}

export function calculateDefenseScore(inputs: DefenseInputs): {
  total: number;
  breakdown: ScoreBreakdown;
} {
  const commits = inputs.weeklyContributions * 3;
  const streak = inputs.appStreak * 1;
  const kudos = inputs.weeklyKudosReceived * 1;
  
  let total = commits + streak + kudos;

  // Sabotage Virus reduces base defense score by 30%
  if (inputs.sabotageVirusActive) {
    total = Math.floor(total * 0.7);
  }

  // Anti-Missile grants +50% against Air attacks
  if (inputs.antiMissileActive && inputs.isAirAttack) {
    total = Math.floor(total * 1.5);
  }

  // Anti-Tank grants +50% against Ground attacks
  if (inputs.antiTankActive && inputs.isGroundAttack) {
    total = Math.floor(total * 1.5);
  }

  return {
    total,
    breakdown: { commits, streak, kudos },
  };
}

// ─── Raid Constants ───────────────────────────────────────────

export const MAX_RAIDS_PER_DAY = 3;
export const RAID_TAG_DURATION_DAYS = 3;
export const XP_WIN_ATTACKER = 50;
export const XP_WIN_DEFENDER = 30;
export const XP_LOSE_DEFENDER = 30;

// ─── Types ────────────────────────────────────────────────────

export interface RaidVehicleOption {
  item_id: string;
  name: string;
  emoji: string;
}

export interface RaidPreviewResponse {
  can_raid: boolean;
  raids_today: number;
  raids_max: number;
  target_raided_this_week: boolean;
  attack_estimate: StrengthEstimate;
  defense_estimate: StrengthEstimate;
  attack_score: number;
  defense_score: number;
  attack_breakdown: ScoreBreakdown;
  defense_breakdown: ScoreBreakdown;
  attacker_login: string;
  attacker_avatar: string | null;
  defender_login: string;
  defender_avatar: string | null;
  defender_building_height: number;
  defender_scouted_defense: string | null;
  defender_defense_type: "air" | "ground" | "all" | "stealth" | null;
  available_boosts: RaidBoostItem[];
  available_vehicles: RaidVehicleOption[];
  available_offensive_items: RaidOffensiveItem[];
  vehicle: string;
}

export interface RaidBoostItem {
  purchase_id?: number;
  inventory_id?: string;
  item_id: string;
  name: string;
  bonus?: number;
  quantity?: number;
}

export interface RaidOffensiveItem {
  item_id: string;
  quantity: number;
  uses_left_this_week: number;
}

export interface RaidExecuteResponse {
  raid_id: string;
  success: boolean;
  attack_score: number;
  defense_score: number;
  attack_breakdown: ScoreBreakdown;
  defense_breakdown: ScoreBreakdown;
  attacker: {
    login: string;
    avatar: string | null;
    position: [number, number, number];
    height: number;
  };
  defender: {
    login: string;
    avatar: string | null;
    position: [number, number, number];
    height: number;
  };
  xp_earned: number;
  new_raid_xp: number;
  new_title: string | null;
  new_achievements: string[];
  vehicle: string;
  tag_style: string;
}

export function getRaidConsumableToastMessage(raidData: RaidExecuteResponse): string | null {
  const itemId = raidData.attack_breakdown.boost_item;
  if (!itemId) return null;

  const itemName = ITEM_NAMES[itemId] ?? itemId;
  const boost = raidData.attack_breakdown.boost;

  if (typeof boost === "number" && boost > 0) {
    return `${itemName} activated! +${boost} raid power.`;
  }

  return `${itemName} activated successfully.`;
}

export interface RaidHistoryEntry {
  id: string;
  attacker_login: string;
  defender_login: string;
  success: boolean;
  created_at: string;
}

export interface RaidHistoryResponse {
  raids: RaidHistoryEntry[];
  total: number;
  active_tag: {
    attacker_login: string;
    tag_style: string;
    expires_at: string;
  } | null;
}

// ─── XP & Leveling System ───────────────────────────────────

// ─── Types ──────────────────────────────────────────────────

export interface XpTier {
  id: string;
  name: string;
  color: string;
  minLevel: number;
  maxLevel: number;
}

export interface XpRank {
  level: number;
  title: string;
  tier: XpTier;
}

export type XpSourceType =
  | "checkin"
  | "dailies"
  | "kudos_given"
  | "visit"
  | "fly"
  | "raid_win"
  | "raid_loss"
  | "raid_defend"
  | "achievement"
  | "kudos_received"
  | "referral"
  | "gift_sent"
  | "github"
  | "xp_code";

// ─── Constants ──────────────────────────────────────────────

export const XP_TIERS: XpTier[] = [
  { id: "novice", name: "Novice", color: "#4ade80", minLevel: 1, maxLevel: 4 },
  { id: "apprentice", name: "Apprentice", color: "#60a5fa", minLevel: 5, maxLevel: 8 },
  { id: "specialist", name: "Specialist", color: "#a78bfa", minLevel: 9, maxLevel: 13 },
  { id: "expert", name: "Expert", color: "#fbbf24", minLevel: 14, maxLevel: 18 },
  { id: "knight", name: "Knight", color: "#22d3ee", minLevel: 19, maxLevel: 23 },
  { id: "guardian", name: "Guardian", color: "#ffffff", minLevel: 24, maxLevel: 999 },
];

const RANK_TITLES: [number, string][] = [
  [1, "First AC"],
  [2, "Two Sum Solved"],
  [3, "Array Iterator"],
  [4, "String Builder"],
  [5, "Hash Mapper"],
  [6, "Two Pointers"],
  [7, "Sliding Window"],
  [8, "Binary Searcher"],
  [9, "Linked List Ninja"],
  [10, "Stack Master"],
  [11, "Queue Enforcer"],
  [12, "Tree Climber"],
  [13, "DFS Explorer"],
  [14, "BFS Navigator"],
  [15, "Graph Traverser"],
  [16, "Heap Builder"],
  [17, "Trie Organizer"],
  [18, "Greedy Thinker"],
  [19, "Backtracker"],
  [20, "Memoization Ace"],
  [21, "DP Specialist"],
  [22, "Segment Tree Pro"],
  [23, "Knight"],
  [24, "Guardian"],
  [25, "LeetCode Legend"],
];

export const XP_RANKS: XpRank[] = RANK_TITLES.map(([level, title]) => ({
  level,
  title,
  tier: XP_TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel)!,
}));

export const DAILY_XP_CAP = 150;

export const ENGAGEMENT_SOURCES: Set<XpSourceType> = new Set([
  "checkin",
  "dailies",
  "kudos_given",
  "visit",
  "fly",
]);

// ─── Formulas ───────────────────────────────────────────────

/** Cumulative XP required to reach a given level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(25 * Math.pow(level, 2.2));
}

/** XP needed to go from current level to next level. */
export function xpDeltaForLevel(level: number): number {
  return xpForLevel(level + 1) - xpForLevel(level);
}

/** Determine level from total XP (never below 1). */
export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/** Get tier for a given level. */
export function tierFromLevel(level: number): XpTier {
  for (let i = XP_TIERS.length - 1; i >= 0; i--) {
    if (level >= XP_TIERS[i].minLevel) return XP_TIERS[i];
  }
  return XP_TIERS[0];
}

/** Get rank info (title + tier) for a given level. */
export function rankFromLevel(level: number): XpRank {
  if (level >= 25) {
    return { level, title: "Legend", tier: XP_TIERS[5] };
  }
  const rank = XP_RANKS.find((r) => r.level === level);
  return rank ?? { level, title: "Hello World", tier: XP_TIERS[0] };
}

/** Progress within current level (0 to 1). */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const delta = next - current;
  if (delta <= 0) return 1;
  return Math.min(1, (xp - current) / delta);
}

// ─── LeetCode XP (Log Scale + Flat Bonuses) ──────────────────────────────────

export function calculateLeetcodeXp(dev: {
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number;
  lc_streak: number;
}): number {
  const easySolved = Math.max(dev.easy_solved, 0);
  const mediumSolved = Math.max(dev.medium_solved, 0);
  const hardSolved = Math.max(dev.hard_solved, 0);

  // Fairly distribute Base XP using logarithmic scaling
  const solvedXp =
    Math.floor(Math.log2(easySolved + 1) * 3) +
    Math.floor(Math.log2(mediumSolved + 1) * 6) +
    Math.floor(Math.log2(hardSolved + 1) * 12);
  
  // High contest ratings exponentially scale better, but bounded realistically
  const ratingXp = dev.contest_rating > 1400 
    ? Math.floor(Math.pow((dev.contest_rating - 1400) / 100, 1.5) * 5) 
    : 0;
  
  // Streak directly gives flat scaling points
  const streakXp = Math.floor(dev.lc_streak * 1.5);

  return solvedXp + ratingXp + streakXp;
}

// ─── Base XP Merge (preserve earned XP on re-verification) ───

/**
 * Merge freshly computed base XP (GitHub/LeetCode-derived) into a developer's
 * total XP while preserving XP earned from every other source — check-ins,
 * dailies, rewards, redemptions, raids, referrals, bonuses, etc.
 *
 * Earned XP is whatever in the previous total wasn't base XP:
 *   earned   = prevTotal - prevBase
 * The new total re-applies that earned XP on top of the new base:
 *   newTotal = earned + newBase
 *
 * Null/undefined previous values are treated as 0 (e.g. first-time
 * verification), and both the earned portion and the result are clamped to be
 * non-negative so the merge can never introduce negative XP.
 */
export function mergeBaseXp(
  prevTotal: number | null | undefined,
  prevBase: number | null | undefined,
  newBase: number,
): number {
  const earned = Math.max(0, (prevTotal ?? 0) - (prevBase ?? 0));
  return Math.max(0, earned + newBase);
}

// ─── Achievement XP ─────────────────────────────────────────

const ACHIEVEMENT_XP: Record<string, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  diamond: 100,
};

export function xpForAchievementTier(tier: string): number {
  return ACHIEVEMENT_XP[tier] ?? 0;
}

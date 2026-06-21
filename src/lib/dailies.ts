import { getSupabaseAdmin } from "./supabase";

// ─── Mission Pool ──────────────────────────────────────────────────────

export interface Mission {
  id: string;
  title: string;
  description: string;
  threshold: number;
  /** If true, excluded on mobile devices */
  desktopOnly?: boolean;
}

const MISSION_POOL: Mission[] = [
  { id: "checkin",            title: "Daily presence",     description: "Check in today",               threshold: 1 },
  { id: "give_kudos",         title: "Spread the love",    description: "Give kudos to a dev",          threshold: 1 },
  { id: "give_kudos_3",       title: "Kudos spree",        description: "Give kudos to 3 devs",         threshold: 3 },
  { id: "visit_building",     title: "Building inspector",description: "Visit a dev's building",        threshold: 1 },
  { id: "visit_3_buildings",  title: "City explorer",      description: "Visit 3 buildings",            threshold: 3 },
  { id: "fly_score_50",       title: "Casual pilot",       description: "Score 50+ in Fly mode",        threshold: 1, desktopOnly: true },
  { id: "fly_score_150",      title: "Sky collector",      description: "Score 150+ in Fly mode",       threshold: 1, desktopOnly: true },
  { id: "win_battle",         title: "Victorious",         description: "Win a battle",                 threshold: 1 },
  { id: "attempt_battle",     title: "Ready to fight",     description: "Attempt a battle",             threshold: 1 },
  { id: "visit_shop",         title: "Window shopper",     description: "Visit the shop",               threshold: 1 },
  { id: "check_leaderboard",  title: "Stats checker",      description: "Check the leaderboard",        threshold: 1 },
  { id: "explore_district",   title: "District hopper",    description: "Explore a different district",  threshold: 1 },
];

export const MISSIONS_BY_ID = new Map(MISSION_POOL.map((m) => [m.id, m]));

// ─── Deterministic PRNG (mulberry32) ───────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ─── Daily Mission Selection ───────────────────────────────────────────

/**
 * Get the 3 daily missions for a developer on a given date.
 * Deterministic: same date + developerId always gives same missions.
 * Always includes `checkin` + 2 random from pool (excluding checkin).
 */
export function getDailyMissions(
  developerId: number,
  dateStr: string,
  isMobile = false,
): Mission[] {
  const seed = hashStr(`${dateStr}:${developerId}`);
  const rng = mulberry32(seed);

  // 1. Always shuffle the ENTIRE pool (excluding checkin) to ensure
  // deterministic relative order across all devices.
  const pool = MISSION_POOL.filter((m) => m.id !== "checkin");
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 2. Filter for device support AFTER shuffling. This ensures that
  // any missions available on both devices remain assigned to the user.
  const filtered = isMobile ? shuffled.filter((m) => !m.desktopOnly) : shuffled;

  const checkin = MISSION_POOL.find((m) => m.id === "checkin")!;
  return [checkin, filtered[0], filtered[1]];
}

/** Get today's date string in YYYY-MM-DD (UTC). */
export function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Server-side Tracking Helper ───────────────────────────────────────

/**
 * Fire-and-forget: track progress for a daily mission.
 * Safe to call even if the mission isn't assigned today — it'll no-op.
 * For missions that need score checks (fly_score_50, fly_score_150),
 * pass the actual score so we can validate the threshold here.
 */
export async function trackDailyMission(
  developerId: number,
  missionId: string,
  extra?: { score?: number; isMobile?: boolean },
): Promise<void> {
  try {
    const today = getTodayStr();
    // A user's assigned missions can differ between mobile and desktop
    // (desktopOnly missions shift the selection), and the device making the
    // request isn't known here. Credit the mission if it belongs to either
    // set so mobile users aren't silently denied progress; desktopOnly
    // missions stay gated by the score checks below.
    const mission =
      getDailyMissions(developerId, today, false).find((m) => m.id === missionId) ??
      getDailyMissions(developerId, today, true).find((m) => m.id === missionId);
    if (!mission) return;

    if (missionId === "fly_score_50"  && (extra?.score ?? 0) < 50)  return;
    if (missionId === "fly_score_150" && (extra?.score ?? 0) < 150) return;

    const sb = getSupabaseAdmin();
    await sb.rpc("record_mission_progress", {
      p_developer_id: developerId,
      p_mission_id: missionId,
      p_threshold: mission.threshold,
      p_increment: 1,
    });
  } catch (err) {
    console.error("[dailies] trackDailyMission error:", err);
  }
}

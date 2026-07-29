/**
 * Pitch statistics module.
 * Provides aggregate platform metrics used on the public landing/pitch page.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Aggregate statistics for the LeetCode City platform.
 * All values are raw counts from the database unless otherwise noted.
 */
export interface PitchStats {
  /** Total registered developers (claimed and unclaimed). */
  developers: number;
  /** Developers who have claimed their building. */
  claimed: number;
  /** Number of paid sky-ad campaigns. */
  adCampaigns: number;
  /** Number of unique brands that have purchased ads. */
  uniqueBrands: number;
  /** Number of shop purchases (placeholder, always 0). */
  shopPurchases: number;
  /** Total kudos given across all developers. */
  kudos: number;
  /** Total building visits recorded. */
  buildingVisits: number;
  /** Total developer achievements earned. */
  achievements: number;
  /** Number of days since the platform launched. */
  daysOld: number;
  /** Claim rate as a percentage string, e.g. "42.5%". */
  conversionRate: string;
  formattedDevelopers: string;
  formattedClaimed: string;
  formattedAdCampaigns: string;
  formattedUniqueBrands: string;
  formattedShopPurchases: string;
  formattedKudos: string;
  formattedBuildingVisits: string;
  formattedAchievements: string;
  formattedDaysOld: string;
  formattedRevenue: string;
  formattedAdRevenue: string;
  formattedShopRevenue: string;
}

/** Platform launch date used to calculate `daysOld`. */
const LAUNCH_DATE = new Date("2026-02-19T00:00:00Z");

// Revenue from Stripe dashboard (update manually, can't be calculated from DB
// because sky_ads doesn't store which currency was used per ad)
const KNOWN_REVENUE_BRL = 1586;
const KNOWN_AD_REVENUE_BRL = 1550;
const KNOWN_SHOP_REVENUE_BRL = 36;

/**
 * Format a number with US locale thousands separators.
 * @param n - The number to format.
 * @returns A string such as "1,234".
 */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format a number with US locale and append "+" when rounded to the nearest 100.
 * Used for large approximate counts (developers, claimed).
 * @param n - The number to format.
 * @returns A string such as "1,200+".
 */
function fmtRounded(n: number): string {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return fmt(rounded) + "+";
  }
  return fmt(n);
}

/**
 * Fetch aggregate platform statistics for the public pitch page.
 * Queries developers, sky-ads, kudos, building visits, and achievements tables.
 *
 * @returns A fully populated {@link PitchStats} object with raw and formatted values.
 */
export async function getPitchStats(): Promise<PitchStats> {
  const admin = getSupabaseAdmin();

  const [
    devsResult,
    claimedResult,
    adsResult,
    kudosResult,
    visitsResult,
    achievementsResult,
  ] = await Promise.all([
    admin.from("developers").select("*", { count: "exact", head: true }),
    admin.from("developers").select("*", { count: "exact", head: true }).eq("claimed", true),
    admin.from("sky_ads").select("plan_id, purchaser_email").not("purchaser_email", "is", null),
    admin.from("developer_kudos").select("*", { count: "exact", head: true }),
    admin.from("building_visits").select("*", { count: "exact", head: true }),
    admin.from("developer_achievements").select("*", { count: "exact", head: true }),
  ]);

  const developers = devsResult.count ?? 0;
  const claimed = claimedResult.count ?? 0;

  const paidAds = adsResult.data ?? [];
  const brandEmails = new Set<string>();
  for (const ad of paidAds) {
    if (ad.purchaser_email) {
      brandEmails.add(ad.purchaser_email);
    }
  }
  const adCampaigns = paidAds.length;
  const uniqueBrands = brandEmails.size;

  const kudos = kudosResult.count ?? 0;
  const buildingVisits = visitsResult.count ?? 0;
  const achievements = achievementsResult.count ?? 0;

  const daysOld = Math.floor((Date.now() - LAUNCH_DATE.getTime()) / 86400000);
  const conversionRate = developers > 0 ? ((claimed / developers) * 100).toFixed(1) + "%" : "0%";

  return {
    developers,
    claimed,
    adCampaigns,
    uniqueBrands,
    shopPurchases: 0,
    kudos,
    buildingVisits,
    achievements,
    daysOld,
    conversionRate,
    formattedDevelopers: fmtRounded(developers),
    formattedClaimed: fmt(claimed),
    formattedAdCampaigns: fmt(adCampaigns),
    formattedUniqueBrands: fmt(uniqueBrands),
    formattedShopPurchases: "0",
    formattedKudos: fmt(kudos),
    formattedBuildingVisits: fmt(buildingVisits),
    formattedAchievements: fmt(achievements),
    formattedDaysOld: `${daysOld} days old`,
    formattedRevenue: `R$${fmt(KNOWN_REVENUE_BRL)}+`,
    formattedAdRevenue: `R$${fmt(KNOWN_AD_REVENUE_BRL)}`,
    formattedShopRevenue: KNOWN_SHOP_REVENUE_BRL > 0 ? `R$${fmt(KNOWN_SHOP_REVENUE_BRL)}` : "Early sales",
  };
}

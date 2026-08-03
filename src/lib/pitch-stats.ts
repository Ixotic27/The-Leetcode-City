import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Aggregated pitch / dashboard statistics for the LeetCode City.
 * Used by the public-facing stats endpoint and marketing materials.
 */
export interface PitchStats {
  developers: number;
  claimed: number;
  adCampaigns: number;
  uniqueBrands: number;
  shopPurchases: number;
  kudos: number;
  buildingVisits: number;
  achievements: number;
  daysOld: number;
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

/** UTC timestamp of the LeetCode City public launch date. */
const LAUNCH_DATE = new Date("2026-02-19T00:00:00Z");

/**
 * Known revenue figures sourced from the Stripe dashboard.
 * Updated manually since sky_ads does not store per-ad currency metadata,
 * preventing server-side revenue calculation from the database alone.
 */
const KNOWN_REVENUE_BRL = 1586;
const KNOWN_AD_REVENUE_BRL = 1550;
const KNOWN_SHOP_REVENUE_BRL = 36;

/**
 * Formats a number with US locale comma separators (e.g. 1234 -> "1,234").
 * @param n - The number to format.
 * @returns A locale-formatted string with no decimal places.
 */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Formats a number with US locale comma separators and rounds values >= 1000
 * to the nearest hundred with a trailing "+".
 * @param n - The number to format.
 * @returns A formatted string (e.g. "1,200+" for 1234, "999" for 999).
 */
function fmtRounded(n: number): string {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return fmt(rounded) + "+";
  }
  return fmt(n);
}

/**
 * Fetches aggregate platform statistics from the database.
 *
 * Queries developers, ad campaigns, kudos, building visits, and achievements
 * in parallel, then computes derived fields (days old, conversion rate,
 * formatted display strings) before returning a full PitchStats object.
 *
 * @returns A Promise resolving to a populated {@link PitchStats} object.
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

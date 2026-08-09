import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Snapshot of city-wide metrics rendered on the pitch/landing page.
 *
 * Contains raw counts for every tracked metric plus pre-formatted
 * (`formatted*`) display strings so UI components can render values directly
 * without re-formatting. Revenue fields are derived from known Stripe
 * dashboard totals (see the `KNOWN_*_REVENUE_BRL` constants below) and are
 * displayed in BRL.
 */
export interface PitchStats {
  /** Total number of registered developers. */
  developers: number;
  /** Number of developers who have claimed their profile. */
  claimed: number;
  /** Number of paid ad campaigns purchased. */
  adCampaigns: number;
  /** Number of unique brands that purchased ad campaigns. */
  uniqueBrands: number;
  /** Number of in-app shop purchases. */
  shopPurchases: number;
  /** Number of kudos awarded. */
  kudos: number;
  /** Number of building visits recorded. */
  buildingVisits: number;
  /** Number of achievements earned. */
  achievements: number;
  /** Days since the platform launch date. */
  daysOld: number;
  /** Claim rate as a percentage string (e.g. `"12.3%"`, `"0%"`). */
  conversionRate: string;
  /** `developers` formatted with thousands separators. */
  formattedDevelopers: string;
  /** `claimed` formatted with thousands separators. */
  formattedClaimed: string;
  /** `adCampaigns` formatted with thousands separators. */
  formattedAdCampaigns: string;
  /** `uniqueBrands` formatted with thousands separators. */
  formattedUniqueBrands: string;
  /** `shopPurchases` formatted with thousands separators. */
  formattedShopPurchases: string;
  /** `kudos` formatted with thousands separators. */
  formattedKudos: string;
  /** `buildingVisits` formatted with thousands separators. */
  formattedBuildingVisits: string;
  /** `achievements` formatted with thousands separators. */
  formattedAchievements: string;
  /** `daysOld` rendered as e.g. `"168 days old"`. */
  formattedDaysOld: string;
  /** Total known revenue in BRL, e.g. `"R$1,586+"`. */
  formattedRevenue: string;
  /** Known ad revenue in BRL, e.g. `"R$1,550"`. */
  formattedAdRevenue: string;
  /** Known shop revenue in BRL, or `"Early sales"` when none exists. */
  formattedShopRevenue: string;
}

const LAUNCH_DATE = new Date("2026-02-19T00:00:00Z");

// Revenue from Stripe dashboard (update manually, can't be calculated from DB
// because sky_ads doesn't store which currency was used per ad)
const KNOWN_REVENUE_BRL = 1586;
const KNOWN_AD_REVENUE_BRL = 1550;
const KNOWN_SHOP_REVENUE_BRL = 36;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtRounded(n: number): string {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return fmt(rounded) + "+";
  }
  return fmt(n);
}

/**
 * Aggregates and returns the city-wide stats shown on the pitch page.
 *
 * Runs several Supabase queries in parallel (developer counts, paid ad
 * purchases, kudos, building visits, achievements), derives the claim
 * conversion rate and platform age, and formats every value for display —
 * including BRL revenue computed from the known Stripe dashboard totals.
 *
 * Never throws: if any query fails, the error is logged to the console and an
 * all-zero `PitchStats` snapshot is returned so the pitch page still renders.
 *
 * @returns A `PitchStats` snapshot with raw and formatted metrics, or an
 * all-zero snapshot when the underlying queries fail.
 */
export async function getPitchStats(): Promise<PitchStats> {
  const admin = getSupabaseAdmin();

  try {
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
  } catch (err) {
    console.warn("[pitch-stats] Failed to fetch data, returning defaults:", err);
    const daysOld = Math.floor((Date.now() - LAUNCH_DATE.getTime()) / 86400000);
    return {
      developers: 0,
      claimed: 0,
      adCampaigns: 0,
      uniqueBrands: 0,
      shopPurchases: 0,
      kudos: 0,
      buildingVisits: 0,
      achievements: 0,
      daysOld,
      conversionRate: "0%",
      formattedDevelopers: "0",
      formattedClaimed: "0",
      formattedAdCampaigns: "0",
      formattedUniqueBrands: "0",
      formattedShopPurchases: "0",
      formattedKudos: "0",
      formattedBuildingVisits: "0",
      formattedAchievements: "0",
      formattedDaysOld: `${daysOld} days old`,
      formattedRevenue: `R$${fmt(KNOWN_REVENUE_BRL)}+`,
      formattedAdRevenue: `R$${fmt(KNOWN_AD_REVENUE_BRL)}`,
      formattedShopRevenue: KNOWN_SHOP_REVENUE_BRL > 0 ? `R$${fmt(KNOWN_SHOP_REVENUE_BRL)}` : "Early sales",
    };
  }
}

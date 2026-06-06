import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    const sb = getSupabaseAdmin();

    // Fetch all achievements
    const { data: allAchievements } = await sb
      .from("achievements")
      .select("id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order")
      .order("sort_order", { ascending: true });

    // Fetch all shop items
    const { data: allItems } = await sb
      .from("arena_items")
      .select("id, name, slug, description, item_type, rarity, icon_path, max_stack, price_points, price_usd_cents")
      .order("name", { ascending: true });

    // Default response for guest users
    if (!user) {
      return NextResponse.json({
        loggedIn: false,
        stats: null,
        unlockedAchievements: [],
        ownedItems: [],
        ownedTitles: [],
        selectedTitle: null,
        achievements: allAchievements ?? [],
        items: allItems ?? [],
      });
    }

    // Fetch user's developer row
    const { data: dev } = await sb
      .from("developers")
      .select("*")
      .eq("claimed_by", user.id)
      .maybeSingle();

    if (!dev) {
      return NextResponse.json({
        loggedIn: true,
        stats: null,
        unlockedAchievements: [],
        ownedItems: [],
        ownedTitles: [],
        selectedTitle: null,
        achievements: allAchievements ?? [],
        items: allItems ?? [],
      });
    }

    // Fetch user's unlocked achievements
    const { data: unlockedAchievementsData } = await sb
      .from("developer_achievements")
      .select("achievement_id")
      .eq("developer_id", dev.id);
    const unlockedAchievements = (unlockedAchievementsData ?? []).map(r => r.achievement_id);

    // Fetch user's owned items (purchases completed)
    const { data: directPurchases } = await sb
      .from("purchases")
      .select("item_id, provider, amount_cents")
      .eq("developer_id", dev.id)
      .is("gifted_to", null)
      .eq("status", "completed");
    const { data: giftedPurchases } = await sb
      .from("purchases")
      .select("item_id, provider, amount_cents")
      .eq("gifted_to", dev.id)
      .eq("status", "completed");

    const ownedItems = Array.from(
      new Set([
        ...(directPurchases ?? [])
          .filter(p => !(p.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(p.provider)))
          .map(p => p.item_id),
        ...(giftedPurchases ?? [])
          .filter(p => !(p.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(p.provider)))
          .map(p => p.item_id)
      ])
    );

    // Fetch user's Arena Inventory items (for Arena Badges/Customizations)
    const { data: arenaInvData } = await sb
      .from("arena_inventory")
      .select("arena_items(slug)")
      .eq("user_id", dev.id);
    
    const ownedTitles = (arenaInvData ?? [])
      .map((inv: any) => Array.isArray(inv.arena_items) ? inv.arena_items[0]?.slug : inv.arena_items?.slug)
      .filter((slug): slug is string => typeof slug === "string");

    const isDeveloper = ["ishant_27", "ixotic", "ixotic27"].includes(dev.github_login.toLowerCase());
    if (isDeveloper) {
      ownedTitles.push("title_creator", "title_lead_dev", "title_sys_op");
    }

    // Fetch selected title customization
    const { data: customizationData } = await sb
      .from("developer_customizations")
      .select("config")
      .eq("developer_id", dev.id)
      .eq("item_id", "selected_title")
      .maybeSingle();
    const selectedTitle = (customizationData?.config as any)?.slug ?? null;

    // User stats normalized mapping
    const stats = {
      easy_solved: dev.easy_solved ?? 0,
      medium_solved: dev.medium_solved ?? 0,
      hard_solved: dev.hard_solved ?? 0,
      contest_rating: dev.contest_rating ?? 0,
      lc_streak: dev.lc_streak ?? 0,
      contributions: dev.contributions ?? 0,
      public_repos: dev.public_repos ?? 0,
      total_stars: dev.total_stars ?? 0,
      referral_count: dev.referral_count ?? 0,
      kudos_count: dev.kudos_count ?? 0,
      gifts_sent: dev.gifts_sent ?? 0,
      gifts_received: dev.gifts_received ?? 0,
      raid_xp: dev.raid_xp ?? 0,
      xp_level: dev.xp_level ?? 1,
      xp_total: dev.xp_total ?? 0,
      total_prs: dev.total_prs ?? 0,
      isDeveloper,
    };

    return NextResponse.json({
      loggedIn: true,
      developerId: dev.id,
      stats,
      unlockedAchievements,
      ownedItems,
      ownedTitles,
      selectedTitle,
      achievements: allAchievements ?? [],
      items: allItems ?? [],
    });
  } catch (error: any) {
    console.error("[codex] error fetching codex details:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

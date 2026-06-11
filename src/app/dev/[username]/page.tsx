import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOwnedItems } from "@/lib/items";
import { TIER_COLORS } from "@/lib/achievements";
import { DISTRICT_NAMES, DISTRICT_COLORS } from "@/lib/github";
import { ITEM_NAMES } from "@/lib/zones";
import { rankFromLevel, tierFromLevel, levelProgress, xpForLevel } from "@/lib/xp";
import ClaimButton from "@/components/ClaimButton";
import ShareButtons from "@/components/ShareButtons";
import CompareChallenge from "@/components/CompareChallenge";
import ReferralCTA from "@/components/ReferralCTA";
import ProfileTracker from "@/components/ProfileTracker";

export const revalidate = 3600; // ISR: regenerate every 1 hour

interface Props {
  params: Promise<{ username: string }>;
}

const getDeveloper = cache(async (username: string) => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("developers")
    .select("*")
    .eq("github_login", username.toLowerCase())
    .single();
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) {
    return { title: "Developer Not Found - LeetCode City" };
  }

  const contribs = dev.contributions ?? 0;
  const title = `@${dev.github_login} - LeetCode City | ${contribs.toLocaleString()} solved`;
  const description = `See @${dev.github_login}'s building in LeetCode City. ${contribs.toLocaleString()} solved, ${dev.total_stars.toLocaleString()} reputation. Rank #${dev.rank ?? "?"} in the city.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      creator: "ixotic",
      site: "ixotic",
    },
  };
}

interface AchievementRow {
  achievement_id: string;
  name: string;
  tier: string;
}

export default async function DevPage({ params }: Props) {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) notFound();

  const accent = "#ffa116";
  const shadow = "#5a7a00";
  const ownedItems = await getOwnedItems(dev.id);

  // Fetch achievements with name+tier from DB (no hardcoded maps)
  const sb = getSupabaseAdmin();
  const { data: devAchievements } = await sb
    .from("developer_achievements")
    .select("achievement_id, achievements(name, tier)")
    .eq("developer_id", dev.id);
  const achievements: AchievementRow[] = (devAchievements ?? []).map((a: Record<string, unknown>) => ({
    achievement_id: a.achievement_id as string,
    name: (a.achievements as Record<string, unknown>)?.name as string ?? (a.achievement_id as string),
    tier: (a.achievements as Record<string, unknown>)?.tier as string ?? "bronze",
  }));

  // Fetch arena titles
  const { data: arenaInventory } = await sb
    .from("arena_inventory")
    .select("arena_items(slug)")
    .eq("user_id", dev.id);

  const isDeveloper = ["ishant_27", "ixotic", "ixotic27"].includes(dev.github_login.toLowerCase());

  const ownedTitlesSlugs = (arenaInventory ?? [])
    .map((inv: any) => inv.arena_items?.slug)
    .filter((slug): slug is string => typeof slug === "string");

  if (isDeveloper) {
    ownedTitlesSlugs.push("title_creator", "title_lead_dev", "title_sys_op");
  }

  // Fetch selected title customization
  const { data: customizationData } = await sb
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", dev.id)
    .eq("item_id", "selected_title")
    .maybeSingle();
  const selectedTitleSlug = (customizationData?.config as any)?.slug ?? null;

  const TITLE_PRESETS = [
    { slug: "title_creator", name: "City Creator", titleText: "The Architect", color: "#ec4899", icon: "/assets/items/crown_of_code.png", priority: 10 },
    { slug: "title_lead_dev", name: "Core Engineer", titleText: "Root Access", color: "#10b981", icon: "/assets/items/celestial_orb.png", priority: 9 },
    { slug: "title_sys_op", name: "Database Master", titleText: "SysOp", color: "#3b82f6", icon: "/assets/items/soul_gem.png", priority: 8 },
    { slug: "crown_of_code", name: "Crown of Code", titleText: "Code King/Queen", color: "#f59e0b", icon: "/assets/items/crown_of_code.png", priority: 7 },
    { slug: "badge_legendary", name: "Legendary Sentinel", titleText: "The Sentinel", color: "#a855f7", icon: "/assets/items/badge_legendary.png", priority: 6 },
    { slug: "badge_diamond", name: "Diamond Grandmaster", titleText: "The Grandmaster", color: "#06b6d4", icon: "/assets/items/badge_diamond.png", priority: 5 },
    { slug: "badge_platinum", name: "Platinum Architect", titleText: "The Architect", color: "#3b82f6", icon: "/assets/items/badge_platinum.png", priority: 4 },
    { slug: "badge_gold", name: "Gold Developer", titleText: "The Builder", color: "#eab308", icon: "/assets/items/badge_gold.png", priority: 3 },
    { slug: "badge_silver", name: "Silver Hacker", titleText: "The Script Kiddie", color: "#94a3b8", icon: "/assets/items/badge_silver.png", priority: 2 },
    { slug: "badge_bronze", name: "Bronze Coder", titleText: "The Apprentice", color: "#b45309", icon: "/assets/items/badge_bronze.png", priority: 1 },
  ];

  let activeTitle: typeof TITLE_PRESETS[0] | null = null;
  if (selectedTitleSlug && selectedTitleSlug !== "auto" && ownedTitlesSlugs.includes(selectedTitleSlug)) {
    activeTitle = TITLE_PRESETS.find(t => t.slug === selectedTitleSlug) ?? null;
  } else {
    // Auto-detect: find the highest priority owned title
    const ownedPresets = TITLE_PRESETS.filter(t => ownedTitlesSlugs.includes(t.slug));
    if (ownedPresets.length > 0) {
      activeTitle = ownedPresets.reduce((highest, current) => current.priority > highest.priority ? current : highest, ownedPresets[0]);
    }
  }

  // Fetch referred developers (who this dev brought to the city)
  const { data: referredDevs } = await sb
    .from("developers")
    .select("github_login, avatar_url")
    .eq("referred_by", dev.github_login)
    .order("claimed_at", { ascending: false })
    .limit(20);

  // Check if the logged-in user owns this building
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const authLogin = (
    user?.user_metadata?.user_name ??
    user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();
  const isOwner = !!user && authLogin === dev.github_login.toLowerCase() && dev.claimed;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: dev.name ?? dev.github_login,
      alternateName: dev.github_login,
      image: dev.avatar_url,
      url: `${baseUrl}/dev/${dev.github_login}`,
      sameAs: `https://leetcode.com/${dev.github_login}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "LeetCode City", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: `@${dev.github_login}`,
        item: `${baseUrl}/dev/${dev.github_login}`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <ProfileTracker login={dev.github_login} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-10">
        {/* Header */}
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-cream sm:mb-8"
        >
          &larr; Back to City
        </Link>

        {/* Profile Card */}
        <div className="border-[3px] border-border bg-bg-raised p-4 sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Avatar */}
            {dev.avatar_url && (
              <Image
                src={dev.avatar_url}
                alt={dev.github_login}
                width={100}
                height={100}
                className="border-[3px] border-border flex-shrink-0"
                style={{ imageRendering: "pixelated" }}
              />
            )}

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3">
                  {dev.name && (
                    <h1 className="text-xl text-cream sm:text-2xl">{dev.name}</h1>
                  )}
                </div>

                {activeTitle && (() => {
                  const bannerImages: Record<string, string> = {
                    title_creator: "/assets/banners/banner_city_creator.png",
                    title_lead_dev: "/assets/banners/banner_core_engineer.png",
                    title_sys_op: "/assets/banners/banner_database_master.png",
                  };

                  const imageUrl = bannerImages[activeTitle.slug];

                  if (imageUrl) {
                    return (
                      <div className="flex-shrink-0 select-none">
                        <Image
                          src={imageUrl}
                          alt={activeTitle.name}
                          width={180}
                          height={18}
                          className="h-[18px] w-[180px]"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    );
                  }

                  // Dynamic HTML/CSS Banner for other titles
                  const symbols: Record<string, string> = {
                    badge_bronze: "[ >_ ] ⛭",
                    badge_silver: "[ $ ] ⛭",
                    badge_gold: "[ ■ ] ⚒",
                    badge_platinum: "[ ❖ ] ✦",
                    badge_diamond: "[ ◆ ] ✦",
                    badge_legendary: "[ ⚔ ] ✦",
                    crown_of_code: "[ ♔ ] ✦",
                  };

                  const symbol = symbols[activeTitle.slug] ?? "[ ★ ]";

                  // Design borders based on category (shorter, no description text, smaller)
                  if (activeTitle.slug === "badge_platinum" || activeTitle.slug === "badge_diamond") {
                    return (
                      <div className="relative flex items-center gap-1.5 py-0.5 px-2.5 text-[8px] font-bold tracking-wide border border-solid flex-shrink-0"
                        style={{
                          borderColor: activeTitle.color,
                          backgroundColor: "#1b1921",
                          color: activeTitle.color,
                        }}
                      >
                        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l" style={{ borderColor: activeTitle.color }} />
                        <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r" style={{ borderColor: activeTitle.color }} />
                        <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l" style={{ borderColor: activeTitle.color }} />
                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r" style={{ borderColor: activeTitle.color }} />
                        
                        <span className="font-mono text-[9px]">{symbol}</span>
                        <span>{activeTitle.name.toUpperCase()}</span>
                      </div>
                    );
                  }

                  if (activeTitle.slug === "badge_legendary" || activeTitle.slug === "crown_of_code") {
                    return (
                      <div className="flex items-center flex-shrink-0">
                        <div className="w-2.5 h-4.5 border-y border-l flex-shrink-0" style={{
                          borderColor: activeTitle.color,
                          backgroundColor: "#1b1921",
                          clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
                        }} />
                        
                        <div
                          className="flex items-center gap-1.5 py-0.5 px-2 text-[8px] font-bold tracking-wide border-y border-x-[0.5px]"
                          style={{
                            borderColor: activeTitle.color,
                            backgroundColor: "#1b1921",
                            color: activeTitle.color,
                          }}
                        >
                          <span className="font-mono text-[9px]">{symbol}</span>
                          <span>{activeTitle.name.toUpperCase()}</span>
                        </div>

                        <div className="w-2.5 h-4.5 border-y border-r flex-shrink-0" style={{
                          borderColor: activeTitle.color,
                          backgroundColor: "#1b1921",
                          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                        }} />
                      </div>
                    );
                  }

                  return (
                    <div
                      className="flex items-center gap-1.5 py-0.5 px-2.5 text-[8px] font-bold tracking-wide border-[2px] border-double flex-shrink-0"
                      style={{
                        borderColor: activeTitle.color,
                        backgroundColor: "#1b1921",
                        color: activeTitle.color,
                      }}
                    >
                      <span className="font-mono text-[9px]">{symbol}</span>
                      <span>{activeTitle.name.toUpperCase()}</span>
                    </div>
                  );
                })()}
              </div>
              <p className="mt-1 text-sm text-muted">@{dev.github_login}</p>

              {/* Rank Badges — Global LC rank + City ranking */}
              {dev.rank && dev.rank < 999999 && (
                <div className="mt-2.5 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <div className="inline-block border-[1.5px] px-2 py-0.5 text-[9px]" style={{ borderColor: accent, color: accent }}>
                    🌍 LC Rank #{dev.rank.toLocaleString()}
                  </div>
                  {(dev as any).contest_rating > 0 && (
                    <div className="inline-block border-[1.5px] px-2 py-0.5 text-[9px]" style={{ borderColor: "#a855f7", color: "#a855f7" }}>
                      ⚔️ Contest {(dev as any).contest_rating.toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* District badge */}
              {dev.district && (
                <div className="mt-2 flex items-center gap-2 justify-center sm:justify-start">
                  <span
                    className="px-1.5 py-0.5 text-[8.5px] text-bg"
                    style={{ backgroundColor: DISTRICT_COLORS[dev.district] ?? '#888' }}
                  >
                    {DISTRICT_NAMES[dev.district] ?? dev.district}
                  </span>
                  {dev.district_rank && (
                    <span className="text-[8.5px] text-muted">
                      {dev.district_rank === 1 ? 'Mayor' : `#${dev.district_rank}`} in {DISTRICT_NAMES[dev.district]}
                    </span>
                  )}
                </div>
              )}

              {/* Claim */}
              <div className="mt-3">
                <ClaimButton githubLogin={dev.github_login} claimed={dev.claimed ?? false} />
              </div>
            </div>
          </div>

          {/* Bio */}
          {dev.bio && (
            <p className="mt-5 text-sm leading-relaxed text-muted normal-case">
              {dev.bio}
            </p>
          )}
        </div>

        {/* XP & Level */}
        {(() => {
          const xpLevel = dev.xp_level ?? 1;
          const xpTotal = dev.xp_total ?? 0;
          const tier = tierFromLevel(xpLevel);
          const rank = rankFromLevel(xpLevel);
          const progress = levelProgress(xpTotal);
          const xpCurrent = xpTotal - xpForLevel(xpLevel);
          const xpNeeded = xpForLevel(xpLevel + 1) - xpForLevel(xpLevel);
          return (
            <div className="mt-5 border-[3px] border-border bg-bg-raised p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center border-[2px] text-lg font-bold"
                  style={{ borderColor: tier.color, color: tier.color }}
                >
                  {xpLevel}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: tier.color }}>
                      {rank.title}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: tier.color + "22", color: tier.color }}
                    >
                      {tier.name.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-[5px] flex-1 bg-border">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(2, Math.round(progress * 100))}%`,
                          backgroundColor: tier.color,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-muted whitespace-nowrap">
                      {xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-right text-[9px] text-muted">
                {xpTotal.toLocaleString()} XP total
              </div>
            </div>
          );
        })()}

        {/* View in City (prominent) */}
        <div className="mt-5">
          <Link
            href={`/?user=${dev.github_login}`}
            className="btn-press flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm text-bg"
            style={{
              backgroundColor: accent,
              boxShadow: `4px 4px 0 0 ${shadow}`,
            }}
          >
            View in City
          </Link>
        </div>

        {/* Customize Building — only for the logged-in owner */}
        {isOwner && (
          <div className="mt-3">
            <Link
              href={`/shop/${dev.github_login}`}
              className="btn-press flex w-full items-center justify-center gap-2 border-[3px] border-border px-6 py-3 text-sm text-cream transition-colors hover:border-border-light"
            >
              Customize Building
            </Link>
          </div>
        )}

        {/* Share + Compare */}
        {!isOwner && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ShareButtons
                login={dev.github_login}
                contributions={dev.contributions ?? 0}
                rank={dev.rank}
                accent={accent}
                shadow={shadow}
              />
            </div>
            <CompareChallenge login={dev.github_login} accent={accent} shadow={shadow} />
          </div>
        )}

        {/* Stats Grid — LeetCode Metrics */}
        {(() => {
          const totalSolved = dev.contributions ?? 0;
          const easySolved = (dev as any).easy_solved as number ?? 0;
          const medSolved = (dev as any).medium_solved as number ?? 0;
          const hardSolved = (dev as any).hard_solved as number ?? 0;
          const streak = (dev as any).lc_streak as number ?? 0;
          const contestRating = (dev as any).contest_rating as number ?? 0;
          const reputation = dev.total_stars ?? 0;
          const hasLCData = easySolved > 0 || medSolved > 0 || hardSolved > 0;

          const baseStats = [
            { label: "Problems Solved", value: totalSolved.toLocaleString() },
            { label: "Reputation", value: reputation.toLocaleString() },
            { label: "🔥 Streak", value: streak > 0 ? `${streak} days` : "--" },
            { label: "Kudos", value: (dev.kudos_count ?? 0).toLocaleString() },
            { label: "Visits", value: (dev.visit_count ?? 0).toLocaleString() },
          ];

          const diffStats = hasLCData ? [
            { label: "🟢 Easy", value: easySolved.toLocaleString(), color: "#22c55e" },
            { label: "🟡 Medium", value: medSolved.toLocaleString(), color: "#f59e0b" },
            { label: "🔴 Hard", value: hardSolved.toLocaleString(), color: "#ef4444" },
          ] : [];

          return (
            <>
              {/* Difficulty breakdown */}
              {hasLCData && (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {diffStats.map((s) => (
                    <div key={s.label} className="border-[3px] border-border bg-bg-card p-4 text-center">
                      <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="mt-2 text-xs text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Main stats */}
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {baseStats.map((stat) => (
                  <div key={stat.label} className="border-[3px] border-border bg-bg-card p-4 text-center">
                    <div className="text-xl" style={{ color: accent }}>{stat.value}</div>
                    <div className="mt-2 text-xs text-muted">{stat.label}</div>
                  </div>
                ))}
                {contestRating > 0 && (
                  <div className="border-[3px] border-border bg-bg-card p-4 text-center">
                    <div className="text-xl" style={{ color: "#a855f7" }}>{contestRating.toLocaleString()}</div>
                    <div className="mt-2 text-xs text-muted">⚔️ Contest Rating</div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 text-sm text-cream">
              Achievements
              <span className="ml-2 text-[10px] text-muted">{achievements.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {achievements
                .sort((a, b) => {
                  const tierOrder = ["diamond", "gold", "silver", "bronze"];
                  return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
                })
                .map((ach) => {
                  const color = TIER_COLORS[ach.tier] ?? accent;
                  return (
                    <span
                      key={ach.achievement_id}
                      className="border-[2px] px-3 py-1 text-[10px]"
                      style={{ borderColor: color, color }}
                    >
                      {ach.name}
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* Owned Items */}
        {ownedItems.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 text-sm text-cream">Building Items</h2>
            <div className="flex flex-wrap gap-2">
              {ownedItems.map((itemId) => (
                <span
                  key={itemId}
                  className="border-[2px] px-3 py-1 text-[10px]"
                  style={{ borderColor: accent, color: accent }}
                >
                  {ITEM_NAMES[itemId] ?? itemId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Referral CTA — only for the logged-in owner */}
        {isOwner && (
          <div className="mt-5">
            <ReferralCTA login={dev.github_login} accent={accent} />
          </div>
        )}

        {/* Referred Developers */}
        {referredDevs && referredDevs.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 text-sm text-cream">
              Invited Devs
              <span className="ml-2 text-[10px] text-muted">{dev.referral_count ?? referredDevs.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {referredDevs.map((rd) => (
                <Link
                  key={rd.github_login}
                  href={`/dev/${rd.github_login}`}
                  className="flex items-center gap-2 border-[2px] border-border px-3 py-1.5 text-[10px] text-muted transition-colors hover:border-border-light hover:text-cream"
                >
                  {rd.avatar_url && (
                    <Image
                      src={rd.avatar_url}
                      alt={rd.github_login}
                      width={16}
                      height={16}
                      className="border border-border"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                  @{rd.github_login}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* LeetCode profile link */}
        <div className="mt-8 text-center">
          <a
            href={`https://leetcode.com/${dev.github_login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted transition-colors hover:text-cream normal-case"
          >
            leetcode.com/{dev.github_login} →
          </a>
        </div>

        {/* Creator credit */}
        <div className="mt-10 border-t border-border/50 pt-4 text-center">
          <p className="text-[9px] text-muted normal-case">
            built by{" "}
            <a
              href="https://github.com/Ixotic27"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-cream"
              style={{ color: accent }}
            >
              Ixotic
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

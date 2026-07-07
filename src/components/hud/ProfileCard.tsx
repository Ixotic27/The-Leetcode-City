/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import { useCity } from "@/context/CityContext";
import {
  tierFromLevel,
  rankFromLevel,
  levelProgress,
  xpForLevel,
} from "@/lib/xp";
import { DISTRICT_COLORS, DISTRICT_NAMES } from "@/lib/github";
import { ITEM_EMOJIS, ITEM_NAMES } from "@/lib/zones";

// Achievement display configurations
const TIER_COLORS_MAP: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};
const TIER_EMOJI_MAP: Record<string, string> = {
  bronze: "\uD83D\uDFE4",
  silver: "\u26AA",
  gold: "\uD83D\uDFE1",
  diamond: "\uD83D\uDC8E",
};
const ACHIEVEMENT_TIERS_MAP: Record<string, string> = {
  god_mode: "diamond",
  legend: "diamond",
  mayor: "diamond",
  machine: "gold",
  factory: "gold",
  influencer: "gold",
  philanthropist: "gold",
  icon: "gold",
  legendary: "gold",
  grinder: "silver",
  architect: "silver",
  patron: "silver",
  beloved: "silver",
  admired: "silver",
  first_push: "bronze",
  committed: "bronze",
  builder: "bronze",
  recruiter: "bronze",
  generous: "bronze",
  gifted: "bronze",
  appreciated: "bronze",
  on_fire: "bronze",
  generous_streak: "bronze",
  dedicated: "silver",
  obsessed: "gold",
  no_life: "diamond",
  white_rabbit: "diamond",
  daily_rookie: "bronze",
  daily_regular: "silver",
  daily_master: "gold",
  daily_legend: "diamond",
  contrib_planner: "silver",
  contrib_architect: "gold",
  contrib_founder: "diamond",
};
const ACHIEVEMENT_NAMES_MAP: Record<string, string> = {
  god_mode: "God Mode",
  legend: "Grandmaster",
  mayor: "Mayor",
  machine: "Algorithmist",
  factory: "Hardcore",
  influencer: "Influencer",
  grinder: "Grinder",
  architect: "Medium Master",
  builder: "Easy Breezy",
  recruiter: "Recruiter",
  committed: "Problem Solver",
  first_push: "First Blood",
  philanthropist: "Philanthropist",
  patron: "Patron",
  generous: "Generous",
  icon: "Icon",
  beloved: "Beloved",
  gifted: "Gifted",
  legendary: "Legendary",
  admired: "Admired",
  appreciated: "Appreciated",
  on_fire: "On Fire",
  dedicated: "Dedicated",
  obsessed: "Obsessed",
  no_life: "No Life",
  generous_streak: "Generous Streak",
  white_rabbit: "White Rabbit",
  daily_rookie: "Daily Rookie",
  daily_regular: "Daily Regular",
  daily_master: "Daily Master",
  daily_legend: "Daily Legend",
  contrib_planner: "City Planner",
  contrib_architect: "Architect",
  contrib_founder: "Founding Father",
};

export function BuildingCardSkeleton() {
  return (
    <div
      className="min-h-[360px] px-4 pb-4 pt-4"
      role="status"
      aria-live="polite"
      aria-label="Loading building profile"
    >
      <div className="mb-4 flex items-center gap-3">
        <Skeleton
          variant="circle"
          width={48}
          height={48}
          className="flex-shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton variant="text" width="68%" height={14} />
          <Skeleton variant="text" width="44%" height={10} />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Skeleton
          variant="rectangular"
          width={28}
          height={28}
          className="flex-shrink-0 rounded-none"
        />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="56%" height={10} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={4}
            className="rounded-none"
          />
        </div>
      </div>

      <Skeleton
        variant="rectangular"
        width={80}
        height={16}
        className="mb-3 rounded-none"
      />

      <div className="mb-4 grid grid-cols-3 gap-px border border-border/50 bg-border/30">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="space-y-2 bg-bg-card p-2">
            <Skeleton
              variant="text"
              width="70%"
              height={12}
              className="mx-auto"
            />
            <Skeleton
              variant="text"
              width="82%"
              height={8}
              className="mx-auto"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Skeleton
          variant="rectangular"
          width="50%"
          height={34}
          className="rounded-none"
        />
        <Skeleton
          variant="rectangular"
          width="50%"
          height={34}
          className="rounded-none"
        />
      </div>
    </div>
  );
}

export default function ProfileCard() {
  const {
    selectedBuilding,
    setSelectedBuilding,
    focusedBuilding,
    setFocusedBuilding,
    buildings,
    theme,
    flyMode,
    flyPaused,
    comparePair,
    raidState,
    raidActions,
    buildingCardLoading,
    refreshingStats,
    handleRefreshStats,
    identityResolved,
    session,
    linkedLeetCodeUsername,
    handleGiveKudos,
    handleOpenGift,
    kudosSending,
    kudosSent,
    kudosError,
    selfLogin,
    copied,
    setCopied,
    setCompareBuilding,
    exploreMode,
    setExploreMode,
    shopHref,
    handleSignIn,
  } = useCity();

  if (!selectedBuilding) return null;
  if (flyMode && !flyPaused) return null;
  if (comparePair) return null;
  if (raidState.phase !== "idle") return null;

  const authLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    session?.user?.user_metadata?.login ??
    ""
  ).toLowerCase();

  const isOwnBuilding =
    !!selectedBuilding &&
    !!linkedLeetCodeUsername &&
    selectedBuilding.login.toLowerCase() === linkedLeetCodeUsername.toLowerCase();

  return (
    <>
      {/* Nav hints — only on desktop, bottom-right */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden text-right text-[9px] leading-loose text-muted sm:block">
        <div>
          <span className="text-cream">Drag</span> orbit
        </div>
        <div>
          <span className="text-cream">Scroll</span> zoom
        </div>
        <div>
          <span className="text-cream" style={{ color: theme.accent }}>ESC</span> close
        </div>
      </div>

      {/* Card container — mobile: bottom sheet, desktop: fixed right side */}
      <div
        className="pointer-events-auto fixed z-40
      bottom-0 left-0 right-0
      sm:bottom-auto sm:left-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2"
      >
        <div
          className="relative border-t-[3px] border-border bg-bg-raised/95 backdrop-blur-sm
        w-full max-h-[50vh] overflow-y-auto sm:w-[320px] sm:border-[3px] sm:max-h-[85vh]
        animate-[slide-up_0.2s_ease-out] sm:animate-none"
        >
          {/* Close */}
          <button
            onClick={() => {
              setSelectedBuilding(null);
              setFocusedBuilding(null);
            }}
            className="absolute top-2 right-3 z-30 text-[10px] text-muted transition-colors hover:text-cream"
          >
            ESC
          </button>

          {/* Drag handle on mobile */}
          <div className="flex justify-center py-2 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {buildingCardLoading ? (
            <BuildingCardSkeleton />
          ) : (
            <div>
              {/* Header with avatar + name */}
              <div className="flex items-center gap-3 px-4 pb-3 sm:pt-4">
                {selectedBuilding.avatar_url && (
                  <Image
                    src={selectedBuilding.avatar_url}
                    alt={selectedBuilding.login}
                    width={48}
                    height={48}
                    className="border-[2px] border-border flex-shrink-0"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {selectedBuilding.name && (
                      <p className="truncate text-sm text-cream">
                        {selectedBuilding.name}
                      </p>
                    )}
                    {selectedBuilding.claimed && (
                      <span
                        className="flex-shrink-0 px-1.5 py-0.5 text-[7px] text-bg"
                        style={{ backgroundColor: theme.accent }}
                      >
                        Claimed
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-[10px] text-muted">
                      @{selectedBuilding.login}
                    </p>
                    <button
                      onClick={handleRefreshStats}
                      disabled={refreshingStats}
                      className="text-[10px] text-muted transition-colors hover:text-cream disabled:opacity-50"
                      title="Refresh Stats"
                    >
                      {refreshingStats ? "..." : "↻"}
                    </button>
                  </div>
                  {selectedBuilding.active_raid_tag && (
                    <p className="text-[8px] text-red-400">
                      Attacked by @
                      {selectedBuilding.active_raid_tag.attacker_login}
                    </p>
                  )}
                </div>
              </div>

              {/* XP Level badge + progress */}
              {(() => {
                const bTier = tierFromLevel(selectedBuilding.xp_level ?? 1);
                const bRank = rankFromLevel(selectedBuilding.xp_level ?? 1);
                const bProgress = levelProgress(selectedBuilding.xp_total ?? 0);
                const bXpCurrent =
                  (selectedBuilding.xp_total ?? 0) -
                  xpForLevel(selectedBuilding.xp_level ?? 1);
                const bXpNeeded =
                  xpForLevel((selectedBuilding.xp_level ?? 1) + 1) -
                  xpForLevel(selectedBuilding.xp_level ?? 1);
                return (
                  <div className="mx-4 mb-2 flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center border-[2px] text-xs font-bold"
                      style={{ borderColor: bTier.color, color: bTier.color }}
                    >
                      {selectedBuilding.xp_level ?? 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: bTier.color }}
                        >
                          Lv {selectedBuilding.xp_level ?? 1} · {bRank.title}
                        </span>
                        <span
                          className="px-1 py-px text-[7px] font-bold"
                          style={{
                            backgroundColor: bTier.color + "22",
                            color: bTier.color,
                          }}
                        >
                          {bTier.name.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-[4px] flex-1 bg-border">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.max(2, Math.round(bProgress * 100))}%`,
                              backgroundColor: bTier.color,
                            }}
                          />
                        </div>
                        <span className="text-[7px] text-muted">
                          {bXpCurrent}/{bXpNeeded}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* District badge */}
              {selectedBuilding.district && (
                <div className="px-4 pb-2">
                  <span
                    className="inline-block px-2 py-0.5 text-[8px] text-bg"
                    style={{
                      backgroundColor:
                        DISTRICT_COLORS[selectedBuilding.district] ?? "#888",
                    }}
                  >
                    {DISTRICT_NAMES[selectedBuilding.district] ??
                      selectedBuilding.district}
                  </span>
                </div>
              )}

              {/* Stats */}
              {(() => {
                const cityPos =
                  buildings
                    .slice()
                    .sort((a, b) => b.contributions - a.contributions)
                    .findIndex((b) => b.login === selectedBuilding.login) + 1;

                const lcRank = selectedBuilding.rank ?? 0;
                const lcRankStr =
                  lcRank === 0 || lcRank === 999999
                    ? "N/A"
                    : `#${lcRank.toLocaleString()}`;
                const solved = selectedBuilding.contributions;
                const easySolved = selectedBuilding.easy_solved ?? 0;
                const medSolved = selectedBuilding.medium_solved ?? 0;
                const hardSolved = selectedBuilding.hard_solved ?? 0;
                const contestRating = selectedBuilding.contest_rating ?? 0;
                const streak = selectedBuilding.lc_streak ?? 0;
                const reputation = selectedBuilding.total_stars;
                const acceptanceRateRaw = selectedBuilding.acceptance_rate;
                const acceptanceRate =
                  typeof acceptanceRateRaw === "number" && !isNaN(acceptanceRateRaw)
                    ? acceptanceRateRaw
                    : -1;

                const statsList = [
                  {
                    label: "City Rank",
                    value: cityPos > 0 ? `#${cityPos}` : "--",
                  },
                  { label: "LC Rank", value: lcRankStr },
                  { label: "Solved", value: solved.toLocaleString() },
                  {
                    label: "Acceptance",
                    value:
                      acceptanceRate >= 0
                        ? `${(acceptanceRate * 100).toFixed(1)}%`
                        : "--",
                  },
                  {
                    label: "Language",
                    value: selectedBuilding?.primary_language ?? "--",
                  },
                  ...(easySolved || medSolved || hardSolved
                    ? [
                        { label: "Easy", value: easySolved.toLocaleString() },
                        {
                          label: "Medium",
                          value: medSolved.toLocaleString(),
                        },
                        { label: "Hard", value: hardSolved.toLocaleString() },
                      ]
                    : []),
                  {
                    label: "Streak",
                    value: streak > 0 ? `${streak}d` : "--",
                  },
                  {
                    label: "Contest",
                    value:
                      contestRating > 0
                        ? contestRating.toLocaleString()
                        : "--",
                  },
                  { label: "Reputation", value: reputation.toLocaleString() },
                  {
                    label: "Kudos",
                    value: (selectedBuilding.kudos_count ?? 0).toLocaleString(),
                  },
                  {
                    label: "Visits",
                    value: (selectedBuilding.visit_count ?? 0).toLocaleString(),
                  },
                ];

                return (
                  <div className="grid grid-cols-3 gap-px bg-border/30 mx-4 mb-3 border border-border/50">
                    {statsList.map((s) => (
                      <div key={s.label} className="bg-bg-card p-2 text-center">
                        <div className="text-xs" style={{ color: theme.accent }}>
                          {s.value}
                        </div>
                        <div className="text-[8px] text-muted mt-0.5">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Achievements with tier colors */}
              {selectedBuilding.achievements && selectedBuilding.achievements.length > 0 && (
                <div className="mx-4 mb-3 flex flex-wrap gap-1">
                  {[...selectedBuilding.achievements]
                    .sort((a, b) => {
                      const tierOrder = ["diamond", "gold", "silver", "bronze"];
                      const ta = tierOrder.indexOf(ACHIEVEMENT_TIERS_MAP[a] ?? "bronze");
                      const tb = tierOrder.indexOf(ACHIEVEMENT_TIERS_MAP[b] ?? "bronze");
                      return ta - tb;
                    })
                    .slice(0, 3)
                    .map((ach) => {
                      const tier = ACHIEVEMENT_TIERS_MAP[ach];
                      const color = tier ? TIER_COLORS_MAP[tier] : undefined;
                      const emoji = tier ? TIER_EMOJI_MAP[tier] : "";
                      return (
                        <span
                          key={ach}
                          className="px-1.5 py-0.5 text-[8px] border normal-case"
                          style={{
                            borderColor: color ?? "rgba(255,255,255,0.15)",
                            color: color ?? "#a0a0b0",
                          }}
                        >
                          {emoji} {ACHIEVEMENT_NAMES_MAP[ach] ?? ach.replace(/_/g, " ")}
                        </span>
                      );
                    })}
                  {selectedBuilding.achievements.length > 3 && (
                    <Link
                      href={`/dev/${selectedBuilding.login}`}
                      className="px-1.5 py-0.5 text-[8px] transition-colors hover:text-cream"
                      style={{ color: theme.accent }}
                    >
                      +{selectedBuilding.achievements.length - 3} more &rarr;
                    </Link>
                  )}
                </div>
              )}

              {/* Equipped items on other devs' buildings */}
              {identityResolved &&
                !isOwnBuilding &&
                (() => {
                  const equipped: string[] = [];
                  const loadout = selectedBuilding.loadout as any;
                  if (loadout?.crown) equipped.push(loadout.crown);
                  if (loadout?.roof) equipped.push(loadout.roof);
                  if (loadout?.aura) equipped.push(loadout.aura);
                  for (const fi of ["custom_color", "billboard", "led_banner"]) {
                    if (selectedBuilding.owned_items?.includes(fi)) equipped.push(fi);
                  }
                  if (equipped.length === 0) return null;
                  const shown = equipped.slice(0, 3);
                  const extra = equipped.length - 3;
                  return (
                    <div
                      className="mx-4 mb-3 border-[2px] p-2.5"
                      style={{
                        borderColor: `${theme.accent}33`,
                        backgroundColor: `${theme.accent}08`,
                      }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {shown.map((id) => (
                          <span
                            key={id}
                            className="text-[9px] normal-case"
                            style={{ color: theme.accent }}
                          >
                            {ITEM_EMOJIS[id] ?? "🎁"} {ITEM_NAMES[id] ?? id}
                          </span>
                        ))}
                        {extra > 0 && <span className="text-[9px] text-muted">+{extra} more</span>}
                      </div>
                      {identityResolved && session && !isOwnBuilding && (
                        <Link
                          href={`/shop/${selfLogin}`}
                          className="btn-press mt-2 block w-full py-1.5 text-center text-[9px] text-bg"
                          style={{
                            backgroundColor: theme.accent,
                            boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                          }}
                        >
                          Get these for your building
                        </Link>
                      )}
                    </div>
                  );
                })()}

              {/* Kudos: give kudos */}
              {identityResolved && session && !isOwnBuilding && (
                <div className="relative mx-4 mb-3">
                  {kudosSent && (
                    <div className="pointer-events-none absolute inset-0 overflow-visible">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span
                          key={i}
                          className="kudos-float absolute text-sm"
                          style={{
                            left: `${15 + i * 14}%`,
                            animationDelay: `${i * 0.08}s`,
                          }}
                        >
                          {["👏", "⭐", "💛", "✨", "👏", "⭐"][i]}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleGiveKudos}
                    disabled={kudosSending || kudosSent || !!kudosError}
                    className={[
                      "btn-press w-full py-2 text-[10px] text-bg transition-all duration-300",
                      kudosSent ? "scale-[1.02]" : "",
                    ].join(" ")}
                    style={{
                      backgroundColor: kudosError
                        ? "#ff4444"
                        : kudosSent
                          ? "#39d353"
                          : theme.accent,
                      boxShadow: kudosError
                        ? "0 0 12px rgba(255,68,68,0.4)"
                        : kudosSent
                          ? "0 0 12px rgba(57,211,83,0.4)"
                          : `2px 2px 0 0 ${theme.shadow}`,
                    }}
                  >
                    {kudosSending ? (
                      <span className="animate-pulse">Sending...</span>
                    ) : kudosError ? (
                      <span>{kudosError}</span>
                    ) : kudosSent ? (
                      <span>+1 Kudos!</span>
                    ) : (
                      "Give Kudos"
                    )}
                  </button>
                  <button
                    onClick={handleOpenGift}
                    className="btn-press mt-1.5 w-full border-[2px] border-border py-1.5 text-[9px] text-cream transition-colors hover:border-border-light"
                  >
                    Send Gift
                  </button>
                  {raidState.phase === "idle" && raidState.error && (
                    <p className="mt-1.5 text-center text-[10px] text-red-400">
                      {raidState.error}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (authLogin && selectedBuilding) {
                        raidActions.startPreview(selectedBuilding.login, buildings, authLogin);
                      }
                    }}
                    disabled={raidState.loading}
                    className="btn-press mt-1.5 w-full border-[3px] border-red-500/60 px-4 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    {raidState.loading ? "Loading..." : "⚔️ BATTLE — Win +50 XP"}
                  </button>
                </div>
              )}

              {/* Disabled action buttons for non-logged users */}
              {identityResolved && !session && (
                <div className="mx-4 mb-3 space-y-1.5">
                  <button
                    onClick={() => {
                      try {
                        const { trackDisabledButtonClicked } = require("@/lib/himetrica");
                        trackDisabledButtonClicked("kudos");
                      } catch {}
                      handleSignIn();
                    }}
                    className="btn-press w-full py-2 text-[10px] border-[2px] border-dashed border-border/50 text-muted/60 transition-colors hover:border-border hover:text-muted"
                  >
                    🔒 Give Kudos
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const { trackDisabledButtonClicked } = require("@/lib/himetrica");
                        trackDisabledButtonClicked("gift");
                      } catch {}
                      handleSignIn();
                    }}
                    className="btn-press w-full py-1.5 text-[9px] border-[2px] border-dashed border-border/50 text-muted/60 transition-colors hover:border-border hover:text-muted"
                  >
                    🔒 Send Gift
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const { trackDisabledButtonClicked } = require("@/lib/himetrica");
                        trackDisabledButtonClicked("raid");
                      } catch {}
                      handleSignIn();
                    }}
                    className="btn-press w-full py-2 text-[10px] border-[2px] border-dashed border-red-500/30 text-red-400/40 transition-colors hover:border-red-500/60 hover:text-red-400/70"
                  >
                    🔒 ⚔️ BATTLE
                  </button>
                </div>
              )}

              {/* Own building: copy invite link */}
              {identityResolved && isOwnBuilding && (
                <div className="mx-4 mb-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/?ref=${selfLogin}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="btn-press w-full border-[2px] border-border py-1.5 text-center text-[9px] text-cream transition-colors hover:border-border-light"
                  >
                    {copied ? "Copied!" : "📋 Copy Invite Link"}
                  </button>
                </div>
              )}

              {/* Compare button */}
              {identityResolved && !flyMode && !isOwnBuilding && (
                <div className="mx-4 mb-3">
                  <button
                    onClick={() => {
                      setCompareBuilding(selectedBuilding);
                      setSelectedBuilding(null);
                      if (!exploreMode) setExploreMode(true);
                    }}
                    className="btn-press w-full border-[2px] border-border py-1.5 text-center text-[9px] text-cream transition-colors hover:border-border-light"
                  >
                    Compare
                  </button>
                </div>
              )}

              {/* Final Actions */}
              {identityResolved && (
                <div className="flex gap-2 p-4 pt-0 pb-5 sm:pb-4">
                  {isOwnBuilding ? (
                    <>
                      <Link
                        href={`/shop/${selfLogin}?tab=loadout`}
                        className="btn-press flex-1 py-2 text-center text-[10px] text-bg"
                        style={{
                          backgroundColor: theme.accent,
                          boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                        }}
                      >
                        Loadout
                      </Link>
                      <Link
                        href={`/dev/${selfLogin}`}
                        className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
                      >
                        Profile
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/dev/${selectedBuilding.login}`}
                        className="btn-press flex-1 py-2 text-center text-[10px] text-bg"
                        style={{
                          backgroundColor: theme.accent,
                          boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                        }}
                      >
                        View Profile
                      </Link>
                      <a
                        href={`https://leetcode.com/u/${selectedBuilding.login}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
                      >
                        LeetCode
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

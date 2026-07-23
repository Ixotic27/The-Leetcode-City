/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import MiniMap from "@/components/MiniMap";
import CityAnalyticsDashboard from "@/components/CityAnalyticsDashboard";
import ActivityTicker from "@/components/ActivityTicker";
import ActivityPanel from "@/components/ActivityPanel";
import DailiesWidget from "@/components/DailiesWidget";
import LevelUpToast from "@/components/LevelUpToast";
import XpBar from "@/components/XpBar";
import { useCity } from "@/context/CityContext";
import MiniLeaderboard from "./MiniLeaderboard";
import { SearchFeedback } from "./SearchBar";
import { ITEM_NAMES } from "@/lib/zones";

// Feature flags
const MILESTONE_MODE: "stars" | "devs" | "donation" = "donation";

function getStreakTierColor(streak: number) {
  if (streak >= 30) return "#aa44ff";
  if (streak >= 14) return "#ff2222";
  if (streak >= 7) return "#ff8833";
  return "#4488ff";
}

export default function CityHUD() {
  const {
    flyMode,
    lastDistrictRef,
    setUsername,
    exploreMode,
    introMode,
    rabbitCinematic,
    buildings,
    liveUsers,
    liveByLogin,
    districtZones,
    theme,
    stats,
    githubStars,
    discordMembers,
    themeIndex,
    cycleTheme,
    dayNightCycleActive,
    setDayNightCycleActive,
    weatherMode,
    cycleWeather,
    session,
    myBuilding,
    hasFreeGift,
    handleClaimFreeGift,
    claimingGift,
    setExploreMode,
    setEArcadeOpen,
    arcadeOnline,
    setFlyMode,
    setFlyScore,
    flyStartTime,
    flyPausedAt,
    flyTotalPauseMs,
    setFlyElapsedSec,
    setQuotaReached,
    setQuotaNotified,
    setQuotaDismissed,
    setFlyPersonalBest,
    setShowFlyControls,
    showFlyHint,
    setShowFlyHint,
    flyHintTimerRef,
    showDailyNudge,
    setShowDailyNudge,
    dailyNudgeTimerRef,
    shopHref,
    handleSignIn,
    handleSignOut,
    needsToLink,
    setShowLinkModal,
    linkedLeetCodeUsername,
    streakData,
    setIsCodexOpen,
    setIsRelicModalOpen,
    playerPos,
    analyticsOpen,
    setAnalyticsOpen,
    feedEvents,
    setFeedEvents,
    feedPanelOpen,
    setFeedPanelOpen,
    dailiesData,
    claimDailies,
    refreshDailies,
    dailyToasts,
    raidToast,
    levelUpLevel,
    setLevelUpLevel,
    purchasedItem,
    giftedInfo,
    signInPromptVisible,
    setSignInPromptVisible,
    adToast,
    ghostPreviewLogin,
    setGhostPreviewLogin,
    effectiveLiveStatus,
    effectiveLiveCount,
    setFocusedBuilding,
    setSelectedBuilding,
    username,
    feedback,
    setFeedback,
    loading,
  } = useCity();

  // Search input specifically for the landing page
  const [landingSearchInput, setLandingSearchInput] = useState("");

  const handleLandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingSearchInput.trim()) return;
    setUsername(landingSearchInput);
    
    // Trigger submit on the SearchBar form
    setTimeout(() => {
      const searchForm = document.querySelector("#search-bar-form") as HTMLFormElement;
      if (searchForm) {
        searchForm.requestSubmit();
      }
    }, 0);
  };

  const isMobile = typeof window !== "undefined" ? window.innerWidth < 640 || "ontouchstart" in window : false;

  // ESC key to exit explore mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && exploreMode && !flyMode) {
        setExploreMode(false);
        setFocusedBuilding(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [exploreMode, flyMode, setExploreMode, setFocusedBuilding]);

  return (
    <>
      {/* ─── ESC BACK Button (visible during explore mode) ─── */}
      {exploreMode && !flyMode && !introMode && !rabbitCinematic && (
        <button
          onClick={() => {
            setExploreMode(false);
            setFocusedBuilding(null);
          }}
          className="pointer-events-auto fixed top-3 left-3 z-[40] flex items-center gap-1.5 border-[2px] border-border bg-bg/90 px-3 py-1.5 text-[10px] tracking-wider text-cream backdrop-blur-sm transition-colors hover:bg-white/10 active:bg-white/5"
          style={{ boxShadow: `2px 2px 0 0 ${theme.shadow}` }}
        >
          <kbd className="text-[9px] opacity-60">ESC</kbd>
          <span style={{ color: theme.accent }}>BACK</span>
        </button>
      )}

      {/* ─── Main Landing Panel ─── */}
      {!flyMode && !exploreMode && !introMode && !rabbitCinematic && (
        <div
          className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between pt-10 pb-14 px-3 sm:py-8 sm:px-4"
          style={{
            background:
              "linear-gradient(to bottom, rgba(13,13,15,0.88) 0%, rgba(13,13,15,0.55) 30%, transparent 60%, transparent 85%, rgba(13,13,15,0.5) 100%)",
          }}
        >
          {/* Top Info Banner */}
          <div className="pointer-events-auto flex w-full max-w-2xl flex-col items-center gap-2 sm:gap-5">
            <div className="text-center">
              <h1 className="text-2xl text-cream sm:text-3xl md:text-5xl">
                LeetCode <span style={{ color: theme.accent }}>City</span>
              </h1>
              <p className="mt-2 text-[10px] leading-relaxed text-cream/80 normal-case">
                {stats.total_developers > 0
                  ? `A city of ${stats.total_developers.toLocaleString()} LeetCode developers. Find yourself.`
                  : "A global city of LeetCoders. Find yourself."}
              </p>
              <p className="pointer-events-auto mt-1 text-[9px] text-cream/50 normal-case hidden sm:block">
                built by{" "}
                <a
                  href="https://github.com/Ixotic27"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-cream"
                  style={{ color: theme.accent }}
                >
                  Ixotic
                </a>
              </p>            {/* Milestone progress banner */}
            <div className="flex justify-center w-full">
              {(() => {
                if (MILESTONE_MODE === "donation") {
                  const current = stats?.renewal_raised_inr ?? 0;
                  const target = stats?.renewal_target_inr ?? 2900;
                  const pct = Math.min(100, (current / target) * 100);
                  const isDone = current >= target;

                  return (
                    <div className="pointer-events-auto mt-2 w-full max-w-lg border-[3px] border-border bg-bg-raised p-4 sm:p-5 relative overflow-hidden text-left font-pixel font-bold uppercase text-cream">
                      {/* Grid background effect */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,161,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,161,22,0.02)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                          <div>
                            <p className="text-[9px] sm:text-[10px] tracking-wider" style={{ color: theme.accent }}>
                              &gt; CAMPAIGN: WEBSITE RENEWAL
                            </p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right font-pixel">
                            <span className="text-xs text-cream font-bold">
                              ₹{current.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-muted">
                              {` / ₹${target.toLocaleString()} INR`}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Track */}
                        <div className="mt-3.5 h-6 border-[2px] border-border bg-black/40 relative p-[2px] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 relative transition-all duration-1000 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
                            }}
                          >
                            <div className="absolute inset-y-0 right-0 w-2 bg-white/40 shadow-[0_0_8px_#ffa116]" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-cream drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] font-bold">
                            {isDone ? "RENEWAL SECURED!" : `${Math.round(pct)}% FUNDED`}
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[8px] sm:text-[9px] text-muted font-bold">
                          <span>STATUS: {isDone ? "GOAL ACHIEVED!" : "ACTIVE — AWAITING POWER"}</span>
                          <a href="/support" className="hover:underline text-right" style={{ color: theme.accent }}>
                            SUPPORT THE SIGNAL &rarr;
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                } else if (MILESTONE_MODE === "stars") {
                  const MILESTONES = [100, 250, 500, 1000, 2000, 5000];
                  const current = githubStars;
                  const target = MILESTONES.find((m) => current < m) || 10000;
                  const pct = Math.min(100, (current / target) * 100);
                  const isDone = current >= target;

                  return (
                    <div className="pointer-events-auto mt-2 w-full max-w-lg border-[3px] border-border bg-bg-raised p-4 sm:p-5 relative overflow-hidden text-left font-pixel font-bold uppercase text-cream">
                      {/* Grid background effect */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,161,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,161,22,0.02)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                          <div>
                            <p className="text-[9px] sm:text-[10px] tracking-wider" style={{ color: theme.accent }}>
                              &gt; CAMPAIGN: STAR GAZER
                            </p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right font-pixel">
                            <span className="text-xs text-cream font-bold">
                              {current.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-muted">
                              {` / ${target.toLocaleString()} STARS`}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Track */}
                        <div className="mt-3.5 h-6 border-[2px] border-border bg-black/40 relative p-[2px] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 relative transition-all duration-1000 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
                            }}
                          >
                            <div className="absolute inset-y-0 right-0 w-2 bg-white/40 shadow-[0_0_8px_#ffa116]" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-cream drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] font-bold">
                            {isDone ? "GOAL REACHED!" : `${Math.round(pct)}% COMPLETED`}
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[8px] sm:text-[9px] text-muted font-bold">
                          <span>STATUS: {isDone ? "GOAL ACHIEVED!" : "ACTIVE — AWAITING POWER"}</span>
                          <a
                            href="https://github.com/Ixotic27/The-Leetcode-City"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-right"
                            style={{ color: theme.accent }}
                          >
                            STAR THE REPO &rarr;
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const MILESTONES = [10000, 20000, 50000, 100000];
                  const count = stats.total_developers;
                  if (count <= 0) return null;
                  const target = MILESTONES.find((m) => count < m);
                  if (!target) return null;
                  const prev = MILESTONES[MILESTONES.indexOf(target) - 1] ?? 0;
                  const progress = ((count - prev) / (target - prev)) * 100;
                  const remaining = target - count;
                  const label = target >= 1000 ? `${target / 1000}K` : target.toLocaleString();
                  const isDone = count >= target;

                  return (
                    <div className="pointer-events-auto mt-2 w-full max-w-lg border-[3px] border-border bg-bg-raised p-4 sm:p-5 relative overflow-hidden text-left font-pixel font-bold uppercase text-cream">
                      {/* Grid background effect */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,161,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,161,22,0.02)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                          <div>
                            <p className="text-[9px] sm:text-[10px] tracking-wider" style={{ color: theme.accent }}>
                              &gt; CAMPAIGN: CITY EXPANSION
                            </p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right font-pixel">
                            <span className="text-xs text-cream font-bold">
                              {count.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-muted">
                              {` / ${target.toLocaleString()} DEVS`}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Track */}
                        <div className="mt-3.5 h-6 border-[2px] border-border bg-black/40 relative p-[2px] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 relative transition-all duration-1000 ease-out"
                            style={{
                              width: `${progress}%`,
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)",
                            }}
                          >
                            <div className="absolute inset-y-0 right-0 w-2 bg-white/40 shadow-[0_0_8px_#ffa116]" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] text-cream drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] font-bold">
                            {isDone ? "GOAL REACHED!" : `${Math.round(progress)}% COMPLETED`}
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[8px] sm:text-[9px] text-muted font-bold">
                          <span>STATUS: {isDone ? "GOAL ACHIEVED!" : "ACTIVE — AWAITING POPULATION"}</span>
                          <span style={{ color: theme.accent }}>{remaining.toLocaleString()} TO GO</span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

              {/* Search Input Form */}
              <form
                onSubmit={handleLandingSubmit}
                className="flex w-full max-w-lg items-center gap-2 mt-4"
              >
                <input
                  type="text"
                  value={landingSearchInput}
                  onChange={(e) => {
                    setLandingSearchInput(e.target.value);
                    if (feedback?.type === "error") setFeedback(null);
                  }}
                  placeholder={session ? "search any LeetCode username" : "type your LeetCode username"}
                  className="min-w-0 flex-1 border-[3px] border-border bg-bg-raised px-3 py-2 text-base sm:text-xs text-cream outline-none backdrop-blur-sm transition-colors placeholder:text-dim sm:px-4 sm:py-2.5"
                  onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                />
                <button
                  type="submit"
                  disabled={loading || !landingSearchInput.trim()}
                  className="btn-press flex-shrink-0 px-4 py-2 text-xs text-bg disabled:opacity-40 sm:px-5 sm:py-2.5"
                  style={{
                    backgroundColor: theme.accent,
                    boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                  }}
                >
                  {loading ? <span className="blink-dot inline-block">_</span> : "Search"}
                </button>
              </form>

              {/* Search Feedback */}
              <div className="w-full max-w-lg">
                <SearchFeedback
                  feedback={feedback}
                  accentColor={theme.accent}
                  onDismiss={() => setFeedback(null)}
                  onRetry={() => {
                    window.dispatchEvent(new CustomEvent("leetcodecity:search"));
                  }}
                />
              </div>

              {/* Primary & Secondary actions grouped together just below search feedback */}
              {buildings.length > 0 && (
                <div className="pointer-events-auto flex flex-col items-center gap-3 mt-3 w-full max-w-lg">
                  {/* Free Gift CTA */}
                  {hasFreeGift && (
                    <button
                      onClick={handleClaimFreeGift}
                      disabled={claimingGift}
                      className="gift-cta btn-press w-full py-2.5 text-xs text-bg disabled:opacity-60"
                      style={{
                        backgroundColor: theme.accent,
                        boxShadow: `2px 2px 0 0 ${theme.shadow}`,
                      }}
                    >
                      {claimingGift ? "Opening..." : "🎁 Open Free Gift!"}
                    </button>
                  )}

                  {/* Row 1: Explore City and Fly (Big buttons, side-by-side) */}
                  <div className="flex w-full items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => setExploreMode(true)}
                      className="btn-press flex-1 py-3 text-xs sm:py-3.5 sm:text-sm text-bg text-center font-bold px-6"
                      style={{
                        backgroundColor: theme.accent,
                        boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                      }}
                    >
                      Explore City
                      <span className="block text-[8px] opacity-60 normal-case font-normal">Browse Buildings</span>
                    </button>
                    <button
                      onClick={() => {
                        setFocusedBuilding(null);
                        setFlyMode(true);
                        setFlyScore({ score: 0, earned: 0, combo: 0, collected: 0, maxCombo: 1 });
                        flyStartTime.current = Date.now();
                        flyPausedAt.current = 0;
                        flyTotalPauseMs.current = 0;
                        setFlyElapsedSec(0);
                        try {
                          setFlyPersonalBest(
                            parseInt(localStorage.getItem("leetcodecity_fly_pb") || "0", 10) || 0
                          );
                        } catch {
                          setFlyPersonalBest(0);
                        }
                        if (!localStorage.getItem("leetcodecity_fly_controls_seen")) {
                          setShowFlyControls(true);
                        }
                      }}
                      className="btn-press flex-1 py-3 text-xs sm:py-3.5 sm:text-sm text-bg text-center font-bold px-6"
                      style={{
                        backgroundColor: theme.accent,
                        boxShadow: `4px 4px 0 0 ${theme.shadow}`,
                      }}
                    >
                      ✈ Fly
                      <span className="block text-[8px] opacity-60 normal-case font-normal">Collect PX</span>
                    </button>
                  </div>

                  {/* Row 2: Arcade, Leaderboard, Roadmap (Smaller buttons, side-by-side) */}
                  <div className="flex w-full items-center justify-center gap-3 mt-1.5">
                    <button
                      onClick={() => setEArcadeOpen(true)}
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      🕹️ ARCADE
                    </button>
                    <Link
                      href="/leaderboard"
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      🏆 LEADERBOARD
                    </Link>
                    <Link
                      href="/roadmap"
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      🗺️ ROADMAP
                    </Link>
                  </div>

                  {/* Row 3: Shop, Compare and Arena (Smaller buttons, side-by-side) */}
                  <div className="flex w-full items-center justify-center gap-3 mt-1.5">
                    <Link
                      href={shopHref}
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      🛍️ SHOP
                    </Link>
                    <Link
                      href="/compare"
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      ⚖️ COMPARE
                    </Link>
                    <Link
                      href="/arena"
                      className="btn-press flex-1 border-[2px] border-border bg-bg/85 py-2.5 sm:py-3 text-[9px] sm:text-[10px] tracking-wider text-cream font-bold transition-colors hover:bg-white/10 active:bg-white/5 text-center"
                      style={{ boxShadow: `3px 3px 0 0 ${theme.shadow}` }}
                    >
                      ⚔️ ARENA
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secondary links & keyboard hints (Bottom aligned) */}
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {/* Live stats footer */}
            <div className="flex items-center gap-4 text-[8px] text-cream/40 tracking-wider">
              {(discordMembers ?? 0) > 0 && (
                <span>{discordMembers} on Discord</span>
              )}
            </div>

            {/* Keyboard hint for desktop */}
            {!isMobile && buildings.length > 0 && (
              <p className="hidden sm:block text-[8px] text-cream/25 tracking-wider">
                Press <kbd className="px-1 py-0.5 border border-border/40 rounded text-[7px] text-cream/40 mx-0.5">E</kbd> to explore
                 · <kbd className="px-1 py-0.5 border border-border/40 rounded text-[7px] text-cream/40 mx-0.5">F</kbd> to fly
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Mobile Bottom Bar (game-style nav) ─── */}
      {!flyMode && !exploreMode && !introMode && !rabbitCinematic && buildings.length > 0 && (
        <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-[35] flex items-center justify-around border-t-[2px] border-border bg-bg/95 px-1 py-2 backdrop-blur-md sm:hidden">
          <Link
            href="/arena"
            className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
            style={{ color: theme.accent }}
          >
            ⚔️ Arena
          </Link>
          <Link
            href={shopHref}
            className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
            style={{ color: theme.accent }}
          >
            Shop
          </Link>
          <Link
            href="/advertise"
            className="btn-press relative border-[2px] px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
            style={{
              color: theme.accent,
              borderColor: theme.accent + "60",
              backgroundColor: theme.accent + "12",
            }}
          >
            Ad
            <span
              className="absolute -top-1.5 -right-1.5 rounded-sm px-0.5 py-px text-[6px] font-bold leading-none text-bg"
              style={{ backgroundColor: theme.accent }}
            >
              NEW
            </span>
          </Link>
          <Link
            href="/leaderboard"
            className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
            style={{ color: theme.accent }}
          >
            👑 Rank
          </Link>
          <button
            onClick={() => setIsRelicModalOpen(true)}
            className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] transition-colors active:bg-white/5 text-cream"
            style={{ color: "#ffa116" }}
          >
            Relics
          </button>
          {!session ? (
            <button
              onClick={handleSignIn}
              className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
            >
              <span style={{ color: theme.accent }}>G</span> <span className="text-cream">Sign in</span>
            </button>
          ) : (
            <>
              {needsToLink && (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="btn-press border-[2px] px-3 py-1.5 text-[10px] transition-colors active:bg-white/5"
                  style={{
                    backgroundColor: theme.accent,
                    borderColor: theme.shadow,
                    color: "#0a0c10",
                  }}
                >
                  Link
                </button>
              )}
              {linkedLeetCodeUsername && (
                <>
                  <Link
                    href="/settings"
                    className="btn-press flex items-center border-[2px] border-border px-2 py-1.5 text-[10px] text-muted transition-colors active:bg-white/5"
                    title="Settings"
                  >
                    ⚙️
                  </Link>
                  <Link
                    href={`/dev/${linkedLeetCodeUsername}`}
                    className="btn-press flex items-center gap-1.5 border-[2px] border-border px-3 py-1.5 text-[10px] normal-case transition-colors active:bg-white/5"
                    style={
                      streakData && streakData.streak > 0 && streakData.checked_in
                        ? { animation: "streak-pulse 1.5s ease-in-out 2" }
                        : undefined
                    }
                  >
                    @{linkedLeetCodeUsername.slice(0, 6)}
                    {streakData && streakData.streak > 0 && (
                      <span
                        className="flex items-center gap-0.5"
                        style={{ color: getStreakTierColor(streakData.streak) }}
                      >
                        <span className="text-[8px] leading-none">🔥</span>
                        <span className="font-bold">{streakData.streak}</span>
                      </span>
                    )}
                  </Link>
                </>
              )}
              <button
                onClick={handleSignOut}
                className="btn-press border-[2px] border-border px-3 py-1.5 text-[10px] text-muted transition-colors hover:text-cream active:bg-white/5"
              >
                Sign Out
              </button>
            </>
          )}
        </nav>
      )}

      {/* ─── Purchase Toast ─── */}
      {purchasedItem && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2">
          <div
            className="border-[3px] px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              borderColor: theme.shadow,
            }}
          >
            Item purchased! Effect applied to your building.
          </div>
        </div>
      )}

      {/* ─── Gift Toast ─── */}
      {giftedInfo && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-2 border-[3px] px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              borderColor: theme.shadow,
            }}
          >
            <span className="text-base">🎁</span>
            <span>
              {ITEM_NAMES[giftedInfo.item] ?? giftedInfo.item} sent to {giftedInfo.to}!
            </span>
          </div>
        </div>
      )}

      {/* ─── Sign-In Prompt ─── */}
      {signInPromptVisible && !session && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-xs animate-[slide-up_0.2s_ease-out]">
          <div className="border-[3px] border-border bg-bg-raised/95 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] text-cream normal-case mb-2.5 leading-relaxed">
              Sign in to give Kudos, battle buildings, and claim yours
            </p>
            <button
              onClick={async () => {
                try {
                  const { trackSignInPromptClicked } = await import("@/lib/himetrica");
                  trackSignInPromptClicked();
                } catch {}
                setSignInPromptVisible(false);
                handleSignIn();
              }}
              className="btn-press w-full py-2 text-[10px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `2px 2px 0 0 ${theme.shadow}`,
              }}
            >
              Link GitHub account to claim your building
            </button>
            <button
              onClick={() => setSignInPromptVisible(false)}
              className="mt-1.5 w-full py-1 text-[8px] text-dim transition-colors hover:text-muted"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* ─── Ad Redirect Toast ─── */}
      {adToast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 animate-[fade-in_0.15s_ease-out]">
          <div
            className="border-[3px] px-5 py-2.5 text-[10px] text-bg"
            style={{
              backgroundColor: theme.accent,
              borderColor: theme.shadow,
            }}
          >
            Opening {adToast} &rarr;
          </div>
        </div>
      )}

      {/* ─── Ghost Preview CTA ─── */}
      {ghostPreviewLogin && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-xs animate-[slide-up_0.2s_ease-out]">
          <div
            className="border-[3px] bg-bg-raised/95 px-4 py-3 backdrop-blur-sm"
            style={{ borderColor: theme.accent }}
          >
            <p className="text-[10px] text-cream normal-case mb-2 leading-relaxed">
              Unlock effects for your building
            </p>
            <p className="text-[8px] text-muted normal-case mb-2.5">
              Neon Outline, Particle Aura, Spotlight, and more
            </p>
            <Link
              href={myBuilding?.claimed ? `/shop/${ghostPreviewLogin}` : `/dev/${ghostPreviewLogin}`}
              onClick={() => setGhostPreviewLogin(null)}
              className="btn-press block w-full py-2 text-center text-[10px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `2px 2px 0 0 ${theme.shadow}`,
              }}
            >
              {myBuilding?.claimed ? "Customize" : "Claim & Customize"} &rarr;
            </Link>
            <button
              onClick={() => setGhostPreviewLogin(null)}
              className="mt-1.5 w-full py-1 text-[8px] text-dim transition-colors hover:text-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Streak Reward Toast ─── */}
      {streakData?.streak_reward && streakData.checked_in && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-xs animate-[slide-up_0.2s_ease-out]">
          <div
            className="border-[3px] bg-bg-raised/95 px-4 py-3 backdrop-blur-sm text-center"
            style={{ borderColor: theme.accent }}
          >
            <p className="text-lg mb-1">🎁</p>
            <p className="text-[10px] text-cream normal-case mb-1 font-bold">
              {streakData.streak_reward.milestone}-day streak reward!
            </p>
            <p className="text-[9px] normal-case mb-2" style={{ color: theme.accent }}>
              You unlocked {streakData.streak_reward.item_name}
            </p>
            <Link
              href="/shop"
              className="btn-press block w-full py-1.5 text-center text-[9px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `2px 2px 0 0 ${theme.shadow}`,
              }}
            >
              Equip now &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* ─── Mini-map and Analytics Dashboard ─── */}
      <MiniMap
        buildings={buildings}
        playerX={playerPos.x}
        playerZ={playerPos.z}
        visible={flyMode}
        currentDistrict={lastDistrictRef.current}
      />
      <CityAnalyticsDashboard
        buildings={buildings}
        liveUsers={liveUsers}
        liveByLogin={liveByLogin}
        districtZones={districtZones}
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />

      {/* ─── Activity Ticker ─── */}
      {!flyMode && !introMode && !rabbitCinematic && feedEvents.length >= 1 && (
        <ActivityTicker
          events={feedEvents}
          hasBottomBar={!exploreMode && buildings.length > 0}
          renewalProgress={
            stats?.renewal_raised_inr !== undefined && stats?.renewal_target_inr !== undefined
              ? { raised: stats.renewal_raised_inr, target: stats.renewal_target_inr }
              : null
          }
          onEventClick={(evt) => {
            const login = evt.actor?.login;
            if (login) {
              setFocusedBuilding(login);
              const found = buildings.find((b) => b.login.toLowerCase() === login.toLowerCase());
              if (found) {
                setSelectedBuilding(found);
                if (!exploreMode) setExploreMode(true);
              }
            }
          }}
          onOpenPanel={() => setFeedPanelOpen(true)}
        />
      )}

      {/* ─── Activity Ticker sidebar panel ─── */}
      <ActivityPanel
        initialEvents={feedEvents}
        open={feedPanelOpen}
        onClose={() => setFeedPanelOpen(false)}
        onNavigate={(login) => {
          setFeedPanelOpen(false);
          setFocusedBuilding(login);
          const found = buildings.find((b) => b.login.toLowerCase() === login.toLowerCase());
          if (found) {
            setSelectedBuilding(found);
            if (!exploreMode) setExploreMode(true);
          }
        }}
      />

      {/* ─── Dailies Missions Tracker Widget ─── */}
      {session && myBuilding?.claimed && !flyMode && !introMode && !exploreMode && !rabbitCinematic && (
        <DailiesWidget
          data={dailiesData}
          accent={theme.accent}
          shadow={theme.shadow}
          isMobile={isMobile}
          onClaim={claimDailies}
          onRefresh={refreshDailies}
          onStartFly={() => {
            setFlyScore({ score: 0, earned: 0, combo: 0, collected: 0, maxCombo: 1 });
            flyStartTime.current = Date.now();
            flyPausedAt.current = 0;
            setFlyElapsedSec(0);
            setQuotaReached(false);
            setQuotaNotified(false);
            setQuotaDismissed(false);
            setFlyMode(true);
          }}
        />
      )}

      {/* ─── Quest alerts and XP toast notifications ─── */}
      {dailyToasts.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 flex-col items-center gap-1.5">
          {dailyToasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-none border-[2px] border-border bg-bg-raised/95 px-4 py-2 text-[11px] backdrop-blur-sm"
              style={{
                animation: "toastDrop 0.3s ease-out, toastOut 0.4s ease-in 2s forwards",
                borderColor: t.done ? theme.accent : undefined,
              }}
            >
              {t.reward ? (
                <>
                  <div className="font-semibold" style={{ color: theme.accent }}>
                    🎉 Daily Rewards Claimed!
                  </div>
                  <div className="mt-1 text-[10px] text-cream">+{t.reward.xp} XP</div>
                  <div className="text-[10px] text-cream">+{t.reward.points} Shop Points</div>
                  {t.reward.freeze && <div className="text-[10px] text-cream">🧊 Streak Freeze Earned!</div>}
                </>
              ) : (
                <>
                  <span style={{ color: theme.accent }}>{t.done ? "✓" : "☆"}</span> {t.title}
                  {t.done ? " — Complete!" : ""}
                </>
              )}
            </div>
          ))}
          <style jsx>{`
            @keyframes toastDrop {
              from {
                opacity: 0;
                transform: translateY(-16px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes toastOut {
              from {
                opacity: 1;
              }
              to {
                opacity: 0;
                transform: translateY(-8px);
              }
            }
          `}</style>
        </div>
      )}

      {/* ─── Level Up Toast notification ─── */}
      {levelUpLevel !== null && <LevelUpToast level={levelUpLevel} onDone={() => setLevelUpLevel(null)} />}

      {/* ─── Battle Alert Banner ─── */}
      {raidToast && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[61] -translate-x-1/2" role="status">
          <div
            className="flex items-center gap-2 border-[2px] border-border bg-bg-raised/95 px-4 py-2 text-[11px] backdrop-blur-sm"
            style={{ borderColor: theme.accent }}
          >
            <span style={{ color: theme.accent }}>✓</span>
            <span className="text-cream">{raidToast}</span>
          </div>
        </div>
      )}
    </>
  );
}

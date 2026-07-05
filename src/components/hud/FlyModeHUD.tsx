/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/immutability */
"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useCity } from "@/context/CityContext";

export default function FlyModeHUD() {
  const {
    flyMode,
    flyPaused,
    setFlyPaused,
    flyScore,
    flyPersonalBest,
    flyElapsedSec,
    hud,
    quotaReached,
    setQuotaDismissed,
    showFlyResults,
    setShowFlyResults,
    theme,
    themeIndex,
    endFly,
    setFlyMode,
    setFlyScore,
    flyStartTime,
    flyPausedAt,
    flyTotalPauseMs,
    setFlyElapsedSec,
    setQuotaReached,
    setQuotaNotified,
    setFlyPersonalBest,
    flyResultsTimerRef,
    session,
    showFlyControls,
    setShowFlyControls,
    flyVehicle,
    setFlyVehicle,
    endRabbitCinematic,
    districtAnnouncement,
  } = useCity();

  // ─── Case 1: Post-Flight Results Modal ───
  if (!flyMode && showFlyResults) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          onClick={() => {
            setShowFlyResults(null);
            if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
          }}
        />
        {/* Modal */}
        <div
          className="relative mx-3 border-[3px] border-border bg-bg-raised p-5 text-center sm:mx-0 sm:p-7 animate-[gift-bounce_0.5s_ease-out]"
          style={{ borderColor: theme.accent + "60", minWidth: 280 }}
        >
          {/* Close */}
          <button
            onClick={() => {
              setShowFlyResults(null);
              if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
            }}
            className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream"
          >
            ESC
          </button>

          <p className="text-[9px] tracking-widest text-muted mb-1">
            FLIGHT COMPLETE
          </p>

          {/* Score */}
          <div
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: theme.accent }}
          >
            {showFlyResults.score}
          </div>
          <p className="text-[9px] text-muted mt-0.5">points</p>

          {/* New PB badge */}
          {showFlyResults.isNewPB && (
            <div
              className="mt-2 inline-block rounded-sm px-2.5 py-0.5 text-[9px] font-bold text-bg animate-pulse"
              style={{ backgroundColor: theme.accent }}
            >
              NEW PERSONAL BEST!
            </div>
          )}

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-sm font-bold text-cream">
                {showFlyResults.collected}
              </div>
              <div className="text-[8px] text-muted">Collected</div>
            </div>
            <div>
              <div className="text-sm font-bold text-cream">
                {showFlyResults.maxCombo}x
              </div>
              <div className="text-[8px] text-muted">Max Combo</div>
            </div>
            <div>
              <div className="text-sm font-bold text-cream">
                +{showFlyResults.timeBonus}
              </div>
              <div className="text-[8px] text-muted">Time Bonus</div>
            </div>
          </div>

          {/* Rank */}
          {showFlyResults.rank > 0 && (
            <div className="mt-3 border-t border-border/40 pt-3">
              <span className="text-[9px] text-muted">Rank </span>
              <span
                className="text-sm font-bold"
                style={{ color: theme.accent }}
              >
                #{showFlyResults.rank}
              </span>
              {showFlyResults.totalPilots > 0 && (
                <span className="text-[9px] text-muted">
                  {" "}
                  of {showFlyResults.totalPilots}
                </span>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <button
              onClick={() => {
                setShowFlyResults(null);
                if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
                setFlyMode(true);
                setFlyScore({
                  score: 0,
                  earned: 0,
                  combo: 0,
                  collected: 0,
                  maxCombo: 1,
                });
                flyStartTime.current = Date.now();
                flyPausedAt.current = 0;
                setFlyElapsedSec(0);
                setQuotaReached(false);
                setQuotaNotified(false);
                setQuotaDismissed(false);
                try {
                  setFlyPersonalBest(
                    parseInt(
                      localStorage.getItem("leetcodecity_fly_pb") || "0",
                      10
                    ) || 0
                  );
                } catch {
                  setFlyPersonalBest(0);
                }
              }}
              className="btn-press px-5 py-2.5 text-[10px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `3px 3px 0 0 ${theme.shadow}`,
              }}
            >
              Fly Again
            </button>
            <Link
              href="/leaderboard?mode=game"
              onClick={() => {
                setShowFlyResults(null);
                if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
              }}
              className="btn-press border-[2px] border-border px-5 py-2 text-[10px] transition-colors hover:border-border-light"
              style={{ color: theme.accent }}
            >
              See Leaderboard
            </Link>
            <button
              onClick={() => {
                setShowFlyResults(null);
                if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
              }}
              className="text-[9px] text-muted transition-colors hover:text-cream"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active fly mode overlay
  if (!flyMode) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* Top bar (pause indicator + score + vehicle selector + exit) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="inline-flex items-center gap-3 border-[3px] border-border bg-bg/70 px-5 py-2.5 backdrop-blur-sm">
          <span
            className={`h-2 w-2 flex-shrink-0 ${flyPaused ? "" : "blink-dot"}`}
            style={{
              backgroundColor: flyPaused ? "#f85149" : theme.accent,
            }}
          />
          <span className="text-[10px] text-cream">
            {flyPaused ? "Paused" : "Fly"}
          </span>
          <span className="mx-1 text-border">|</span>
          <span className="text-[10px]" style={{ color: theme.accent }}>
            {flyScore.score}
          </span>
          <span className="text-[10px] text-muted">PX</span>
          {flyScore.combo >= 2 && (
            <span
              className="animate-pulse text-[10px] font-bold"
              style={{ color: "#ffd700" }}
            >
              &times;
              {flyScore.combo >= 4 ? 3 : flyScore.combo >= 3 ? 2 : 1.5}
            </span>
          )}

          <span className="mx-1 text-border">|</span>
          {/* Vehicle selector */}
          {(
            [
              { id: "airplane", label: "✈", title: "Airplane" },
              {
                id: "futuristic_jet",
                label: "🚀",
                title: "Futuristic Jet",
              },
            ] as { id: string; label: string; title: string }[]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setFlyVehicle(v.id)}
              title={v.title}
              className="pointer-events-auto btn-press border px-1.5 py-0.5 text-[11px] transition-colors"
              style={{
                borderColor:
                  flyVehicle === v.id
                    ? theme.accent
                    : "rgba(255,255,255,0.15)",
                backgroundColor:
                  flyVehicle === v.id ? theme.accent + "22" : "transparent",
                color: flyVehicle === v.id ? theme.accent : "#888",
              }}
            >
              {v.label}
            </button>
          ))}
          <button
            onClick={() => endFly(false)}
            className="pointer-events-auto btn-press ml-2 border border-border-light bg-bg-raised/80 px-2 py-1 text-[9px] font-bold text-cream transition-colors hover:bg-border"
          >
            EXIT
          </button>
        </div>
      </div>

      {/* Quota notification popover */}
      {quotaReached && (
        <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 animate-bounce-short">
          <div className="flex flex-col items-center gap-2 border-[3px] border-[#4ade80] bg-bg/90 p-4 text-center backdrop-blur-md shadow-lg">
            <div className="text-[12px] font-bold text-[#4ade80]">
              MISSION QUOTA MATCHED!
            </div>
            <div className="text-[10px] text-cream/80">
              You&apos;ve reached 50 PX. Exit now to complete quest?
            </div>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => endFly(false)}
                className="pointer-events-auto btn-press bg-[#4ade80] px-3 py-1.5 text-[10px] font-bold text-bg transition-all hover:brightness-110"
              >
                EXIT NOW
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuotaReached(false);
                  setQuotaDismissed(true);
                }}
                className="pointer-events-auto btn-press border border-cream/30 bg-bg/50 px-3 py-1.5 text-[10px] text-cream transition-colors hover:bg-bg-raised"
              >
                KEEP FLYING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score HUD (top right) */}
      <div className="absolute top-4 right-3 text-right text-[9px] text-muted sm:right-4 sm:text-[10px]">
        <div>{flyScore.collected}/40 collected</div>
        <div className="mt-1 flex h-[4px] w-24 items-center border border-border/40 bg-bg/50 ml-auto">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${(flyScore.collected / 40) * 100}%`,
              backgroundColor: theme.accent,
            }}
          />
        </div>
        <div className="mt-1.5 text-[8px]">
          <span className="text-muted">TIME </span>
          <span
            style={{
              color: flyElapsedSec < 900 ? theme.accent : "#f85149",
            }}
          >
            {Math.floor(flyElapsedSec / 60)}:
            {String(flyElapsedSec % 60).padStart(2, "0")} / 15:00
          </span>
        </div>
        {flyPersonalBest > 0 && (
          <div className="mt-0.5 text-[8px] text-muted">
            BEST:{" "}
            <span style={{ color: theme.accent }}>{flyPersonalBest}</span>
          </div>
        )}
      </div>

      {/* Flight stats (bottom left) */}
      <div className="absolute bottom-14 left-3 text-[9px] leading-loose text-muted sm:left-4 sm:text-[10px]">
        <div className="flex items-center gap-2">
          <span>SPD</span>
          <span style={{ color: theme.accent }} className="w-6 text-right">
            {Math.round(hud.speed)}
          </span>
          <div className="flex h-[6px] w-20 items-center border border-border/60 bg-bg/50">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${Math.round(((hud.speed - 20) / 140) * 100)}%`,
                backgroundColor: theme.accent,
              }}
            />
          </div>
        </div>
        <div>
          ALT{" "}
          <span style={{ color: theme.accent }}>
            {Math.round(hud.altitude)}
          </span>
        </div>
      </div>

      {/* District announcement */}
      {districtAnnouncement && (
        <div
          key={districtAnnouncement.name}
          className="absolute bottom-32 left-3 animate-district-in sm:left-4"
        >
          <div
            className="border-l-4 bg-bg/80 px-4 py-2 backdrop-blur-sm"
            style={{ borderColor: districtAnnouncement.color }}
          >
            <div className="text-[8px] uppercase tracking-widest text-muted">
              District
            </div>
            <div className="font-pixel text-sm text-cream">
              {districtAnnouncement.name}
            </div>
            <div className="text-[8px] text-muted">
              {districtAnnouncement.population.toLocaleString()} devs
            </div>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-[140px] right-3 text-right text-[8px] leading-loose text-muted sm:right-4 sm:text-[9px]">
        {flyPaused ? (
          <>
            <div>
              <span className="text-cream">Drag</span> orbit
            </div>
            <div>
              <span className="text-cream">Scroll</span> zoom
            </div>
            <div>
              <span className="text-cream">WASD</span> resume
            </div>
            <div>
              <span style={{ color: theme.accent }}>ESC</span> exit
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-cream">Mouse</span> steer
            </div>
            <div>
              <span className="text-cream">Shift</span> boost
            </div>
            <div>
              <span className="text-cream">Alt</span> slow
            </div>
            <div>
              <span className="text-cream">Scroll</span> base speed
            </div>
            <div>
              <span style={{ color: theme.accent }}>P</span> pause
            </div>
            <div>
              <span style={{ color: theme.accent }}>ESC</span> pause
            </div>
          </>
        )}
      </div>

      {/* ─── Flight school controls overlay ─── */}
      {showFlyControls && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-bg/50 backdrop-blur-[2px]">
          <div
            className="border-[3px] border-border bg-bg-raised px-8 py-6 text-center animate-[fade-in_0.3s_ease-out]"
            style={{ borderColor: theme.accent + "60" }}
          >
            <p className="mb-4 text-xs tracking-widest text-muted">
              FLIGHT CONTROLS
            </p>
            <div className="flex flex-col gap-2.5 text-[11px]">
              <div className="flex items-center justify-between gap-6">
                <span className="text-cream">Mouse</span>
                <span className="text-muted">Steer</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-cream">Scroll</span>
                <span className="text-muted">Speed</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-cream">Shift / Alt</span>
                <span className="text-muted">Boost / Slow</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span style={{ color: theme.accent }}>ESC</span>
                <span className="text-muted">Pause &amp; Exit</span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowFlyControls(false);
                try {
                  localStorage.setItem("leetcodecity_fly_controls_seen", "1");
                } catch (err) {
                  console.warn("[flyControls] Failed to persist controls seen flag:", err);
                }
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    code: "Space",
                    bubbles: true,
                  })
                );
              }}
              className="btn-press mt-5 px-6 py-2 text-[10px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `3px 3px 0 0 ${theme.shadow}`,
              }}
            >
              Got it, let&apos;s fly!
            </button>
          </div>
        </div>
      )}

      {/* Flight Pause menu */}
      {flyPaused && (
        <div className="pointer-events-auto fixed inset-0 z-45 flex items-center justify-center bg-bg/75 backdrop-blur-sm">
          <div className="border-[3px] border-border bg-bg-raised p-6 text-center w-64">
            <h2 className="text-base text-cream mb-4 font-bold tracking-widest">
              FLIGHT PAUSED
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const pausedMs = Date.now() - flyPausedAt.current;
                  flyTotalPauseMs.current += pausedMs;
                  flyPausedAt.current = 0;
                  setFlyPaused(false);
                }}
                className="btn-press w-full py-2.5 text-[10px] text-bg"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `3px 3px 0 0 ${theme.shadow}`,
                }}
              >
                Resume Flight
              </button>
              <button
                onClick={() => endFly(true)}
                className="btn-press w-full border-[2px] border-border py-2 text-[10px] text-cream transition-colors hover:border-border-light"
              >
                Restart Flight
              </button>
              <button
                onClick={() => endFly()}
                className="btn-press w-full border-[2px] border-red-500/50 py-2 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
              >
                Exit to City
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

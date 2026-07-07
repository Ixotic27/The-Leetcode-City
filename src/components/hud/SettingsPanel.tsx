/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import ActionToolbar from "@/components/ActionToolbar";
import { useCity, THEMES } from "@/context/CityContext";

export default function SettingsPanel() {
  const {
    flyMode,
    introMode,
    rabbitCinematic,
    exploreMode,
    theme,
    themeIndex,
    cycleTheme,
    dayNightCycleActive,
    setDayNightCycleActive,
    weatherMode,
    cycleWeather,
    replayIntro,
    isMobile,
  } = useCity();

  if (flyMode || introMode || rabbitCinematic) return null;

  // ─── Case 1: Explore mode (small bottom-left controls overlay) ───
  if (exploreMode) {
    return (
      <div className="pointer-events-auto fixed bottom-10 left-3 z-[31] flex items-center gap-2 sm:left-4">
        <button
          onClick={cycleTheme}
          className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
        >
          <span style={{ color: theme.accent }}>&#9654;</span>
          <span className="text-cream">{theme.name}</span>
          <span className="text-dim">
            {themeIndex + 1}/{THEMES.length}
          </span>
        </button>
        <button
          onClick={() => {
            setDayNightCycleActive((prev: boolean) => {
              const next = !prev;
              try {
                localStorage.setItem("leetcodecity_daynight_cycle", next ? "1" : "0");
              } catch (err) {
                console.warn("[dayNightToggle] Failed to persist cycle preference:", err);
              }
              return next;
            });
          }}
          className={`btn-press flex items-center gap-1.5 border-[3px] px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors ${
            dayNightCycleActive
              ? "border-amber-500/80 bg-amber-500/10 text-amber-400 hover:border-amber-400"
              : "border-border bg-bg/70 text-cream hover:border-border-light"
          }`}
        >
          <span style={{ color: theme.accent }}>&#9654;</span>
          <span>{dayNightCycleActive ? "CYCLE ON" : "CYCLE OFF"}</span>
        </button>
        <div id="gc-radio-slot" />
      </div>
    );
  }

  // ─── Case 2: Landing mode (ActionToolbar controls panel) ───
  return (
    <div className="pointer-events-auto fixed bottom-[82px] left-3 z-[25] flex items-center gap-2 sm:bottom-10 sm:left-4">
      <ActionToolbar
        cycleTheme={cycleTheme}
        replayIntro={replayIntro}
        theme={theme}
        themeIndex={themeIndex}
        themesLength={THEMES.length}
        isMounted={true}
        dayNightCycleActive={dayNightCycleActive}
        setDayNightCycleActive={setDayNightCycleActive}
        weatherMode={weatherMode}
        cycleWeather={cycleWeather}
      />
    </div>
  );
}

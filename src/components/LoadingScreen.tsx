"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────

export type LoadingStage =
  | "init"
  | "fetching"
  | "generating"
  | "rendering"
  | "ready"
  | "done"
  | "error";

interface LoadingScreenProps {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  accentColor: string;
  stats?: { total_developers: number; total_contributions: number };
  onRetry: () => void;
  onFadeComplete: () => void;
}

// ─── ASCII City Skyline ────────────────────────────────────────

const SKYLINE = [
  "         ╔═╗                   ╔══╗         ",
  "    ╔╗   ║ ║  ╔══╗   ╔╗  ╔╗   ║  ║   ╔╗    ",
  "   ╔╣║ ╔═╣ ║  ║  ║ ╔═╣╠╗ ║║ ╔═╣  ╠╗ ╔╣║    ",
  "  ╔╣║║ ║ ║ ║╔╗║  ║╔╣ ║║║ ║║ ║ ║  ║║ ║║╠╗   ",
  " ╔╣║║╠╗║ ║ ║║║║  ║║║ ║║╠╗║╠╗║ ║  ║╠╗║║║║   ",
  " ║║║║║║║ ║ ║║║║  ║║║ ║║║║║║║║ ║  ║║║║║║║   ",
  " ║║║║║║║ ║ ║║║║  ║║║ ║║║║║║║║ ║  ║║║║║║║   ",
  "═╩╩╩╩╩╩╩═╩═╩╩╩╩══╩╩╩═╩╩╩╩╩╩╩═╩══╩╩╩╩╩╩╩═  ",
];

// ─── Stage Labels ──────────────────────────────────────────────

const STAGE_LABELS: Record<LoadingStage, string> = {
  init: "INITIALIZING...",
  fetching: "FETCHING CITY DATA...",
  generating: "LAYING DOWN STREETS...",
  rendering: "PLACING BUILDINGS...",
  ready: "WELCOME TO THE CITY",
  done: "",
  error: "SOMETHING WENT WRONG",
};

// ─── Tips ──────────────────────────────────────────────────────

const TIPS = [
  "TIP: CLICK ANY BUILDING TO SEE THAT CODER'S PROFILE",
  "TIP: USE THE SEARCH BAR TO FIND ANY DEVELOPER",
  "TIP: SCROLL TO ZOOM IN AND OUT OF THE CITY",
  "TIP: DRAG TO ROTATE THE CAMERA AROUND THE CITY",
  "TIP: PRESS ESC TO RETURN TO THE HOME VIEW",
  "TIP: EXPLORE DIFFERENT DISTRICTS FOR MORE CODERS",
  "TIP: TALLER BUILDINGS MEAN MORE PROBLEMS SOLVED",
  "TIP: BUILDING COLORS REFLECT PROBLEM DIFFICULTY",
];

// ─── Progress Bar ──────────────────────────────────────────────

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const barWidth = 40;
  const filled = Math.floor(progress * barWidth);
  const dither = progress * barWidth - filled;

  let bar = "";
  for (let i = 0; i < barWidth; i++) {
    if (i < filled) bar += "█";
    else if (i === filled && dither > 0.3) bar += "▓";
    else if (i === filled && dither > 0) bar += "░";
    else bar += "░";
  }

  return (
    <div className="font-pixel text-center">
      <div style={{ color, letterSpacing: "1px" }}>
        <span style={{ color: color + "60" }}>[</span>
        <span>{bar.slice(0, filled)}</span>
        <span style={{ opacity: 0.35 }}>{bar.slice(filled)}</span>
        <span style={{ color: color + "60" }}>]</span>
      </div>
      <div
        className="mt-1 text-[10px] tracking-widest"
        style={{ color: color + "90" }}
      >
        {Math.floor(progress * 100)}%
      </div>
    </div>
  );
}

// ─── Loading Screen ────────────────────────────────────────────

export default function LoadingScreen({
  stage,
  progress,
  error,
  accentColor,
  onRetry,
  onFadeComplete,
}: LoadingScreenProps) {
  const [fading, setFading] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const fadeCalledRef = useRef(false);

  // When stage reaches "ready", start the fade-out
  useEffect(() => {
    if (stage === "ready" && !fading) {
      // Small delay so the "WELCOME" message is visible
      const t = setTimeout(() => setFading(true), 600);
      return () => clearTimeout(t);
    }
  }, [stage, fading]);

  // Handle fade completion — call onFadeComplete exactly once
  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (
        fading &&
        !fadeCalledRef.current &&
        e.target === e.currentTarget &&
        e.propertyName === "opacity"
      ) {
        fadeCalledRef.current = true;
        onFadeComplete();
      }
    },
    [fading, onFadeComplete],
  );

  // Safety fallback: if CSS transitionEnd doesn't fire
  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => {
      if (!fadeCalledRef.current) {
        fadeCalledRef.current = true;
        onFadeComplete();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [fading, onFadeComplete]);

  const label = STAGE_LABELS[stage] || STAGE_LABELS.init;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0c] transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={
        handleTransitionEnd as unknown as React.TransitionEventHandler<HTMLDivElement>
      }
    >
      <div className="flex flex-col items-center gap-6 px-4">
        {/* ASCII Skyline */}
        <pre
          className="select-none text-center font-pixel text-[8px] leading-[1.3] sm:text-[10px]"
          style={{ color: accentColor + "70" }}
        >
          {SKYLINE.join("\n")}
        </pre>

        {/* LOADING label */}
        <div
          className="font-pixel text-[10px] tracking-[0.5em]"
          style={{ color: accentColor + "90" }}
        >
          LOADING
        </div>

        {/* LEETCODE CITY title */}
        <h1
          className="font-pixel text-2xl tracking-[0.35em] sm:text-3xl md:text-4xl"
          style={{ color: accentColor }}
        >
          LEETCODE{" "}
          <span style={{ color: "#ffffff" }}>CITY</span>
        </h1>

        {/* Stage label */}
        <div
          className="font-pixel text-[11px] tracking-[0.3em]"
          style={{ color: accentColor + "b0" }}
        >
          {error ? STAGE_LABELS.error : label}
        </div>

        {/* Progress bar */}
        {!error && (
          <ProgressBar progress={Math.min(progress, 1)} color={accentColor} />
        )}

        {/* Error retry */}
        {error && (
          <div className="flex flex-col items-center gap-3">
            <p className="font-pixel text-[10px] text-red-400">{error}</p>
            <button
              onClick={onRetry}
              className="font-pixel text-[11px] tracking-wider text-neutral-400 underline hover:text-neutral-200"
            >
              RETRY
            </button>
          </div>
        )}

        {/* Tip */}
        <div
          className="mt-4 font-pixel text-[9px] tracking-[0.25em]"
          style={{ color: accentColor + "50" }}
        >
          {tip}
        </div>
      </div>
    </div>
  );
}

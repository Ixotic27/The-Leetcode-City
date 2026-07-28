"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────

export type LoadingStage =
  "init" | "fetching" | "generating" | "rendering" | "ready" | "done" | "error";

interface LoadingScreenProps {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  accentColor: string;
  onRetry: () => void;
  onFadeComplete: () => void;
}

// ─── Constants ─────────────────────────────────────────────────

const STAGE_MESSAGES: Record<string, string> = {
  init: "INITIALIZING RENDERER...",
  fetching: "FETCHING PROFILES...",
  generating: "LAYING DOWN STREETS...",
  rendering: "BUILDING THE SKYLINE...",
  ready: "WELCOME TO THE CITY",
};

const TIPS = [
  "Click any building to see that coder's profile",
  "Use Fly Mode to cruise above the skyline",
  "Taller buildings = more submissions",
  "Try searching for your LeetCode username",
  "Buildings glow brighter with more recent activity",
  "You can customize your building in the shop",
  "Explore Mode shows the full city layout",
];

// ASCII art city skyline
const ASCII_SKYLINE = [
  "    ║         ╔═╗   ╔══╗      ║     ╔═╗        ",
  "   ╔╣    ╔╗   ║ ║  ╔╣  ║   ╔══╣    ╔╣ ╠╗   ╔╗  ",
  "  ╔╣║   ╔╣║  ╔╣ ║  ║║  ║  ╔╣  ║   ╔╣║ ║║  ╔╣║  ",
  " ╔╣║║  ╔╣║║  ║║ ║ ╔╣║  ║ ╔╣║  ║  ╔╣║║ ║║ ╔╣║║  ",
  " ║║║║  ║║║║  ║║ ║ ║║║  ║ ║║║  ║  ║║║║ ║║ ║║║║  ",
  "═╩╩╩╩══╩╩╩╩══╩╩═╩═╩╩╩══╩═╩╩╩══╩══╩╩╩╩═╩╩═╩╩╩╩══",
];

// ─── Component ─────────────────────────────────────────────────

export default function LoadingScreen({
  stage,
  progress,
  error,
  accentColor,
  onRetry,
  onFadeComplete,
}: LoadingScreenProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [dots, setDots] = useState("");

  // Rotate tips every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Trigger fade-out when stage becomes "ready"
  useEffect(() => {
    if (stage === "ready") {
      setFading(true);
    }
  }, [stage]);

  const handleTransitionEnd = useCallback(() => {
    if (fading) {
      onFadeComplete();
    }
  }, [fading, onFadeComplete]);

  const isError = stage === "error";
  const message = isError ? error : (STAGE_MESSAGES[stage] ?? "");

  // Build pixel progress bar with block characters
  const barWidth = 30;
  const filledBlocks = Math.floor((Math.min(100, progress) / 100) * barWidth);
  const emptyBlocks = barWidth - filledBlocks;
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070709] transition-opacity duration-[600ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* CRT scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.15) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* ASCII Skyline */}
      <div className="mb-8 overflow-hidden opacity-25">
        <pre
          className="text-[8px] leading-[10px] tracking-widest sm:text-[10px] sm:leading-[12px]"
          style={{ color: accentColor, fontFamily: "monospace" }}
        >
          {ASCII_SKYLINE.join("\n")}
        </pre>
      </div>

      {/* Title */}
      <div className="text-center">
        <p
          className="text-[9px] tracking-[0.35em] uppercase mb-3 opacity-50"
          style={{ color: accentColor, fontFamily: "monospace" }}
        >
          LOADING
        </p>
        <h1
          className="text-2xl tracking-[0.15em] font-bold sm:text-4xl"
          style={{ color: "#e8dcc8", fontFamily: "monospace" }}
        >
          LEETCODE <span style={{ color: accentColor }}>CITY</span>
        </h1>
      </div>

      {/* Stage message */}
      <p
        className="mt-5 text-[10px] tracking-[0.2em] uppercase sm:text-xs"
        style={{ color: accentColor, fontFamily: "monospace", opacity: 0.8 }}
      >
        {message}
        {!isError && dots}
      </p>

      {/* Pixel progress bar */}
      {!isError && (
        <div className="mt-5 flex flex-col items-center gap-1">
          <div
            className="text-xs sm:text-sm"
            style={{
              color: accentColor,
              fontFamily: "monospace",
              letterSpacing: "1px",
            }}
          >
            [{progressBar}]
          </div>
          <p
            className="text-[10px] tracking-widest"
            style={{
              color: accentColor,
              fontFamily: "monospace",
              opacity: 0.6,
            }}
          >
            {Math.min(100, Math.round(progress))}%
          </p>
        </div>
      )}

      {/* Error retry */}
      {isError && (
        <button
          onClick={onRetry}
          className="mt-6 border-2 px-6 py-2 text-xs tracking-widest uppercase transition-colors hover:opacity-80"
          style={{
            borderColor: accentColor,
            color: accentColor,
            fontFamily: "monospace",
            backgroundColor: "transparent",
          }}
        >
          [ RETRY ]
        </button>
      )}

      {/* Tips rotator */}
      {!isError && (
        <p
          className="mt-8 max-w-xs text-center text-[9px] leading-relaxed tracking-wide sm:text-[10px]"
          style={{ color: "#e8dcc8", fontFamily: "monospace", opacity: 0.35 }}
        >
          TIP: {TIPS[tipIndex]}
        </p>
      )}

      {/* Bottom border accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: accentColor, opacity: 0.4 }}
      />
    </div>
  );
}

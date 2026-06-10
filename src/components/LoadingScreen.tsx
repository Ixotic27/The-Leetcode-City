"use client";

import { useState, useEffect, useCallback } from "react";
import TipRotator from "./TipRotator";

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
  onRetry: () => void;
  onFadeComplete: () => void;
}

// ─── Constants ─────────────────────────────────────────────────
const STAGE_MESSAGES: Record<string, string> = {
  init: "Checking your browser...",
  fetching: "Fetching developers...",
  generating: "Laying down streets...",
  rendering: "Building the skyline...",
  ready: "Welcome to the city",
};

// Pixel-art skyline building configs: [width, height, left%]
const SKYLINE_BUILDINGS: [number, number, number][] = [
  [28, 40, 2],
  [20, 65, 8],
  [32, 85, 14],
  [18, 50, 22],
  [24, 70, 28],
  [36, 110, 35],
  [22, 55, 44],
  [26, 75, 50],
  [30, 95, 58],
  [20, 45, 66],
  [34, 80, 72],
  [24, 60, 80],
  [28, 90, 87],
];

export default function LoadingScreen({
  stage,
  progress,
  error,
  accentColor,
  onRetry,
  onFadeComplete,
}: LoadingScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (stage === "ready") {
      requestAnimationFrame(() => setFading(true));
    }
  }, [stage]);

  const handleTransitionEnd = useCallback(() => {
    if (fading) {
      onFadeComplete();
    }
  }, [fading, onFadeComplete]);

  const isError = stage === "error";
  const message = isError ? error : (STAGE_MESSAGES[stage] ?? "");

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0d0d0f] transition-opacity duration-[600ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Skyline silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-[140px] overflow-hidden opacity-20">
        {SKYLINE_BUILDINGS.map(([w, h, left], i) => (
          <div
            key={i}
            className="absolute bottom-0"
            style={{
              width: w,
              height: h,
              left: `${left}%`,
              backgroundColor: accentColor,
              clipPath:
                i % 3 === 0
                  ? "polygon(0 8px, 30% 8px, 30% 0, 70% 0, 70% 8px, 100% 8px, 100% 100%, 0 100%)"
                  : i % 3 === 1
                    ? "polygon(0 4px, 50% 4px, 50% 0, 100% 0, 100% 100%, 0 100%)"
                    : undefined,
            }}
          />
        ))}
      </div>

      <h1
        className="font-pixel text-3xl tracking-[0.2em] sm:text-4xl"
        style={{ color: accentColor }}
      >
        LEETCODE CITY
      </h1>

      <p className="mt-4 font-pixel text-xs tracking-wider text-neutral-400 sm:text-sm">
        {message}
      </p>

      {!isError && (
        <div
          className="mt-6 h-4 w-56 sm:w-72"
          style={{ border: `3px solid ${accentColor}` }}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${Math.min(100, progress)}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>
      )}

      {isError && (
        <button
          onClick={onRetry}
          className="btn-press mt-6 px-6 py-2 font-pixel text-xs text-[#0d0d0f]"
          style={{ backgroundColor: accentColor }}
        >
          Retry
        </button>
      )}

      {!isError && <TipRotator />}
    </div>
  );
}
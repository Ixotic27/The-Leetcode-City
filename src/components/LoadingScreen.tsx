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

// ─── Constants (Placed here, so the component can access them) ──
const STAGE_MESSAGES: Record<string, string> = {
  init: "Checking your browser...",
  fetching: "Fetching developers...",
  generating: "Laying down streets...",
  rendering: "Building the skyline...",
  ready: "Welcome to the city",
};

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
  // Now STAGE_MESSAGES is accessible right here:
  const message = isError ? error : (STAGE_MESSAGES[stage] ?? "");

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0d0d0f] transition-opacity duration-[600ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      <h1 className="font-pixel text-3xl tracking-[0.2em] sm:text-4xl" style={{ color: accentColor }}>
        LEETCODE CITY
      </h1>
      
      <p className="mt-4 font-pixel text-xs tracking-wider text-neutral-400 sm:text-sm">
        {message}
      </p>

      {!isError && (
        <div className="mt-6 h-4 w-56 sm:w-72" style={{ border: `3px solid ${accentColor}` }}>
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${Math.min(100, progress)}%`, backgroundColor: accentColor }}
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
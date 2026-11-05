"use client";

import { useEffect } from "react";

export type LoadingStage = "init" | "fetching" | "generating" | "rendering" | "ready" | "done" | "error";

interface LoadingScreenProps {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  accentColor: string;
  stats?: { total_developers: number; total_contributions: number };
  onRetry: () => void;
  onFadeComplete: () => void;
}

const STAGE_LABELS: Record<LoadingStage, string> = {
  init: "Preparing your visit...",
  fetching: "Loading developer profiles...",
  generating: "Laying out the city...",
  rendering: "Drawing the skyline...",
  ready: "Your city is ready.",
  done: "Your city is ready.",
  error: "The city could not load.",
};

export default function LoadingScreen({ stage, progress, error, accentColor, stats, onRetry, onFadeComplete }: LoadingScreenProps) {
  useEffect(() => {
    if (stage !== "ready") return;
    const timer = setTimeout(onFadeComplete, 250);
    return () => clearTimeout(timer);
  }, [stage, onFadeComplete]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-bg p-6 transition-opacity duration-200 ${stage === "ready" ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="w-full max-w-sm font-pixel text-cream">
        <p className="text-2xl">LeetCode City</p>
        <p role={stage === "error" ? "alert" : "status"} className="mt-4 text-[11px] leading-6 normal-case text-muted">{error ?? STAGE_LABELS[stage]}</p>
        {stage === "error" ? (
          <button onClick={onRetry} className="mt-5 min-h-11 border-2 border-border-light px-4 text-[11px]" style={{ color: accentColor }}>Try again</button>
        ) : (
          <>
            <div role="progressbar" aria-label="Loading city" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, progress)))} className="mt-5 h-2 overflow-hidden bg-border">
              <div className="h-full transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: accentColor }} />
            </div>
            {stats && stats.total_developers > 0 && <p className="mt-4 text-[9px] text-muted normal-case tabular-nums">{stats.total_developers.toLocaleString()} developers in the skyline</p>}
          </>
        )}
      </div>
    </div>
  );
}
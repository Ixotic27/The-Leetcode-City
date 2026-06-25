"use client";
import { useEffect, useState } from "react";

interface DungeonModalProps { onClose: () => void; }
interface DailyProblem { title: string; difficulty: string; titleSlug: string; }

const BOSS_MAP: Record<string, { name: string; emoji: string; color: string }> = {
  Easy:   { name: "Goblin", emoji: "👺", color: "#4ade80" },
  Medium: { name: "Orc",    emoji: "👹", color: "#fb923c" },
  Hard:   { name: "Dragon", emoji: "🐉", color: "#ef4444" },
};

export default function DungeonModal({ onClose }: DungeonModalProps) {
  const [problem, setProblem] = useState<DailyProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("https://alfa-leetcode-api.onrender.com/daily", { signal: controller.signal });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!data?.questionTitle || !data?.difficulty || !data?.titleSlug) throw new Error("bad data");
        setProblem({ title: data.questionTitle, difficulty: data.difficulty, titleSlug: data.titleSlug });
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const boss = problem ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"]) : null;
  const leetcodeUrl = problem ? "https://leetcode.com/problems/" + problem.titleSlug + "/" : "#";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <div
        aria-labelledby="dungeon-modal-title"
        className="relative w-[90%] max-w-[420px] border-[2px] border-red-500/60 bg-bg-raised p-8 text-center font-silkscreen text-cream [image-rendering:pixelated]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="dungeon-modal-title"
          className="text-[13px] uppercase tracking-[0.1em] text-red-400"
        >
          ⚔ DAILY CODING DUNGEON
        </h2>

        <div className="my-3 border-t border-red-500/30" />

        {/* Loading / Error states */}
        {loading && (
          <p className="text-[11px] text-muted">SUMMONING BOSS...</p>
        )}
        {error && (
          <p className="text-[11px] text-red-400">DUNGEON UNAVAILABLE</p>
        )}

        {/* Problem content */}
        {problem && boss && (
          <div>
            <div className="my-4 text-5xl">{boss.emoji}</div>

            <p className="mb-1 text-[10px] tracking-[0.15em] text-muted">
              TODAY&apos;S BOSS
            </p>

            <h3 className="mb-1 text-[13px] tracking-[0.1em]" style={{ color: boss.color }}>
              {boss.name.toUpperCase()} — {problem.difficulty.toUpperCase()}
            </h3>

            <p className="mb-6 text-[11px] tracking-[0.05em] text-cream">
              {problem.title}
            </p>

            <a
              href={leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border-[2px] border-red-300/60 bg-red-500 px-5 py-2.5 text-[11px] font-bold tracking-[0.1em] text-white no-underline transition-opacity hover:opacity-90"
            >
              ⚔ FIGHT BOSS
            </a>
          </div>
        )}

        <div className="mb-2 mt-4 border-t border-red-500/30" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="btn-press border border-border bg-transparent px-4 py-1.5 text-[10px] tracking-[0.1em] text-muted transition-colors hover:border-border-light hover:text-cream"
        >
          [ RETREAT ]
        </button>
      </div>
    </div>
  );
}
"use client";
import { useEffect, useRef, useState } from "react";

interface DungeonModalProps {
  onClose: () => void;
}
interface DailyProblem {
  title: string;
  difficulty: string;
  titleSlug: string;
}

const BOSS_MAP: Record<
  string,
  { name: string; emoji: string; color: string; bg: string }
> = {
  Easy: {
    name: "Goblin",
    emoji: "👺",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.15)",
  },
  Medium: {
    name: "Orc",
    emoji: "👹",
    color: "#fb923c",
    bg: "rgba(251,146,60,0.15)",
  },
  Hard: {
    name: "Dragon",
    emoji: "🐉",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
  },
};

const FETCH_TIMEOUT_MS = 8000;

export default function DungeonModal({ onClose }: DungeonModalProps) {
  const [problem, setProblem] = useState<DailyProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const fightBtnRef = useRef<HTMLAnchorElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const retryBtnRef = useRef<HTMLButtonElement>(null);

  // Fetch daily problem, with timeout + retry support
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          "https://alfa-leetcode-api.onrender.com/daily",
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!data?.questionTitle || !data?.difficulty || !data?.titleSlug)
          throw new Error("bad data");
        setProblem({
          title: data.questionTitle,
          difficulty: data.difficulty,
          titleSlug: data.titleSlug,
        });
      } catch {
        setError(true);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    load();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [retryCount]);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Auto-focus on open: Fight Boss if available, else close button
  useEffect(() => {
    if (!loading) {
      (fightBtnRef.current ?? closeBtnRef.current)?.focus();
    }
  }, [loading, problem]);

  // Escape to close + focus trap (Tab cycles within modal only)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const boss = problem
    ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"])
    : null;
  const leetcodeUrl = problem
    ? "https://leetcode.com/problems/" + problem.titleSlug + "/"
    : "#";

  const handleFightBoss = () => {
    try {
      fetch("/api/relics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dungeon_fight_boss",
          difficulty: problem?.difficulty,
        }),
      }).catch(() => {
        /* best-effort, ignore tracking failures */
      });
    } catch {
      // best-effort only
    }
  };

  const glowColor = boss?.color ?? "#ef4444";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        aria-labelledby="dungeon-modal-title"
        className="relative w-[90%] max-w-[420px] border-[2px] bg-bg-raised p-8 text-center font-silkscreen text-cream [image-rendering:pixelated] transition-[border-color,box-shadow] duration-300"
        style={{
          borderColor: `${glowColor}99`,
          boxShadow: problem ? `0 0 24px ${glowColor}22` : undefined,
        }}
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

        {/* Loading state */}
        {loading && (
          <p className="text-[11px] text-muted animate-pulse">
            SUMMONING BOSS...
          </p>
        )}

        {/* Error state with retry */}
        {error && !loading && (
          <div>
            <p className="mb-4 text-[11px] text-red-400">DUNGEON UNAVAILABLE</p>
            <button
              ref={retryBtnRef}
              onClick={() => setRetryCount((c) => c + 1)}
              className="btn-press border-[2px] border-red-400/60 bg-transparent px-4 py-1.5 text-[10px] tracking-[0.1em] text-red-300 transition-colors hover:border-red-300 hover:text-white"
            >
              [ RETRY ]
            </button>
          </div>
        )}

        {/* Problem content */}
        {problem && boss && !loading && !error && (
          <div>
            <div
              aria-label={`Boss: ${boss.name}, difficulty ${problem.difficulty}`}
              className={`my-4 text-5xl drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] ${
                reducedMotion
                  ? ""
                  : "animate-[dungeon-float_2.4s_ease-in-out_infinite]"
              }`}
            >
              {boss.emoji}
            </div>

            <p className="mb-1 text-[10px] tracking-[0.15em] text-muted">
              TODAY&apos;S BOSS
            </p>

            <h3
              className="mb-2 text-[13px] tracking-[0.1em]"
              style={{ color: boss.color }}
            >
              {boss.name.toUpperCase()}
            </h3>

            {/* Difficulty badge/pill */}
            <span
              className="mb-4 inline-block rounded-none border-[1.5px] px-2.5 py-0.5 text-[9px] font-bold tracking-[0.1em]"
              style={{
                color: boss.color,
                borderColor: boss.color,
                backgroundColor: boss.bg,
              }}
            >
              {problem.difficulty.toUpperCase()}
            </span>

            <p className="mb-6 text-[11px] tracking-[0.05em] text-cream">
              {problem.title}
            </p>

            <a
              ref={fightBtnRef}
              href={leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleFightBoss}
              className="inline-block border-[2px] border-red-300/60 bg-red-500 px-5 py-2.5 text-[11px] font-bold tracking-[0.1em] text-white no-underline transition-opacity hover:opacity-90"
            >
              ⚔ FIGHT BOSS
            </a>
          </div>
        )}

        <div className="mb-2 mt-4 border-t border-red-500/30" />

        {/* Close button */}
        <button
          ref={closeBtnRef}
          onClick={onClose}
          className="btn-press border border-border bg-transparent px-4 py-1.5 text-[10px] tracking-[0.1em] text-muted transition-colors hover:border-border-light hover:text-cream"
        >
          [ RETREAT ]
        </button>
      </div>

      <style jsx global>{`
        @keyframes dungeon-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

interface DungeonModalProps { onClose: () => void; }
interface DailyProblem { title: string; difficulty: string; titleSlug: string; }

const BOSS_MAP: Record<string, { name: string; emoji: string; color: string }> = {
  Easy: { name: "Goblin", emoji: "👺", color: "#4ade80" },
  Medium: { name: "Orc", emoji: "👹", color: "#fb923c" },
  Hard: { name: "Dragon", emoji: "🐉", color: "#ef4444" },
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
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        aria-labelledby="dungeon-modal-title"
        style={{
          backgroundColor: "#0a0a0a",
          border: "2px solid #ef4444",
          outline: "2px solid #7f1d1d",
          padding: "2rem",
          maxWidth: "420px",
          width: "90%",
          textAlign: "center",
          fontFamily: "'Silkscreen', monospace",
          color: "white",
          imageRendering: "pixelated",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dungeon-modal-title" style={{ color: "#ef4444", fontSize: "1rem", marginBottom: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          ⚔ DAILY CODING DUNGEON
        </h2>
        <div style={{ borderTop: "1px solid #7f1d1d", margin: "0.75rem 0" }} />

        {loading && <p style={{ color: "#94a3b8", fontSize: "0.75rem" }}>SUMMONING BOSS...</p>}
        {error && <p style={{ color: "#ef4444", fontSize: "0.75rem" }}>DUNGEON UNAVAILABLE</p>}

        {problem && boss && (
          <div>
            <div style={{ fontSize: "3rem", margin: "1rem 0" }}>{boss.emoji}</div>
            <p style={{ color: "#64748b", fontSize: "0.65rem", marginBottom: "0.25rem", letterSpacing: "0.15em" }}>TODAY&apos;S BOSS</p>
            <h3 style={{ color: boss.color, fontSize: "0.85rem", marginBottom: "0.25rem", letterSpacing: "0.1em" }}>
              {boss.name.toUpperCase()} — {problem.difficulty.toUpperCase()}
            </h3>
            <p style={{ color: "#e2e8f0", marginBottom: "1.5rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
              {problem.title}
            </p>
            <a
              href={leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "0.6rem 1.25rem",
                textDecoration: "none",
                fontWeight: "bold",
                display: "inline-block",
                fontSize: "0.75rem",
                letterSpacing: "0.1em",
                border: "2px solid #fca5a5",
                fontFamily: "'Silkscreen', monospace",
              }}
            >
              ⚔ FIGHT BOSS
            </a>
          </div>
        )}

        <div style={{ borderTop: "1px solid #7f1d1d", margin: "1rem 0 0.5rem" }} />
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "1px solid #374151",
            color: "#64748b",
            padding: "0.4rem 1rem",
            cursor: "pointer",
            fontFamily: "'Silkscreen', monospace",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
          }}
        >
          [ RETREAT ]
        </button>
      </div>
    </div>
  );
}
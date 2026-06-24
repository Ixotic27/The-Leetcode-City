"use client";
import { useEffect, useState } from "react";

interface DungeonModalProps { onClose: () => void; }
interface DailyProblem { title: string; difficulty: string; titleSlug: string; }

const BOSS_MAP: Record<string, { name: string; emoji: string; color: string }> = {
  Easy: { name: "Goblin", emoji: "👺", color: "#4ade80" },
  Medium: { name: "Orc", emoji: "👹", color: "#fb923c" },
  Hard: { name: "Dragon", emoji: "🐉", color: "#f87171" },
};

export default function DungeonModal({ onClose }: DungeonModalProps) {
  const [problem, setProblem] = useState<DailyProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://alfa-leetcode-api.onrender.com/daily")
      .then((res) => res.json())
      .then((data) => {
        setProblem({ title: data.questionTitle, difficulty: data.difficulty, titleSlug: data.titleSlug });
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const boss = problem ? (BOSS_MAP[problem.difficulty] ?? BOSS_MAP["Medium"]) : null;
  const leetcodeUrl = problem ? "https://leetcode.com/problems/" + problem.titleSlug + "/" : "#";

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: "#1e1e2e", border: "2px solid #7c3aed", borderRadius: "16px", padding: "2rem", maxWidth: "420px", width: "90%", textAlign: "center", fontFamily: "monospace", color: "white" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: "#a78bfa", fontSize: "1.4rem", marginBottom: "0.5rem" }}>⚔️ Daily Coding Dungeon</h2>
        {loading && <p style={{ color: "#94a3b8" }}>Summoning dungeon boss...</p>}
        {error && <p style={{ color: "#f87171" }}>Failed to load dungeon.</p>}
        {problem && boss && (
          <div>
            <div style={{ fontSize: "4rem", margin: "1rem 0" }}>{boss.emoji}</div>
            <p style={{ color: "#94a3b8" }}>Today&apos;s Boss</p>
            <h3 style={{ color: boss.color }}>{boss.name} — {problem.difficulty}</h3>
            <p style={{ color: "#e2e8f0", marginBottom: "1.5rem" }}>{problem.title}</p>
            <a href={leetcodeUrl} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#7c3aed", color: "white", padding: "0.75rem 1.5rem", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", display: "inline-block" }}>⚔️ Fight Boss</a>
          </div>
        )}
        <button onClick={onClose} style={{ display: "block", margin: "1rem auto 0", background: "transparent", border: "1px solid #475569", color: "#94a3b8", padding: "0.4rem 1rem", borderRadius: "6px", cursor: "pointer" }}>Retreat</button>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FaShareAlt, FaLink, FaTrophy, FaFire, FaCalendarAlt, FaStar, FaGlobe, FaChevronRight } from "react-icons/fa";

interface Developer {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  contributions: number;
  total_stars: number;
  rank: number | null;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  acceptance_rate?: number;
  contest_rating?: number;
  lc_streak?: number;
  active_days_last_year?: number;
  xp_level?: number;
  xp_total?: number;
  kudos_count?: number;
  custom_color?: string | null;
  building_style?: string;
  primary_language?: string | null;
  district?: string | null;
}

const DISTRICT_COLORS: Record<string, string> = {
  downtown: "#ffa116",
  frontend: "#e8dcc8",
  backend: "#c8b89c",
  fullstack: "#cc8111",
  mobile: "#5a7a00",
  data_ai: "#06b6d4",
  devops: "#dc2626",
  security: "#3b82f6",
  gamedev: "#ec4899",
  vibe_coder: "#8b5cf6",
  creator: "#eab308",
};

export function CompareClient({
  initialUserA,
  initialUserB,
}: {
  initialUserA: string;
  initialUserB: string;
}) {
  const router = useRouter();
  const [inputA, setInputA] = useState(initialUserA);
  const [inputB, setInputB] = useState(initialUserB);

  const [devA, setDevA] = useState<Developer | null>(null);
  const [devB, setDevB] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async (userA: string, userB: string) => {
    if (!userA || !userB) return;
    setLoading(true);
    setError(null);
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/dev/${encodeURIComponent(userA.trim().toLowerCase())}`),
        fetch(`/api/dev/${encodeURIComponent(userB.trim().toLowerCase())}`),
      ]);

      if (resA.status === 429 || resB.status === 429) {
        setError("Rate limit exceeded. Please try again in an hour.");
        setLoading(false);
        return;
      }

      const dataA = await resA.json();
      const dataB = await resB.json();

      if (!resA.ok || dataA.error) {
        setError(`Developer "${userA}" not found or failed to load.`);
        setLoading(false);
        return;
      }
      if (!resB.ok || dataB.error) {
        setError(`Developer "${userB}" not found or failed to load.`);
        setLoading(false);
        return;
      }

      setDevA(dataA);
      setDevB(dataB);
    } catch (err) {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUserA && initialUserB) {
      fetchUsers(initialUserA, initialUserB);
    }
  }, [initialUserA, initialUserB]);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanA = inputA.trim();
    const cleanB = inputB.trim();
    if (!cleanA || !cleanB) return;
    router.push(`/compare?a=${encodeURIComponent(cleanA)}&b=${encodeURIComponent(cleanB)}`);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/compare?a=${encodeURIComponent(devA?.github_login ?? "")}&b=${encodeURIComponent(devB?.github_login ?? "")}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWinner = (keyA: keyof Developer, keyB: keyof Developer, invert = false) => {
    if (!devA || !devB) return null;
    const valA = (devA[keyA] as number) ?? 0;
    const valB = (devB[keyB] as number) ?? 0;
    if (valA === valB) return "tie";
    if (invert) {
      return valA < valB ? "A" : "B";
    }
    return valA > valB ? "A" : "B";
  };

  // Helper to draw a 2D styled building
  const render2DBuilding = (dev: Developer) => {
    const isBungalow = dev.building_style === "bungalow";
    const wallColor = dev.custom_color || DISTRICT_COLORS[dev.district || "fullstack"] || "#ffa116";

    // Approximate floor counts and window logic
    const totalSolved = dev.contributions || 0;
    const easy = dev.easy_solved || 0;
    const medium = dev.medium_solved || 0;
    const hard = dev.hard_solved || 0;

    const floorsCount = isBungalow ? 2 : Math.max(3, Math.min(10, Math.floor(totalSolved / 150) + 3));
    const windowsPerRow = isBungalow ? 5 : 3;

    // Distribute window colors based on easy/medium/hard distribution
    const totalDifficulties = (easy + medium + hard) || 1;
    const easyRatio = easy / totalDifficulties;
    const medRatio = medium / totalDifficulties;

    const floors = [];
    for (let f = 0; f < floorsCount; f++) {
      // Determine what difficulty tier this floor represents (bottom = easy, mid = med, top = hard)
      const ratio = f / floorsCount;
      let windowColor = "#f59e0b"; // Medium (yellow) default
      if (ratio < easyRatio) {
        windowColor = "#22c55e"; // Easy (green)
      } else if (ratio < easyRatio + medRatio) {
        windowColor = "#eab308"; // Medium (yellow)
      } else {
        windowColor = "#ef4444"; // Hard (red)
      }

      const windows = Array.from({ length: windowsPerRow }).map((_, wIdx) => {
        // Pseudo-random light states based on username and window coordinate
        const seed = dev.github_login.charCodeAt((f + wIdx) % dev.github_login.length) || 0;
        const isLit = (seed * (f + 1) * (wIdx + 3)) % 10 < 7; // ~70% windows are lit
        return { isLit, color: windowColor };
      });
      floors.push({ windows });
    }

    // Reverse floors list so floor index 0 is rendered at the bottom
    floors.reverse();

    return (
      <div className="flex flex-col items-center select-none py-6">
        {/* Roof customization or decoration */}
        <div className="w-16 h-3 flex items-center justify-center">
          {!isBungalow ? (
            <div className="w-1 h-6 bg-gray-500 border-t-2 border-[#ffa116]" />
          ) : (
            <div className="w-0 h-0 border-l-[32px] border-r-[32px] border-b-[12px] border-l-transparent border-r-transparent" style={{ borderBottomColor: wallColor }} />
          )}
        </div>

        {/* Building structure */}
        <div
          className="border-[3px] border-black p-2 flex flex-col gap-2 relative transition-all duration-300"
          style={{
            backgroundColor: "#101828",
            borderColor: wallColor,
            width: isBungalow ? "120px" : "80px",
            boxShadow: `6px 6px 0 0 rgba(0,0,0,0.4)`,
          }}
        >
          {floors.map((floor, fIdx) => (
            <div key={fIdx} className="flex justify-around items-center w-full h-3">
              {floor.windows.map((win, wIdx) => (
                <div
                  key={wIdx}
                  className="w-2 h-2.5 border border-black"
                  style={{
                    backgroundColor: win.isLit ? win.color : "#070b12",
                    boxShadow: win.isLit ? `0 0 4px ${win.color}` : "none",
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Foundation/ground */}
        <div className="w-32 h-[3px] bg-gray-700 mt-0.5" />
      </div>
    );
  };

  const statRow = (label: string, keyA: keyof Developer, keyB: keyof Developer, invert = false) => {
    const valA = devA ? devA[keyA] : null;
    const valB = devB ? devB[keyB] : null;
    const winner = getWinner(keyA, keyB, invert);

    const displayA = valA !== undefined && valA !== null ? valA.toLocaleString() : "—";
    const displayB = valB !== undefined && valB !== null ? valB.toLocaleString() : "—";

    return (
      <tr className="border-b border-gray-800 hover:bg-white/5 transition-colors">
        <td
          className={`py-3.5 px-4 font-mono text-sm text-right transition-colors ${
            winner === "A" ? "text-[#ffa116] font-bold" : "text-gray-400"
          }`}
        >
          {displayA}
        </td>
        <td className="py-3.5 px-2 text-center text-xs font-pixel text-cream uppercase tracking-wider">
          {label}
        </td>
        <td
          className={`py-3.5 px-4 font-mono text-sm text-left transition-colors ${
            winner === "B" ? "text-[#ffa116] font-bold" : "text-gray-400"
          }`}
        >
          {displayB}
        </td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-[#000206] font-pixel text-warm py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="text-xs text-muted hover:text-cream transition-colors">
            &larr; BACK TO CITY
          </Link>
        </div>

        {/* Header Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl text-cream tracking-wider flex items-center justify-center gap-2">
            🏙️ COMPARE MODE
          </h1>
          <p className="text-[10px] text-muted normal-case mt-2">
            Compare developer buildings and stats side-by-side
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleCompare} className="border-[3px] border-border bg-bg-raised p-4 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <input
              type="text"
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              placeholder="Username A"
              className="w-full sm:w-48 border-[3px] border-border bg-bg-card px-4 py-2.5 text-xs text-cream focus:border-border-light focus:outline-none"
            />
            <span className="text-xs text-muted uppercase font-bold">VS</span>
            <input
              type="text"
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              placeholder="Username B"
              className="w-full sm:w-48 border-[3px] border-border bg-bg-card px-4 py-2.5 text-xs text-cream focus:border-border-light focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !inputA.trim() || !inputB.trim()}
              className="w-full sm:w-auto btn-press border-[3px] border-border bg-bg-card px-6 py-2.5 text-xs text-cream font-bold transition-colors hover:border-border-light disabled:opacity-40"
            >
              {loading ? "FETCHING..." : "COMPARE"}
            </button>
          </div>
        </form>

        {/* Error State */}
        {error && (
          <div className="border-[3px] border-red-500/50 bg-red-950/20 text-red-400 p-4 text-xs text-center mb-8">
            ⚠️ {error}
          </div>
        )}

        {/* Main Compare Workspace */}
        {devA && devB && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Dev A Card & Building */}
              <div className="border-[3px] border-border bg-bg-raised p-5 flex flex-col justify-between items-center text-center">
                <div>
                  <div className="relative inline-block mb-3">
                    {devA.avatar_url && (
                      <Image
                        src={devA.avatar_url}
                        alt={devA.github_login}
                        width={64}
                        height={64}
                        className="border-[3px] border-border rounded"
                        style={{ imageRendering: "pixelated" }}
                      />
                    )}
                  </div>
                  <h2 className="text-sm text-cream truncate max-w-[160px] mx-auto">
                    @{devA.github_login}
                  </h2>
                  <p className="text-[10px] text-muted normal-case mt-1">
                    {devA.name || "Anonymous Coder"}
                  </p>
                  <div className="mt-2 text-[9px] text-[#ffa116]">
                    LEVEL {devA.xp_level ?? 1}
                  </div>
                </div>

                {render2DBuilding(devA)}

                <Link
                  href={`/dev/${devA.github_login}`}
                  className="mt-4 text-[9px] text-[#ffa116] border border-[#ffa116]/30 px-3 py-1 hover:bg-[#ffa116]/10 flex items-center gap-1 justify-center"
                >
                  VIEW PROFILE <FaChevronRight className="text-[7px]" />
                </Link>
              </div>

              {/* Stat Comparison Table */}
              <div className="border-[3px] border-border bg-bg-card p-4 md:col-span-1 flex flex-col justify-center">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-800 text-[10px] text-muted tracking-wider">
                      <th className="py-2 text-right w-1/3">@{devA.github_login}</th>
                      <th className="py-2 text-center w-1/3">VS</th>
                      <th className="py-2 text-left w-1/3">@{devB.github_login}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statRow("Total Solved", "contributions", "contributions")}
                    {statRow("Easy Solved", "easy_solved", "easy_solved")}
                    {statRow("Medium Solved", "medium_solved", "medium_solved")}
                    {statRow("Hard Solved", "hard_solved", "hard_solved")}
                    {statRow("Contest Rating", "contest_rating", "contest_rating")}
                    {statRow("Active Days", "active_days_last_year", "active_days_last_year")}
                    {statRow("Current Streak", "lc_streak", "lc_streak")}
                    {statRow("Global Rank", "rank", "rank", true)}
                    {statRow("Reputation", "total_stars", "total_stars")}
                    {statRow("Kudos", "kudos_count", "kudos_count")}
                    {statRow("Total XP", "xp_total", "xp_total")}
                  </tbody>
                </table>
              </div>

              {/* Dev B Card & Building */}
              <div className="border-[3px] border-border bg-bg-raised p-5 flex flex-col justify-between items-center text-center">
                <div>
                  <div className="relative inline-block mb-3">
                    {devB.avatar_url && (
                      <Image
                        src={devB.avatar_url}
                        alt={devB.github_login}
                        width={64}
                        height={64}
                        className="border-[3px] border-border rounded"
                        style={{ imageRendering: "pixelated" }}
                      />
                    )}
                  </div>
                  <h2 className="text-sm text-cream truncate max-w-[160px] mx-auto">
                    @{devB.github_login}
                  </h2>
                  <p className="text-[10px] text-muted normal-case mt-1">
                    {devB.name || "Anonymous Coder"}
                  </p>
                  <div className="mt-2 text-[9px] text-[#ffa116]">
                    LEVEL {devB.xp_level ?? 1}
                  </div>
                </div>

                {render2DBuilding(devB)}

                <Link
                  href={`/dev/${devB.github_login}`}
                  className="mt-4 text-[9px] text-[#ffa116] border border-[#ffa116]/30 px-3 py-1 hover:bg-[#ffa116]/10 flex items-center gap-1 justify-center"
                >
                  VIEW PROFILE <FaChevronRight className="text-[7px]" />
                </Link>
              </div>
            </div>

            {/* Sharing / Actions Row */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 border-[3px] border-border bg-bg-raised px-6 py-3 text-xs text-cream transition-colors hover:border-border-light font-bold"
              >
                <FaLink /> {copied ? "COPIED!" : "COPY COMPARE LINK"}
              </button>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                  `Comparing my building with @${devB.github_login} in LeetCode City! Solved: ${devA.contributions} vs ${devB.contributions}. Check it out!`
                )}&url=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.origin + `/compare?a=${devA.github_login}&b=${devB.github_login}` : ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#ffa116] px-6 py-3.5 text-xs text-bg font-bold transition-colors hover:brightness-110"
                style={{ boxShadow: `4px 4px 0 0 #5a7a00` }}
              >
                <FaShareAlt /> SHARE ON X
              </a>
            </div>
          </div>
        )}

        {/* Empty / Initial State */}
        {!devA && !devB && !loading && (
          <div className="border-[3px] border-border bg-bg-raised/40 p-8 text-center text-xs text-muted leading-relaxed">
            🔍 Enter two LeetCode usernames above to generate side-by-side 2D buildings and stats comparisons.
          </div>
        )}
      </div>
    </main>
  );
}

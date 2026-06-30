"use client";

import { useEffect, useMemo, useState } from "react";
import type { CityBuilding } from "@/lib/github";

const LEADERBOARD_CATEGORIES = [
  { label: "Solved", key: "contributions" as const, tab: "solved" },
  { label: "LC Rank", key: "rank" as const, tab: "lc_rank" },
  { label: "Streak", key: "lc_streak" as const, tab: "streak" },
] as const;

interface MiniLeaderboardProps {
  buildings: CityBuilding[];
  accent: string;
}

export default function MiniLeaderboard({
  buildings,
  accent,
}: MiniLeaderboardProps) {
  const [catIndex, setCatIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCatIndex((i) => (i + 1) % LEADERBOARD_CATEGORIES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const cat = LEADERBOARD_CATEGORIES[catIndex];
  const sorted = useMemo(
    () =>
      buildings
        .slice()
        .sort((a, b) => {
          if (cat.key === "rank") {
            const rankA = a.rank && a.rank < 999999 ? a.rank : 999999;
            const rankB = b.rank && b.rank < 999999 ? b.rank : 999999;
            return rankA - rankB;
          }
          return ((b[cat.key] as number) || 0) - ((a[cat.key] as number) || 0);
        })
        .slice(0, 5),
    [buildings, cat.key],
  );

  return (
    <div className="hidden w-[200px] sm:block">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() =>
            setCatIndex((i) => (i + 1) % LEADERBOARD_CATEGORIES.length)
          }
          className="text-[10px] text-muted transition-colors hover:text-cream normal-case"
          style={{ color: accent }}
        >
          {cat.label}
        </button>
        <a
          href={`/leaderboard?tab=${cat.tab}`}
          className="text-[9px] text-muted transition-colors hover:text-cream normal-case"
        >
          View all &rarr;
        </a>
      </div>
      <div className="border-[2px] border-border bg-bg-raised/80 backdrop-blur-sm">
        {sorted.map((b, i) => (
          <a
            key={b.login}
            href={`/dev/${b.login}`}
            className="flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-bg-card"
          >
            <span className="flex items-center gap-2 overflow-hidden">
              <span
                className="text-[10px]"
                style={{
                  color:
                    i === 0
                      ? "#ffd700"
                      : i === 1
                        ? "#c0c0c0"
                        : i === 2
                          ? "#cd7f32"
                          : accent,
                }}
              >
                #{i + 1}
              </span>
              <span className="truncate text-[10px] text-cream normal-case">
                {b.login}
              </span>
            </span>
            <span className="ml-2 flex-shrink-0 text-[10px] text-muted">
              {(b[cat.key] as number).toLocaleString()}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

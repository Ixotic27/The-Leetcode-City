"use client";

import useSWR from "swr";
import { HiUsers, HiBuildingOffice2, HiCheckCircle, HiTrophy } from "react-icons/hi2";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Failed to fetch ${url}: ${r.status} ${r.statusText}`);
  }
  return r.json();
};

export interface CityStatsData {
  totalDevelopers?: number;
  claimedBuildings?: number;
  totalSolves?: number;
  tallestBuilding?: {
    username: string;
    hardSolved: number;
  };
  generatedAt?: string;
}

export function CityStatsBar() {
  const { data, error, isLoading } = useSWR<CityStatsData>("/api/stats", fetcher, {
    refreshInterval: 300_000, // Refresh every 5 minutes
    revalidateOnFocus: false,
  });

  const stats = [
    {
      label: "Developers",
      value: isLoading
        ? "…"
        : error || data?.totalDevelopers == null
        ? "—"
        : data.totalDevelopers.toLocaleString(),
      icon: HiUsers,
      color: "text-amber-400",
    },
    {
      label: "Buildings Claimed",
      value: isLoading
        ? "…"
        : error || data?.claimedBuildings == null
        ? "—"
        : data.claimedBuildings.toLocaleString(),
      icon: HiBuildingOffice2,
      color: "text-emerald-400",
    },
    {
      label: "Problems Solved",
      value: isLoading
        ? "…"
        : error || data?.totalSolves == null
        ? "—"
        : data.totalSolves.toLocaleString(),
      icon: HiCheckCircle,
      color: "text-sky-400",
    },
    {
      label: "Tallest Building",
      value: isLoading
        ? "…"
        : error || !data?.tallestBuilding?.username
        ? "—"
        : `${data.tallestBuilding.username} (${data.tallestBuilding.hardSolved} Hard)`,
      icon: HiTrophy,
      color: "text-purple-400",
    },
  ];

  return (
    <aside
      aria-label="City Statistics Bar"
      className="pointer-events-auto mx-auto my-2 flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium backdrop-blur-md shadow-lg transition-all hover:border-white/20"
    >
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center space-x-2 px-2 py-1 transition-transform hover:scale-105"
          >

            <Icon className={`h-4 w-4 ${s.color}`} />
            <span className="font-bold text-white tracking-wide">{s.value}</span>
            <span className="text-gray-400 text-[11px]">{s.label}</span>
          </div>
        );
      })}
    </aside>
  );
}

export default CityStatsBar;

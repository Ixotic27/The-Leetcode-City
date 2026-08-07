"use client";

import React, { useEffect } from "react";
import useSWR from "swr";
import { HiXMark } from "react-icons/hi2";
import { useCity } from "@/context/CityContext";
import type { CityStatsData } from "@/components/CityStatsBar";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Failed to fetch ${url}: ${r.status} ${r.statusText}`);
  }
  return r.json();
};

interface CityStatsTableModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CityStatsTableModal({ open, onClose }: CityStatsTableModalProps) {
  const { buildings, districtZones, stats } = useCity();
  const { data: statsApiData } = useSWR<CityStatsData>("/api/stats", fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const totalDevs = statsApiData?.totalDevelopers ?? stats.total_developers ?? buildings.length;
  const claimedCount = statsApiData?.claimedBuildings ?? buildings.filter((b) => b.claimed).length;
  const totalSolves = statsApiData?.totalSolves ?? stats.total_contributions;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="static-stats-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/20 bg-[#12141c] p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 id="static-stats-title" className="text-xl font-bold text-amber-400">
              City Overview — Static Table View
            </h2>
            <p className="text-xs text-gray-400">
              Accessible statistics overview without 3D motion
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close static stats table"
          >
            <HiXMark className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Top Summary Table */}
          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className="mb-2 text-sm font-semibold text-sky-400">
              General Metrics
            </h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 px-3 font-semibold">Metric</th>
                  <th className="py-2 px-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 px-3">Total Developers in City</td>
                  <td className="py-2 px-3 font-bold text-amber-300">{totalDevs.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">Claimed Buildings</td>
                  <td className="py-2 px-3 font-bold text-emerald-400">{claimedCount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">Problems Solved</td>
                  <td className="py-2 px-3 font-bold text-sky-400">
                    {totalSolves ? totalSolves.toLocaleString() : "—"}
                  </td>
                </tr>
                {statsApiData?.tallestBuilding && (
                  <tr>
                    <td className="py-2 px-3 font-medium">Tallest Building</td>
                    <td className="py-2 px-3 font-bold text-purple-400">
                      {statsApiData.tallestBuilding.username} ({statsApiData.tallestBuilding.hardSolved} Hard Solved)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* District Breakdown Table */}
          <section aria-labelledby="districts-heading">
            <h3 id="districts-heading" className="mb-2 text-sm font-semibold text-emerald-400">
              District Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-2 px-3 font-semibold">District</th>
                    <th className="py-2 px-3 font-semibold">Population</th>
                    <th className="py-2 px-3 font-semibold">Primary Specialty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {districtZones.map((zone) => (
                    <tr key={zone.id}>
                      <td className="py-2 px-3 font-medium" style={{ color: zone.color }}>
                        {zone.name}
                      </td>
                      <td className="py-2 px-3">{zone.population} developers</td>
                      <td className="py-2 px-3 text-gray-400 font-mono text-[10px]">{zone.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top Developer Buildings Table */}
          <section aria-labelledby="buildings-heading">
            <h3 id="buildings-heading" className="mb-2 text-sm font-semibold text-purple-400">
              Top Claimed Developer Buildings
            </h3>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#1a1c26] text-gray-400">
                  <tr className="border-b border-white/10">
                    <th className="py-2 px-3 font-semibold">Developer</th>
                    <th className="py-2 px-3 font-semibold">District</th>
                    <th className="py-2 px-3 font-semibold">Total Solves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {buildings
                    .filter((b) => b.claimed)
                    .slice(0, 20)
                    .map((b) => (
                      <tr key={b.login}>
                        <td className="py-2 px-3 font-semibold text-white">{b.login}</td>
                        <td className="py-2 px-3 text-gray-400">{b.district ?? "Downtown"}</td>
                        <td className="py-2 px-3 text-amber-300">{b.contributions.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end border-t border-white/10 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}

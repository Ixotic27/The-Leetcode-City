"use client";

import { useMemo, useState } from "react";
import type { CityBuilding, DistrictZone } from "@/lib/github";
import type { LiveSession } from "@/lib/useCodingPresence";
import { XP_TIERS, tierFromLevel } from "@/lib/xp";

// ─── Constants ────────────────────────────────────────────────
const ACCENT = "#ffa116";

// ─── Props ────────────────────────────────────────────────────
interface CityAnalyticsDashboardProps {
  buildings: CityBuilding[];
  liveUsers: number;
  liveByLogin: Map<string, LiveSession>;
  districtZones: DistrictZone[];
  open: boolean;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[9px] mb-2" style={{ color: ACCENT }}>
      {title}
    </p>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] text-muted normal-case">{label}</span>
      <span className="text-[9px]" style={{ color: color ?? "#e8dcc8" }}>
        {value}
      </span>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-1.5">
      <div className="flex justify-between mb-0.5">
        <span className="text-[8px] text-muted normal-case">{label}</span>
        <span className="text-[8px]" style={{ color: ACCENT }}>
          {value}
        </span>
      </div>
      <div
        className="h-[3px] w-full"
        style={{ background: "#2a2a30" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Panel 1: Active Sessions ─────────────────────────────────
function ActiveSessionsPanel({
  liveUsers,
  liveByLogin,
}: {
  liveUsers: number;
  liveByLogin: Map<string, LiveSession>;
}) {
  const codingCount = liveByLogin.size;

  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of liveByLogin.values()) {
      if (session.language) {
        counts[session.language] = (counts[session.language] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [liveByLogin]);

  const activeCount = useMemo(
    () =>
      [...liveByLogin.values()].filter((s) => s.status === "active").length,
    [liveByLogin]
  );

  return (
    <div className="mb-4">
      <SectionHeader title="▸ ACTIVE SESSIONS" />
      <StatRow label="Viewers online" value={liveUsers} color="#4ade80" />
      <StatRow label="Coding now" value={codingCount} color="#60a5fa" />
      <StatRow label="Active" value={activeCount} color="#4ade80" />
      <StatRow
        label="Idle"
        value={codingCount - activeCount}
        color="#5c5c6c"
      />
      {languageCounts.length > 0 && (
        <div className="mt-2">
          <p className="text-[8px] text-dim mb-1.5 normal-case">
            languages in use
          </p>
          {languageCounts.map(([lang, count]) => (
            <BarRow
              key={lang}
              label={lang}
              value={count}
              max={codingCount || 1}
              color="#60a5fa"
            />
          ))}
        </div>
      )}
      {languageCounts.length === 0 && (
        <p className="text-[8px] text-dim normal-case mt-1">
          no active coding sessions
        </p>
      )}
    </div>
  );
}

// ─── Panel 2: Building Density ────────────────────────────────
function BuildingDensityPanel({
  buildings,
  districtZones,
}: {
  buildings: CityBuilding[];
  districtZones: DistrictZone[];
}) {
  const totalBuildings = buildings.length;
  const claimedCount = buildings.filter((b) => b.claimed).length;
  const claimedPct =
    totalBuildings > 0 ? Math.round((claimedCount / totalBuildings) * 100) : 0;

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of buildings) {
      const d = b.district ?? "fullstack";
      counts[d] = (counts[d] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [buildings]);

  const maxDistrictCount = districtCounts[0]?.[1] ?? 1;

  const getDistrictColor = (id: string) => {
    return districtZones.find((z) => z.id === id)?.color ?? "#5c5c6c";
  };

  const getDistrictName = (id: string) => {
    return districtZones.find((z) => z.id === id)?.name ?? id;
  };

  return (
    <div className="mb-4">
      <SectionHeader title="▸ BUILDING DENSITY" />
      <StatRow label="Total buildings" value={totalBuildings} />
      <StatRow
        label="Claimed"
        value={`${claimedCount} (${claimedPct}%)`}
        color={ACCENT}
      />
      <StatRow
        label="Unclaimed"
        value={totalBuildings - claimedCount}
        color="#5c5c6c"
      />
      {districtCounts.length > 0 && (
        <div className="mt-2">
          <p className="text-[8px] text-dim mb-1.5 normal-case">
            top districts
          </p>
          {districtCounts.map(([id, count]) => (
            <BarRow
              key={id}
              label={getDistrictName(id)}
              value={count}
              max={maxDistrictCount}
              color={getDistrictColor(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel 3: City Health ─────────────────────────────────────
function CityHealthPanel({ buildings }: { buildings: CityBuilding[] }) {
  const total = buildings.length;

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tier of XP_TIERS) counts[tier.id] = 0;
    for (const b of buildings) {
      const tier = tierFromLevel(b.xp_level ?? 1);
      counts[tier.id] = (counts[tier.id] ?? 0) + 1;
    }
    return XP_TIERS.map((tier) => ({
      ...tier,
      count: counts[tier.id] ?? 0,
    }));
  }, [buildings]);

  const avgStreak = useMemo(() => {
    if (total === 0) return 0;
    const sum = buildings.reduce((acc, b) => acc + (b.app_streak ?? 0), 0);
    return Math.round(sum / total);
  }, [buildings, total]);

  const totalContributions = useMemo(
    () => buildings.reduce((acc, b) => acc + (b.contributions ?? 0), 0),
    [buildings]
  );

  const raidTagCount = buildings.filter(
    (b) => b.active_raid_tag != null
  ).length;
  const raidTagPct =
    total > 0 ? Math.round((raidTagCount / total) * 100) : 0;

  const maxTierCount = Math.max(...tierCounts.map((t) => t.count), 1);

  return (
    <div className="mb-2">
      <SectionHeader title="▸ CITY HEALTH" />
      <StatRow
        label="Total contributions"
        value={totalContributions.toLocaleString()}
        color={ACCENT}
      />
      <StatRow label="Avg streak" value={`${avgStreak}d`} color="#fbbf24" />
      <StatRow
        label="Raid tags active"
        value={`${raidTagCount} (${raidTagPct}%)`}
        color="#f87171"
      />
      <div className="mt-2">
        <p className="text-[8px] text-dim mb-1.5 normal-case">
          xp tier distribution
        </p>
        {tierCounts.map((tier) => (
          <BarRow
            key={tier.id}
            label={tier.name}
            value={tier.count}
            max={maxTierCount}
            color={tier.color}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function CityAnalyticsDashboard({
  buildings,
  liveUsers,
  liveByLogin,
  districtZones,
  open,
  onClose,
}: CityAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "sessions" | "density" | "health"
  >("sessions");

  if (!open) return null;

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "sessions", label: "LIVE" },
    { id: "density", label: "MAP" },
    { id: "health", label: "CITY" },
  ];

  return (
    <div
      className="fixed top-12 right-3 z-[35] w-56 border border-border bg-bg/95 backdrop-blur-sm sm:top-14 sm:right-4"
      style={{ boxShadow: "4px 4px 0 0 rgba(0,0,0,0.5)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 live-dot"
            style={{ background: "#4ade80" }}
          />
          <span className="text-[9px]" style={{ color: ACCENT }}>
            ANALYTICS
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[9px] text-muted hover:text-cream"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-1.5 text-[8px] transition-colors"
            style={{
              color: activeTab === tab.id ? ACCENT : "#5c5c6c",
              borderBottom:
                activeTab === tab.id ? `1px solid ${ACCENT}` : "none",
              background:
                activeTab === tab.id ? "rgba(255,161,22,0.05)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-3 py-3 max-h-80 overflow-y-auto scrollbar-thin">
        {activeTab === "sessions" && (
          <ActiveSessionsPanel
            liveUsers={liveUsers}
            liveByLogin={liveByLogin}
          />
        )}
        {activeTab === "density" && (
          <BuildingDensityPanel
            buildings={buildings}
            districtZones={districtZones}
          />
        )}
        {activeTab === "health" && <CityHealthPanel buildings={buildings} />}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-1.5">
        <p className="text-[8px] text-dim normal-case">
          {buildings.length} buildings · live data
        </p>
      </div>
    </div>
  );
}
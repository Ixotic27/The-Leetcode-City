"use client";

import type { CityBuilding } from "@/lib/github";

interface BuildingTooltipProps {
  building: CityBuilding | null;
  mouseX: number;
  mouseY: number;
}

export default function BuildingTooltip({ building, mouseX, mouseY }: BuildingTooltipProps) {
  if (!building) return null;

  const litPct = typeof building.litPercentage === "number"
    ? Math.round(building.litPercentage * 100)
    : 0;

  return (
    <div
      className="fixed pointer-events-none z-50 bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm"
      style={{
        left: `${mouseX + 16}px`,
        top: `${mouseY + 16}px`,
        maxWidth: "280px",
      }}
    >
      <div className="space-y-1.5 text-sm">
        <div className="font-semibold text-white border-b border-gray-700 pb-1.5">
          {building.name || building.login}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-300">
          <div className="text-gray-400">Height:</div>
          <div className="text-right">{Math.round(building.height)}m</div>

          <div className="text-gray-400">Width:</div>
          <div className="text-right">{Math.round(building.width)}m</div>

          <div className="text-gray-400">Depth:</div>
          <div className="text-right">{Math.round(building.depth)}m</div>

          {building.district && (
            <>
              <div className="text-gray-400">District:</div>
              <div className="text-right capitalize">{building.district}</div>
            </>
          )}

          <div className="text-gray-400">Windows Lit:</div>
          <div className="text-right">{litPct}%</div>
        </div>
      </div>
    </div>
  );
}

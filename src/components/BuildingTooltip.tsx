"use client";

import { useEffect, useState } from "react";
import type { CityBuilding } from "@/lib/github";

interface BuildingTooltipProps {
  building: CityBuilding | null;
  mouseX: number;
  mouseY: number;
}

export default function BuildingTooltip({ building, mouseX, mouseY }: BuildingTooltipProps) {
  const [position, setPosition] = useState({ x: mouseX, y: mouseY });

  useEffect(() => {
    // Update position with a small offset from cursor to avoid blocking view
    setPosition({
      x: mouseX + 16,
      y: mouseY + 16
    });
  }, [mouseX, mouseY]);

  if (!building) return null;

  // Calculate lit percentage as a readable value
  const litPct = typeof building.litPercentage === "number" 
    ? Math.round(building.litPercentage * 100) 
    : 0;

  return (
    <div
      className="fixed pointer-events-none z-50 bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: "280px",
        transform: "translate(0, 0)"
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

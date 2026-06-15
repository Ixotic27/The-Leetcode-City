"use client";

import React, { useState, useEffect } from "react";
import { STATIC_RELICS, Relic } from "@/lib/relics";

interface RelicModalProps {
  isOpen: boolean;
  onClose: () => void;
  equippedRelicId: string | null;
  onEquip: (relicId: string | null) => void;
  relics?: Relic[];
  accentColor: string;
  shadowColor: string;
}

const ERA_THEMES = {
  Lith: {
    border: "#b77030", // Bronze
    bg: "radial-gradient(circle, #3d2414 0%, #150d08 100%)",
    glow: "rgba(183, 112, 48, 0.4)",
    glyph: "▲",
  },
  Meso: {
    border: "#d87040", // Copper
    bg: "radial-gradient(circle, #481e0c 0%, #170a04 100%)",
    glow: "rgba(216, 112, 64, 0.4)",
    glyph: "◈",
  },
  Neo: {
    border: "#a0a0a0", // Silver / Steel
    bg: "radial-gradient(circle, #2a2c30 0%, #0d0f12 100%)",
    glow: "rgba(160, 160, 160, 0.4)",
    glyph: "◆",
  },
  Axi: {
    border: "#ffa116", // Gold
    bg: "radial-gradient(circle, #482f0c 0%, #170d04 100%)",
    glow: "rgba(255, 161, 22, 0.4)",
    glyph: "❖",
  },
  Requiem: {
    border: "#a855f7", // Void / Purple
    bg: "radial-gradient(circle, #330c48 0%, #100417 100%)",
    glow: "rgba(168, 85, 247, 0.4)",
    glyph: "👁",
  },
};

export default function RelicModal({
  isOpen,
  onClose,
  equippedRelicId,
  onEquip,
  relics = STATIC_RELICS,
  accentColor,
  shadowColor,
}: RelicModalProps) {
  const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Set default selected relic
  useEffect(() => {
    if (isOpen) {
      const active = relics.find((r) => r.id === equippedRelicId);
      setSelectedRelic(active || relics[0] || null);
    }
  }, [isOpen, equippedRelicId, relics]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[fade-in_0.2s_ease-out]">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-2xl border-[3px] bg-bg-raised p-6 text-cream shadow-2xl sm:p-8"
        style={{
          borderColor: accentColor,
          boxShadow: `6px 6px 0 0 ${shadowColor}`,
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-wider" style={{ color: accentColor }}>
              RELIC VAULT
            </h2>
            <p className="mt-0.5 text-[9px] text-muted normal-case">
              Select and equip relics to travel to key landmarks in LeetCode City.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-press border-[2px] border-border bg-bg/50 px-2.5 py-1 text-[10px] text-muted transition-colors hover:text-cream hover:border-border-light"
          >
            &#10005; CLOSE
          </button>
        </div>

        {/* Modal Layout */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          {/* Relics List (Circular Grid) */}
          <div className="md:col-span-3 space-y-4">
            <div className="text-[10px] font-bold text-muted tracking-wider">
              RESONATING ARTIFACTS
            </div>
            <div className="grid grid-cols-4 gap-4 p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {relics.map((relic) => {
                const theme = ERA_THEMES[relic.era];
                const isEquipped = relic.id === equippedRelicId;
                const isSelected = relic.id === selectedRelic?.id;
                const isLocked = relic.locked;

                return (
                  <div
                    key={relic.id}
                    onClick={() => setSelectedRelic(relic)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    {/* Circle shape representation */}
                    <div
                      className={`relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] transition-all duration-300 ${
                        isSelected ? "scale-110 shadow-lg" : "hover:scale-105"
                      } ${isLocked ? "opacity-60 saturate-50" : ""}`}
                      style={{
                        borderColor: isSelected ? accentColor : (isLocked ? "#3f3f46" : theme.border),
                        background: isLocked ? "radial-gradient(circle, #18181b 0%, #09090b 100%)" : theme.bg,
                        boxShadow: isSelected
                          ? `0 0 15px ${accentColor}80`
                          : (isLocked ? "none" : `0 0 10px ${theme.border}40`),
                      }}
                    >
                      {/* Inner metallic ring */}
                      <div className="absolute inset-1 rounded-full border border-dashed border-white/20" />
                      
                      {/* Holographic glyph inside */}
                      <span
                        className="text-lg font-bold transition-transform duration-500 group-hover:rotate-180"
                        style={{ color: isLocked ? "#71717a" : theme.border }}
                      >
                        {isLocked ? "🔒" : theme.glyph}
                      </span>

                      {/* Equipped Ribbon/Indicator */}
                      {isEquipped && (
                        <div
                          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-bg animate-pulse"
                          style={{ backgroundColor: accentColor }}
                          title="Equipped"
                        >
                          ✓
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[8px] text-center tracking-wide font-semibold truncate w-full ${
                        isSelected ? "text-cream" : "text-muted group-hover:text-cream"
                      }`}
                    >
                      {relic.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Relic Panel */}
          <div className="md:col-span-2 flex flex-col justify-between border-[2px] border-border bg-bg/50 p-4">
            {selectedRelic ? (
              <>
                <div className="space-y-4">
                  {/* Circle display */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full border-[3px] ${selectedRelic.locked ? "opacity-60 saturate-50" : ""}`}
                      style={{
                        borderColor: selectedRelic.locked ? "#3f3f46" : ERA_THEMES[selectedRelic.era].border,
                        background: selectedRelic.locked ? "radial-gradient(circle, #18181b 0%, #09090b 100%)" : ERA_THEMES[selectedRelic.era].bg,
                        boxShadow: selectedRelic.locked ? "none" : `0 0 12px ${ERA_THEMES[selectedRelic.era].border}50`,
                      }}
                    >
                      <span className="text-xl" style={{ color: selectedRelic.locked ? "#71717a" : ERA_THEMES[selectedRelic.era].border }}>
                        {selectedRelic.locked ? "🔒" : ERA_THEMES[selectedRelic.era].glyph}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm inline-block tracking-wider"
                          style={{
                            backgroundColor: selectedRelic.locked ? "#27272a" : ERA_THEMES[selectedRelic.era].border + "22",
                            color: selectedRelic.locked ? "#71717a" : ERA_THEMES[selectedRelic.era].border,
                            border: `1px solid ${selectedRelic.locked ? "#3f3f46" : ERA_THEMES[selectedRelic.era].border + "40"}`,
                          }}
                        >
                          {selectedRelic.era.toUpperCase()} ERA
                        </div>
                        {selectedRelic.locked && (
                          <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm inline-block bg-red-500/10 text-red-400 border border-red-500/20 tracking-wider">
                            LOCKED
                          </div>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-cream mt-1">{selectedRelic.name}</h3>
                    </div>
                  </div>

                  {/* Relic Card Description, Abilities, and Achievement steps */}
                  {selectedRelic.description && (
                    <div className="space-y-1">
                      <p className="text-[9.5px] italic leading-relaxed text-cream/90 normal-case">
                        "{selectedRelic.description}"
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-[9px] text-muted font-bold tracking-wider">
                      ABILITIES
                    </div>
                    <p className="text-[9.5px] leading-relaxed text-cream normal-case font-medium">
                      {selectedRelic.abilities}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-muted font-bold tracking-wider">
                      HOW TO ACHIEVE
                    </div>
                    <p className="text-[9.5px] leading-relaxed text-cream normal-case font-medium">
                      {selectedRelic.howToAchieve}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/40 space-y-2">
                  {selectedRelic.locked ? (
                    <button
                      disabled
                      className="w-full py-2 text-center text-[10px] text-muted border-[2px] border-border bg-bg/20 cursor-not-allowed opacity-50 font-bold"
                    >
                      LOCKED
                    </button>
                  ) : equippedRelicId === selectedRelic.id ? (
                    <button
                      onClick={() => {
                        onEquip(null);
                      }}
                      className="btn-press w-full py-2 text-center text-[10px] text-cream border-[2px] border-red-500/60 hover:bg-red-500/10 transition-colors"
                    >
                      UNEQUIP RELIC
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onEquip(selectedRelic.id);
                        onClose();
                      }}
                      className="btn-press w-full py-2 text-center text-[10px] text-bg font-bold transition-all"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: `2px 2px 0 0 ${shadowColor}`,
                      }}
                    >
                      EQUIP RELIC
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-[9px] text-muted">
                No relic selected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

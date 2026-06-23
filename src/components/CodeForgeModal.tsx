"use client";

import { useState, useEffect } from "react";

const ACCENT = "#f97316";

const WINDOW_PATTERNS = [
  { id: "default", label: "Default Grid", desc: "Standard window grid" },
  { id: "matrix", label: "Matrix Code", desc: "Falling code on windows" },
  { id: "glitch", label: "Glitch", desc: "Static interference pattern" },
  { id: "pulse", label: "Pulse Wave", desc: "Synced wave animation" },
];

const COMPILER_THEMES = [
  { id: "monokai", label: "Monokai", desc: "Classic dark editor" },
  { id: "dracula", label: "Dracula", desc: "Dark purple elegance" },
  { id: "nord", label: "Nord", desc: "Arctic blue tones" },
  { id: "solarized", label: "Solarized", desc: "Warm sepia tones" },
];

export default function CodeForgeModal({ onClose }: { onClose: () => void }) {
  const [selectedPattern, setSelectedPattern] = useState("default");
  const [selectedTheme, setSelectedTheme] = useState("monokai");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#0a0818" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-6 font-pixel w-full max-w-md px-4">
        <h2 className="text-lg tracking-widest uppercase" style={{ color: ACCENT }}>
          CodeForge
        </h2>
        <p className="text-[10px] text-gray-500 -mt-4">Customize your coding environment</p>

        <div className="w-full space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">
              Building Window Patterns
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WINDOW_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPattern(p.id)}
                  className="p-3 text-left border-2 transition-colors"
                  style={{
                    borderColor: selectedPattern === p.id ? ACCENT : "#222",
                    backgroundColor: selectedPattern === p.id ? `${ACCENT}11` : "transparent",
                  }}
                >
                  <p className="text-[11px] uppercase tracking-wider" style={{
                    color: selectedPattern === p.id ? ACCENT : "#ccc",
                  }}>
                    {p.label}
                  </p>
                  <p className="text-[8px] text-gray-500 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">
              Compiler Sound Themes
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COMPILER_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className="p-3 text-left border-2 transition-colors"
                  style={{
                    borderColor: selectedTheme === t.id ? ACCENT : "#222",
                    backgroundColor: selectedTheme === t.id ? `${ACCENT}11` : "transparent",
                  }}
                >
                  <p className="text-[11px] uppercase tracking-wider" style={{
                    color: selectedTheme === t.id ? ACCENT : "#ccc",
                  }}>
                    {t.label}
                  </p>
                  <p className="text-[8px] text-gray-500 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[8px] text-gray-600 tracking-wider mt-2">ESC TO CLOSE</p>
      </div>
    </div>
  );
}

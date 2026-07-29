"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────

export type LoadingStage =
  | "init"
  | "fetching"
  | "generating"
  | "rendering"
  | "ready"
  | "done"
  | "error";

interface LoadingScreenProps {
  stage: LoadingStage;
  progress: number;
  error: string | null;
  accentColor: string;
  stats?: { total_developers: number; total_contributions: number };
  onRetry: () => void;
  onFadeComplete: () => void;
}

interface TermLine {
  id: number;
  cls: "cmd" | "out" | "remote" | "step" | "welcome" | "error" | "blank";
  text: string;
  done?: boolean;
  typing?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────

// Fallbacks for when the snapshot stats haven't arrived yet
const FALLBACK_DEVS = 12500;
const FALLBACK_CONTRIBS = 8500000;

const EASTER_EGGS = [
  "remote: warning: 3 devs pushed to main on a Friday",
  "remote: hint: neon fog detected over the city, rendering anyway",
  "remote: 42 merge conflicts resolved peacefully today",
  "remote: note: someone force-pushed. the city forgives.",
  "remote: tip: tallest building belongs to whoever solves the most",
];

const KEEPALIVE = [
  "remote: still receiving objects...",
  "remote: network is slow, hang tight...",
  "remote: almost there...",
];

// Script plays at this relaxed pace by default; when the real load finishes
// (stage === "ready") the clock runs at READY_BOOST so it wraps up fast.
const READY_BOOST = 10;
const TICK_MS = 40;

const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");

// ─── Component ─────────────────────────────────────────────────

export default function LoadingScreen({
  stage,
  error,
  accentColor,
  stats,
  onRetry,
  onFadeComplete,
}: LoadingScreenProps) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [showCursor, setShowCursor] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [fading, setFading] = useState(false);

  const lineIdRef = useRef(0);
  const stageRef = useRef(stage);
  const statsRef = useRef(stats);
  const fadeCalledRef = useRef(false);
  const [restartKey, setRestartKey] = useState(0);

  const isError = stage === "error";
  const color = accentColor;

  useEffect(() => {
    stageRef.current = stage;
    statsRef.current = stats;
  }, [stage, stats]);

  // ── Line helpers ──────────────────────────────────────────────

  const addLine = useCallback((cls: TermLine["cls"], text: string, extra?: Partial<TermLine>) => {
    const id = ++lineIdRef.current;
    setLines((prev) => [...prev, { id, cls, text, ...extra }]);
    return id;
  }, []);

  const updateLine = useCallback((id: number, patch: Partial<TermLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  // ── Script engine ─────────────────────────────────────────────

  useEffect(() => {
    let aborted = false;
    const alive = () => !aborted && stageRef.current !== "error";

    let credit = 0;
    const vsleep = async (virtualMs: number) => {
      if (credit >= virtualMs) {
        credit -= virtualMs;
        return;
      }
      let remaining = virtualMs - credit;
      credit = 0;
      while (remaining > 0) {
        if (!alive()) throw new Error("aborted");
        await new Promise((r) => setTimeout(r, TICK_MS));
        const speed = stageRef.current === "ready" ? READY_BOOST : 1;
        remaining -= TICK_MS * speed;
      }
      credit = -remaining;
    };

    const typeCmd = async (text: string) => {
      const id = addLine("cmd", "", { typing: true });
      let typed = "";
      for (const ch of text) {
        typed += ch;
        updateLine(id, { text: typed });
        await vsleep(12 + Math.random() * 14);
      }
      updateLine(id, { typing: false });
    };

    const progressLine = async (
      cls: TermLine["cls"],
      render: (p: number) => string,
      virtualMs: number,
    ) => {
      const id = addLine(cls, render(0));
      let consumed = 0;
      while (consumed < virtualMs) {
        await vsleep(60);
        consumed += 60;
        if (Math.random() < 0.15) continue;
        updateLine(id, { text: render(Math.min(1, consumed / virtualMs)) });
      }
      updateLine(id, { text: render(1) });
    };

    const task = async (label: string, virtualMs: number) => {
      const id = addLine("step", label);
      await vsleep(virtualMs);
      updateLine(id, { done: true });
    };

    async function run() {
      setLines([]);
      setShowCursor(false);
      setFlashing(false);
      setFading(false);
      fadeCalledRef.current = false;

      const devs = () => statsRef.current?.total_developers || FALLBACK_DEVS;
      const contribs = () => statsRef.current?.total_contributions || FALLBACK_CONTRIBS;

      // ── Phase 1: git clone ──
      await typeCmd("git clone git@leetcode.city:world/the-leetcode-city.git");
      await vsleep(150);
      addLine("out", "Cloning into 'the-leetcode-city'...");
      await vsleep(200);

      // ── Phase 2: Enumerating ──
      addLine("remote", `remote: Enumerating coders: ${fmt(devs())}, done.`);
      await vsleep(180);
      await progressLine(
        "remote",
        (p) =>
          `remote: Counting submissions: ${Math.floor(p * 100)}% (${fmt(p * contribs())}/${fmt(contribs())})${p >= 1 ? ", done." : ""}`,
        300,
      );

      // Easter egg (60% chance)
      if (Math.random() < 0.6) {
        await vsleep(120);
        addLine("remote", EASTER_EGGS[Math.floor(Math.random() * EASTER_EGGS.length)]);
      }
      await vsleep(150);

      // ── Phase 3: Receiving objects ──
      const sizeKiB = 1860;
      await progressLine(
        "out",
        (p) => {
          const kib = p * sizeKiB;
          const size = kib >= 1024 ? `${(kib / 1024).toFixed(2)} MiB` : `${Math.floor(kib)} KiB`;
          const tail = p >= 1 ? "done." : `${(1.4 + Math.random() * 1.2).toFixed(2)} MiB/s`;
          return `Receiving objects: ${Math.floor(p * 100)}% (${fmt(p * devs())}/${fmt(devs())}), ${size} | ${tail}`;
        },
        800,
      );

      // ── Phase 4: Resolving ──
      const districts = 10;
      await progressLine(
        "out",
        (p) =>
          `Resolving districts: ${Math.floor(p * 100)}% (${Math.floor(p * districts)}/${districts})${p >= 1 ? ", done." : ""}`,
        350,
      );

      addLine("out", "Checking out the skyline... done.");
      await vsleep(180);
      addLine("blank", "");

      // ── Phase 5: Build commands ──
      await typeCmd("cd the-leetcode-city && npm run city");
      await vsleep(150);

      await task("compiling shaders", 200);
      await task("generating city blocks", 180);
      await task(`indexing ${fmt(contribs())} submissions`, 200);
      await task(`turning on ${fmt(devs())} lights`, 250);

      addLine("blank", "");
      addLine("welcome", `Welcome to LEETCODE CITY — population ${fmt(devs())}`);
      setShowCursor(true);

      // Script finished before the real load? Keep-alive lines
      let waited = 0;
      let keepaliveIdx = 0;
      while (stageRef.current !== "ready") {
        if (!alive()) throw new Error("aborted");
        await new Promise((r) => setTimeout(r, TICK_MS));
        waited += TICK_MS;
        if (waited >= 4000 && keepaliveIdx < KEEPALIVE.length) {
          addLine("remote", KEEPALIVE[keepaliveIdx++]);
          waited = 0;
        }
      }
      await vsleep(500 * READY_BOOST);

      // Exit: flash then fade out
      if (!alive()) throw new Error("aborted");
      setShowCursor(false);
      setFlashing(true);
      await new Promise((r) => setTimeout(r, 120));
      if (!alive()) throw new Error("aborted");
      setFading(true);
    }

    run().catch(() => { /* aborted: unmount, error stage, or retry */ });

    return () => {
      aborted = true;
    };
  }, [restartKey, addLine, updateLine]);

  const handleRetry = useCallback(() => {
    setRestartKey((k) => k + 1);
    onRetry();
  }, [onRetry]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (fading && !fadeCalledRef.current && e.target === e.currentTarget && e.propertyName === "opacity") {
      fadeCalledRef.current = true;
      onFadeComplete();
    }
  }, [fading, onFadeComplete]);

  // Safety fallback
  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => {
      if (!fadeCalledRef.current) {
        fadeCalledRef.current = true;
        onFadeComplete();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [fading, onFadeComplete]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#070709] transition-opacity duration-[400ms] ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd as unknown as React.TransitionEventHandler<HTMLDivElement>}
    >
      <style>{`
        @keyframes gc-cursor { 50% { opacity: 0; } }
        @keyframes gc-flicker { 0%, 97%, 99%, 100% { opacity: 1; } 98% { opacity: 0.92; } }
        @keyframes gc-flash { 0% { opacity: 0; } 15% { opacity: 0.9; } 100% { opacity: 0; } }
      `}</style>

      <div className="flex h-full items-center justify-center p-6">
        <div
          className="w-full max-w-2xl overflow-hidden font-pixel text-[11px] leading-[1.9] tracking-wide sm:text-xs"
          style={{
            fontVariantNumeric: "tabular-nums",
            textShadow: `0 0 6px ${color}40`,
            animation: "gc-flicker 4s infinite",
          }}
        >
          {lines.map((l) => (
            <div key={l.id} className="min-h-[1.9em] whitespace-pre-wrap break-all">
              {l.cls === "cmd" && (
                <>
                  <span style={{ color }}>{`$ `}</span>
                  <span className="text-neutral-300">{l.text}</span>
                  {l.typing && <Cursor color={color} />}
                </>
              )}
              {l.cls === "out" && <span className="text-neutral-300">{l.text}</span>}
              {l.cls === "remote" && <span className="text-neutral-500">{l.text}</span>}
              {l.cls === "step" && (
                <span className="text-neutral-500">
                  {"  ▸ "}{l.text}...{l.done && <span style={{ color }}> done</span>}
                </span>
              )}
              {l.cls === "welcome" && <span style={{ color }}>{l.text}</span>}
              {l.cls === "error" && <span className="text-[#e05252]">{l.text}</span>}
            </div>
          ))}

          {showCursor && !isError && (
            <div className="min-h-[1.9em]">
              <span style={{ color }}>{`$ `}</span>
              <Cursor color={color} />
            </div>
          )}

          {isError && (
            <>
              <div className="min-h-[1.9em]" />
              <div className="min-h-[1.9em] text-[#e05252]">
                {`fatal: unable to access 'leetcode.city': ${error ?? "something went wrong"}`}
              </div>
              <div className="min-h-[1.9em] text-[#e05252]">
                hint: check your connection and try again
              </div>
              <button
                onClick={handleRetry}
                className="mt-4 px-6 py-2 font-pixel text-xs text-[#070709]"
                style={{ backgroundColor: color }}
              >
                RETRY
              </button>
            </>
          )}
        </div>
      </div>

      {/* CRT scanlines */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
        }}
      />
      {/* CRT vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Exit flash */}
      {flashing && (
        <div
          className="pointer-events-none absolute inset-0 bg-white"
          style={{ animation: "gc-flash 500ms ease-out forwards" }}
        />
      )}
    </div>
  );
}

function Cursor({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-[1.1em] w-2 align-text-bottom"
      style={{ backgroundColor: color, animation: "gc-cursor 1s steps(1) infinite" }}
    />
  );
}

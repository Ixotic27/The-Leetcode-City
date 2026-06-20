"use client";

import { useState, useEffect } from "react";

const ACCENT = "#ffa116";

interface EArcadeCardProps {
  onClose: () => void;
  onEnter: () => void;
  session: unknown;
  onSignIn?: () => void;
}

export default function EArcadeCard({ onClose, onEnter, session, onSignIn }: EArcadeCardProps) {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  // Fetch live player count from Supabase
  useEffect(() => {
    fetch("/api/arcade/rooms/counts")
      .then((r) => r.json())
      .then((d: { totalOnline?: number }) => setOnlineCount(d.totalOnline ?? 0))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Nav hints */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden text-right text-[9px] leading-loose text-muted sm:block">
        <div><span style={{ color: ACCENT }}>ESC</span> close</div>
      </div>

      {/* Card */}
      <div className="pointer-events-auto fixed z-40
        bottom-0 left-0 right-0
        sm:bottom-auto sm:left-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2"
      >
        <div className="relative border-t-[3px] border-border bg-bg-raised/95 backdrop-blur-sm
          w-full max-h-[50vh] overflow-y-auto sm:w-[320px] sm:border-[3px] sm:max-h-[85vh]
          animate-[slide-up_0.2s_ease-out] sm:animate-none"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-[10px] text-muted transition-colors hover:text-cream z-10"
          >
            ESC
          </button>

          {/* Drag handle */}
          <div className="flex justify-center py-2 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="px-4 pb-3 sm:pt-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center border-2"
                style={{ borderColor: ACCENT, backgroundColor: ACCENT + "11" }}
              >
                <span className="text-lg" style={{ color: ACCENT }}>E.</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: ACCENT }}>
                  E.Arcade
                </p>
                <p className="text-[10px] text-muted">The heart of LeetCode City</p>
              </div>
            </div>
            {/* Live stats */}
            <div className="mt-2 flex items-center gap-3 text-[9px] text-dim">
              {onlineCount !== null && onlineCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                  <span>{onlineCount} online</span>
                </div>
              )}
            </div>
          </div>

          <div className="mx-4 h-px bg-border" />

          {/* ── HUB VIEW ── */}
          <div className="px-4 py-3 space-y-2">
            {/* Lobby section */}
            <div
              className="border-2 border-border p-3 space-y-2 transition-colors hover:border-border-light cursor-pointer"
              onClick={() => {
                if (!session) { onSignIn?.(); return; }
                onEnter();
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: ACCENT }}>{">"}_</span>
                <span className="text-[11px] text-cream font-bold">Lobby</span>
              </div>
              <p className="text-[9px] text-muted leading-relaxed">
                Chat with devs, sit at a terminal, discover secrets.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                  <span className="text-[9px] text-muted">
                    {onlineCount !== null && onlineCount > 0 ? `${onlineCount} playing` : "Online now"}
                  </span>
                </div>
                <span className="text-[9px] font-bold" style={{ color: ACCENT }}>
                  {session ? "Enter" : "Sign in to enter"}
                </span>
              </div>
            </div>

            {/* Overworld section */}
            <div
              className="border-2 border-border p-3 space-y-2 transition-colors hover:border-border-light cursor-pointer"
              onClick={() => {
                if (!session) { onSignIn?.(); return; }
                window.location.href = "/arcade/ixotopia";
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: ACCENT }}>🗺</span>
                <span className="text-[11px] text-cream font-bold">Overworld</span>
              </div>
              <p className="text-[9px] text-muted leading-relaxed">
                Explore the city, visit buildings, battle in the arena.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted">Travel between rooms</span>
                <span className="text-[9px] font-bold" style={{ color: ACCENT }}>
                  {session ? "Explore" : "Sign in to explore"}
                </span>
              </div>
            </div>

            {/* Browse Rooms */}
            <div
              className="border-2 border-border p-3 space-y-2 transition-colors hover:border-border-light cursor-pointer"
              onClick={() => {
                window.location.href = "/arcade";
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: ACCENT }}>📋</span>
                <span className="text-[11px] text-cream font-bold">Browse Rooms</span>
              </div>
              <p className="text-[9px] text-muted leading-relaxed">
                View all available rooms, search, filter, and join.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted">Room directory</span>
                <span className="text-[9px] font-bold" style={{ color: ACCENT }}>
                  View
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

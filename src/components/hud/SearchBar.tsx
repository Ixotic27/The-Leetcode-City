/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import Skeleton from "@/components/Skeleton";
import { useCity } from "@/context/CityContext";
import { generateCityLayout } from "@/lib/github";
import { setCityCache } from "@/lib/cityCache";

const PERMANENT_ERROR_CODES = new Set(["not-found", "org", "no-activity"]);

const LOADING_PHASES = [
  { delay: 0, text: "Fetching LeetCode profile..." },
  { delay: 2000, text: "Analyzing submissions..." },
  { delay: 5000, text: "Building the city block..." },
  { delay: 9000, text: "Almost there..." },
  { delay: 13000, text: "This one's a big profile. Hang tight..." },
];

const ERROR_MESSAGES: Record<
  string,
  {
    primary: (u: string) => string;
    secondary: string;
    hasRetry?: boolean;
    hasLink?: boolean;
  }
> = {
  "not-found": {
    primary: (u) => `"@${u}" doesn't exist on LeetCode`,
    secondary:
      "Check the spelling — could be a typo. LeetCode usernames are case-insensitive.",
  },
  org: {
    primary: (u) => `"@${u}" is an organization, not a person`,
    secondary:
      "LeetCode City is for individual profiles. Try searching for one of its contributors by their personal username.",
  },
  "no-activity": {
    primary: (u) => `"@${u}" has no public activity yet`,
    secondary:
      "Is this you? Open your profile settings, scroll to 'Contributions & activity', and enable 'Include private contributions'. Then search again.",
    hasLink: true,
  },
  "rate-limit": {
    primary: () => "Search limit reached",
    secondary:
      "You can look up 10 new profiles per hour. Developers already in the city are unlimited.",
  },
  "github-rate-limit": {
    primary: () => "LeetCode's API is temporarily unavailable",
    secondary: "Too many requests to LeetCode. Try again in a few minutes.",
  },
  network: {
    primary: () => "Couldn't reach the server",
    secondary: "Check your internet connection and try again.",
    hasRetry: true,
  },
  generic: {
    primary: () => "Something went wrong",
    secondary: "An unexpected error occurred. Try again.",
    hasRetry: true,
  },
};

export function SearchFeedback({
  feedback,
  accentColor,
  onDismiss,
  onRetry,
}: {
  feedback: {
    type: "loading" | "error";
    code?: string;
    username?: string;
    raw?: string;
  } | null;
  accentColor: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Phased loading messages
  useEffect(() => {
    if (feedback?.type !== "loading") {
      setPhaseIndex(0);
      return;
    }
    const timers = LOADING_PHASES.map((phase, i) =>
      setTimeout(() => setPhaseIndex(i), phase.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [feedback?.type]);

  // Auto-dismiss errors after 8s (except persistent ones)
  useEffect(() => {
    if (feedback?.type !== "error") return;
    const code = feedback.code ?? "generic";
    if (code === "no-activity" || code === "network" || code === "generic")
      return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  // Loading state
  if (feedback.type === "loading") {
    return (
      <div
        className="relative w-full max-w-md border-[3px] bg-bg-raised/90 px-5 py-5 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
        style={{ borderColor: accentColor + "66" }}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {/* Skeleton layout (Avatar, Name, Stats) */}
        <div className="flex items-center gap-4 mb-5">
          <Skeleton
            variant="circle"
            width={52}
            height={52}
            className="border-[2px] border-border/50"
          />
          <div className="flex-1 space-y-2.5">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
        </div>

        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Skeleton variant="rectangular" className="w-full" height={45} />
          <Skeleton variant="rectangular" className="w-full" height={45} />
          <Skeleton variant="rectangular" className="w-full" height={45} />
        </div>

        {/* Phased loading text */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/30">
          <span
            className="blink-dot h-2 w-2 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[11px] text-muted normal-case">
            {LOADING_PHASES[phaseIndex].text}
          </span>
        </div>
      </div>
    );
  }

  // Error state
  const code = feedback.code ?? "generic";
  const msg = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.generic;
  const u = feedback.username ?? "";

  return (
    <div
      className="relative w-full max-w-md border-[3px] bg-bg-raised/90 px-4 py-3 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
      style={{
        borderColor:
          code === "rate-limit" ? accentColor + "66" : "rgba(248, 81, 73, 0.4)",
      }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-[10px] text-muted transition-colors hover:text-cream"
      >
        &#10005;
      </button>
      <p className="text-[11px] text-cream normal-case pr-4">
        {msg.primary(u)}
      </p>
      <p className="mt-1 text-[10px] text-muted normal-case">{msg.secondary}</p>
      {msg.hasLink && (
        <a
          href="https://leetcode.com/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[10px] normal-case transition-colors hover:text-cream"
          style={{ color: accentColor }}
        >
          Open Profile Settings &rarr;
        </a>
      )}
      {msg.hasRetry && (
        <button
          onClick={onRetry}
          className="btn-press mt-2 border-[2px] border-border px-3 py-1 text-[10px] text-cream transition-colors hover:border-border-light"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function SearchBar() {
  const {
    username,
    setUsername,
    feedback,
    setFeedback,
    loading,
    theme,
    reloadCity,
    compareBuilding,
    comparePair,
    focusedBuilding,
    setFocusedBuilding,
    setSelectedBuilding,
    setShareData,
    setCopied,
    setCompareSelfHint,
    setComparePair,
    buildings,
    failedUsernamesRef,
    rawDevsRef,
    setBuildings,
    setPlazas,
    setDecorations,
    setDistrictZones,
    stats,
    authLogin,
    ghostPreviewShownRef,
    setGhostPreviewLogin,
    setExploreMode,
    exploreMode,
  } = useCity();

  const [results, setResults] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setOpen(true);
          setActiveIdx(-1);
        }
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const selected = results[activeIdx].github_login;
      setUsername(selected);
      setOpen(false);
      searchUser(selected);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const searchUser = async (overrideUsername?: string) => {
    const target = overrideUsername ?? username;
    const trimmed = target.trim().toLowerCase();
    if (!trimmed) return;

    // Track search event dynamically
    try {
      const { trackSearchUsed } = await import("@/lib/himetrica");
      trackSearchUsed(trimmed);
    } catch {}

    const cached = failedUsernamesRef.current.get(trimmed);
    if (cached && Date.now() - cached.timestamp < 60_000) {
      setFeedback({
        type: "error",
        code: cached.code as any,
        username: trimmed,
      });
      return;
    }
    if (cached) failedUsernamesRef.current.delete(trimmed);

    const wasComparing = compareBuilding;

    setFeedback({ type: "loading" });
    setFocusedBuilding(null);
    setSelectedBuilding(null);
    setShareData(null);

    try {
      if (wasComparing && trimmed === wasComparing.login.toLowerCase()) {
        setCompareSelfHint(true);
        setTimeout(() => setCompareSelfHint(false), 2000);
        setFeedback(null);
        return;
      }

      const existedBefore = buildings.some(
        (b) => b.login.toLowerCase() === trimmed
      );

      const devRes = await fetch(
        `/api/dev/${encodeURIComponent(trimmed)}?t=${Date.now()}`,
        { cache: "no-store" }
      );
      const devData = await devRes.json();

      if (!devRes.ok) {
        let code: any = "generic";
        if (devRes.status === 404) code = "not-found";
        else if (devRes.status === 429) {
          code = "rate-limit";
        } else if (devRes.status === 400) {
          if (devData.error?.includes("LeetCode")) code = "not-found";
          else if (devData.error?.includes("no public activity"))
            code = "no-activity";
        }
        if (PERMANENT_ERROR_CODES.has(code)) {
          failedUsernamesRef.current.set(trimmed, { code, timestamp: Date.now() });
        }
        setFeedback({
          type: "error",
          code,
          username: trimmed,
          raw: devData.error,
        });
        return;
      }

      setFeedback(null);

      let updatedBuildings = null;
      if (!existedBefore) {
        const newDev = {
          ...devData,
          kudos_count: devData.kudos_count ?? 0,
          visit_count: devData.visit_count ?? 0,
          app_streak: devData.app_streak ?? 0,
          raid_xp: devData.raid_xp ?? 0,
          rabbit_completed: devData.rabbit_completed ?? false,
          xp_total: devData.xp_total ?? 0,
          xp_level: devData.xp_level ?? 1,
        };
        rawDevsRef.current = [...rawDevsRef.current, newDev];
        const layout = generateCityLayout(rawDevsRef.current);
        setBuildings(layout.buildings);
        setPlazas(layout.plazas);
        setDecorations(layout.decorations);
        setDistrictZones(layout.districtZones);
        setCityCache({
          ...layout,
          stats: stats ?? { total_developers: 0, total_contributions: 0 },
        });
        updatedBuildings = layout.buildings;
      } else {
        const foundIdx = rawDevsRef.current.findIndex(
          (d) => d.github_login.toLowerCase() === trimmed
        );
        if (foundIdx !== -1) {
          rawDevsRef.current[foundIdx] = {
            ...rawDevsRef.current[foundIdx],
            ...devData,
          };
          const layout = generateCityLayout(rawDevsRef.current);
          setBuildings(layout.buildings);
          updatedBuildings = layout.buildings;
        }
      }

      setFocusedBuilding(devData.github_login);

      if (authLogin && trimmed === authLogin && !ghostPreviewShownRef.current) {
        ghostPreviewShownRef.current = true;
        setGhostPreviewLogin(devData.github_login);
        setTimeout(() => setGhostPreviewLogin(null), 4000);
      }

      const searchPool = updatedBuildings ?? buildings;
      const foundBuilding = searchPool.find(
        (b) => b.login.toLowerCase() === trimmed
      );

      if (wasComparing && !comparePair && foundBuilding) {
        if (compareBuilding) {
          setComparePair([wasComparing, foundBuilding]);
          setFocusedBuilding(wasComparing.login);
        } else {
          if (foundBuilding) {
            setSelectedBuilding(foundBuilding);
            setExploreMode(true);
          }
        }
      } else if (!existedBefore) {
        setShareData({
          login: devData.github_login,
          contributions: devData.contributions,
          rank: devData.rank,
          avatar_url: devData.avatar_url,
        });
        if (foundBuilding) {
          setSelectedBuilding(foundBuilding);
          setExploreMode(true);
        }
        setCopied(false);
      } else if (foundBuilding) {
        setSelectedBuilding(foundBuilding);
        setExploreMode(true);
      }
      setUsername("");
    } catch {
      setFeedback({ type: "error", code: "network", username: trimmed });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchUser();
  };

  if (!exploreMode || compareBuilding || comparePair) return null;

  return (
    <div ref={containerRef} className="pointer-events-auto absolute top-3 left-32 right-3 z-[31] sm:left-36 sm:right-auto sm:top-4 sm:w-72">
      <form id="search-bar-form" onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (feedback?.type === "error") setFeedback(null);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search a LeetCode username and fly to their building"
          placeholder="search a username"
          className="min-w-0 flex-1 border-[3px] border-border bg-bg/70 px-3 py-1.5 text-base text-cream outline-none backdrop-blur-sm transition-colors placeholder:text-dim normal-case sm:text-[11px]"
          onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="btn-press flex-shrink-0 border-[3px] border-transparent px-3 py-1.5 text-[11px] text-bg disabled:opacity-40"
          style={{ backgroundColor: theme.accent }}
        >
          {loading ? <span className="blink-dot inline-block">_</span> : "Go"}
        </button>
      </form>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto border-[3px] border-border bg-bg/95 backdrop-blur-md shadow-lg z-[32]">
          {results.map((dev, idx) => {
            const totalSolved = (dev.easy_solved ?? 0) + (dev.medium_solved ?? 0) + (dev.hard_solved ?? 0);
            return (
              <div
                key={dev.github_login}
                onClick={() => {
                  setUsername(dev.github_login);
                  setOpen(false);
                  searchUser(dev.github_login);
                }}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors font-pixel uppercase ${
                  idx === activeIdx
                    ? "bg-white/10 text-white"
                    : "text-cream/90 hover:bg-white/5 hover:text-white"
                }`}
                style={{
                  borderLeft: idx === activeIdx ? `3px solid ${theme.accent}` : "3px solid transparent",
                }}
              >
                <span>{dev.github_login}</span>
                <span className="text-[10px] text-muted normal-case">{totalSolved} solved</span>
              </div>
            );
          })}
        </div>
      )}
      {feedback && (
        <div className="mt-1.5">
          <SearchFeedback
            feedback={feedback}
            accentColor={theme.accent}
            onDismiss={() => setFeedback(null)}
            onRetry={searchUser}
          />
        </div>
      )}
    </div>
  );
}

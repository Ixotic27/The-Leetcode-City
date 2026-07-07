"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCity } from "@/context/CityContext";
import { SearchFeedback } from "./SearchBar";
import SearchBar from "@/components/SearchBar";
import { CityBuilding } from "@/lib/github";

const DEV_CLASSES = [
  "Vibe Coder",
  "Stack Overflow Tourist",
  "Console.log Debugger",
  "Ctrl+C Ctrl+V Engineer",
  "Senior Googler",
  "Git Push --force Enjoyer",
  "Dark Mode Purist",
  "Rubber Duck Whisperer",
  "Merge Conflict Magnet",
  "README Skipper",
  "npm install Addict",
  "Localhost Champion",
  "Monday Deployer",
  "Production Debugger",
  "Legacy Code Archaeologist",
  "Off-By-One Specialist",
  "Commit Message Poet",
  "Tab Supremacist",
  "Docker Compose Therapist",
  "10x Dev (Self-Proclaimed)",
  "AI Prompt Jockey",
  "Semicolon Forgetter",
  "CSS Trial-and-Error Main",
  "Works On My Machine Dev",
  "TODO: Fix Later Dev",
  "Infinite Loop Survivor",
  "PR Approved (Didn't Read)",
  "LGTM Speed Runner",
  "404 Brain Not Found",
  "Sudo Make Me A Sandwich",
];

function getDevClass(login: string) {
  let h = 0;
  for (let i = 0; i < login.length; i++)
    h = ((h << 5) - h + login.charCodeAt(i)) | 0;
  return DEV_CLASSES[
    ((h % DEV_CLASSES.length) + DEV_CLASSES.length) % DEV_CLASSES.length
  ];
}

export default function ComparisonPanel() {
  const {
    compareBuilding,
    comparePair,
    flyMode,
    theme,
    setSelectedBuilding,
    setFocusedBuilding,
    setCompareBuilding,
    setExploreMode,
    username,
    setUsername,
    feedback,
    setFeedback,
    loading,
    reloadCity,
    compareSelfHint,
    compareCopied,
    setCompareCopied,
    compareLang,
    setCompareLang,
    setComparePair,
  } = useCity();

  const touchYRef = useRef<number | null>(null);

  // Search function specifically for picking second developer to compare
  const searchUser = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;
    setFeedback({ type: "loading" });
    try {
      if (compareBuilding && trimmed === compareBuilding.login.toLowerCase()) {
        // Self compare hint triggers error state
        setFeedback(null);
        return;
      }
      const devRes = await fetch(
        `/api/dev/${encodeURIComponent(trimmed)}?t=${Date.now()}`,
        { cache: "no-store" }
      );
      const devData = await devRes.json();
      if (!devRes.ok) {
        setFeedback({ type: "error", code: "not-found", username: trimmed });
        return;
      }
      setFeedback(null);
      const updated = await reloadCity(true);
      if (!updated) return;
      const found = updated.find((b) => b.login.toLowerCase() === trimmed);
      if (compareBuilding && found) {
        setComparePair([compareBuilding, found]);
        setFocusedBuilding(compareBuilding.login);
      }
      setUsername("");
    } catch {
      setFeedback({ type: "error", code: "network", username: trimmed });
    }
  };

  const closeCompare = () => {
    if (comparePair) {
      setSelectedBuilding(comparePair[0]);
      setFocusedBuilding(comparePair[0].login);
      setComparePair(null);
      setCompareBuilding(null);
    }
  };

  // ─── Case 1: Picking second developer ───
  if (compareBuilding && !comparePair && !flyMode) {
    return (
      <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm sm:top-4 sm:w-auto">
        <div className="border-[3px] border-border bg-bg-raised/95 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="blink-dot h-2 w-2 flex-shrink-0"
              style={{ backgroundColor: theme.accent }}
            />
            <span className="text-[10px] text-cream normal-case truncate min-w-0">
              Comparing{" "}
              <span style={{ color: theme.accent }}>
                @{compareBuilding.login}
              </span>
            </span>
            <button
              onClick={() => {
                setSelectedBuilding(compareBuilding);
                setFocusedBuilding(compareBuilding.login);
                setCompareBuilding(null);
              }}
              className="ml-1 flex-shrink-0 text-[9px] text-muted transition-colors hover:text-cream"
            >
              Cancel
            </button>
          </div>
          {compareSelfHint && (
            <p className="mt-1 text-[9px] normal-case" style={{ color: "#f85149" }}>
              Pick a different building to compare
            </p>
          )}
          <SearchBar
            username={username}
            setUsername={setUsername}
            feedback={feedback}
            setFeedback={setFeedback}
            loading={loading}
            theme={theme}
            searchUser={searchUser}
          />
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
      </div>
    );
  }

  // ─── Case 2: Comparison stats panel is active ───
  if (comparePair && !flyMode) {
    const compareStatDefs: {
      label: string;
      key: keyof CityBuilding;
      invert?: boolean;
    }[] = [
      { label: "City Rank", key: "rank", invert: true },
      { label: "Solved", key: "contributions" },
      { label: "Reputation", key: "total_stars" },
      { label: "LC Rank", key: "public_repos", invert: true },
      { label: "Kudos", key: "kudos_count" },
    ];
    let totalAWins = 0;
    let totalBWins = 0;
    const cmpRows = compareStatDefs.map((s) => {
      const a = (comparePair[0][s.key] as number) ?? 0;
      const b = (comparePair[1][s.key] as number) ?? 0;
      let aW = false,
        bW = false;
      if (s.invert) {
        aW = a > 0 && (a < b || b === 0);
        bW = b > 0 && (b < a || a === 0);
      } else {
        aW = a > b;
        bW = b > a;
      }
      if (aW) totalAWins++;
      if (bW) totalBWins++;
      return { ...s, a, b, aW, bW };
    });
    const cmpTie = totalAWins === totalBWins;
    const cmpWinner = totalAWins > totalBWins ? comparePair[0].login : comparePair[1].login;
    const cmpSummary = cmpTie
      ? `Tie ${totalAWins}-${totalBWins}`
      : `@${cmpWinner} wins ${Math.max(totalAWins, totalBWins)}-${Math.min(totalAWins, totalBWins)}`;

    return (
      <div
        className="pointer-events-auto fixed z-40
      bottom-0 left-0 right-0
      sm:bottom-auto sm:left-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2"
      >
        <div
          className="relative border-t-[3px] border-border bg-bg-raised/95 backdrop-blur-sm
        w-full sm:w-[380px] sm:border-[3px] sm:max-h-[85vh] sm:overflow-y-auto
        max-h-[45vh] overflow-y-auto
        animate-[slide-up_0.2s_ease-out] sm:animate-none"
        >
          {/* Drag handle on mobile - swipe down to close */}
          <div
            className="flex justify-center py-2 sm:hidden"
            onTouchStart={(e) => {
              touchYRef.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const start = touchYRef.current;
              if (start != null && e.changedTouches[0].clientY - start > 50) closeCompare();
              touchYRef.current = null;
            }}
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* ── Header: Avatars + VS ── */}
          <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-3 md:gap-5 px-5 pt-3 pb-4 md:pt-4">
            <Link
              href={`/dev/${comparePair[0].login}`}
              className="flex flex-col items-center gap-1.5 group w-full md:w-[110px]"
            >
              {comparePair[0].avatar_url && (
                <Image
                  src={comparePair[0].avatar_url}
                  alt={comparePair[0].login}
                  width={56}
                  height={56}
                  className="border-[3px] transition-colors group-hover:brightness-110"
                  style={{
                    imageRendering: "pixelated",
                    borderColor: totalAWins >= totalBWins ? theme.accent : "#3a3a40",
                  }}
                />
              )}
              <p className="truncate text-[10px] text-cream normal-case max-w-full md:max-w-[110px] transition-colors group-hover:text-white">
                @{comparePair[0].login}
              </p>
              <p className="text-[8px] text-muted normal-case text-center">
                {getDevClass(comparePair[0].login)}
              </p>
            </Link>

            <span className="text-base shrink-0 md:pt-4" style={{ color: theme.accent }}>
              VS
            </span>

            <Link
              href={`/dev/${comparePair[1].login}`}
              className="flex flex-col items-center gap-1.5 group w-full md:w-[110px]"
            >
              {comparePair[1].avatar_url && (
                <Image
                  src={comparePair[1].avatar_url}
                  alt={comparePair[1].login}
                  width={56}
                  height={56}
                  className="border-[3px] transition-colors group-hover:brightness-110"
                  style={{
                    imageRendering: "pixelated",
                    borderColor: totalBWins >= totalAWins ? theme.accent : "#3a3a40",
                  }}
                />
              )}
              <p className="truncate text-[10px] text-cream normal-case max-w-full md:max-w-[110px] transition-colors group-hover:text-white">
                @{comparePair[1].login}
              </p>
              <p className="text-[8px] text-muted normal-case text-center">
                {getDevClass(comparePair[1].login)}
              </p>
            </Link>
          </div>

          {/* ── Scoreboard ── */}
          <div className="mx-4 border-[2px] border-border bg-bg-card">
            {cmpRows.map((s, i) => (
              <div
                key={s.key}
                className={`grid grid-cols-[1fr_auto_1fr] items-center py-2 px-3 ${i < cmpRows.length - 1 ? "border-b border-border/40" : ""}`}
              >
                <span
                  className="min-w-0 truncate text-right text-[10px] md:text-[11px] tabular-nums"
                  style={{
                    color: s.aW ? theme.accent : s.bW ? "#555" : "#888",
                  }}
                >
                  {s.key === "rank" ? (s.a > 0 ? `#${s.a}` : "-") : s.a.toLocaleString()}
                </span>
                <span className="text-center text-[7px] md:text-[8px] text-muted uppercase tracking-wider mx-2">
                  {s.label}
                </span>
                <span
                  className="min-w-0 truncate text-left text-[10px] md:text-[11px] tabular-nums"
                  style={{
                    color: s.bW ? theme.accent : s.aW ? "#555" : "#888",
                  }}
                >
                  {s.key === "rank" ? (s.b > 0 ? `#${s.b}` : "-") : s.b.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* ── Winner banner ── */}
          <div
            className="mx-4 mt-3 py-2.5 text-center text-[11px] uppercase tracking-wide"
            style={{
              backgroundColor: `${theme.accent}15`,
              border: `2px solid ${theme.accent}40`,
              color: theme.accent,
            }}
          >
            {cmpSummary}
          </div>

          {/* ── Actions ── */}
          <div className="px-4 pt-3 pb-1 flex flex-col md:flex-row gap-2">
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                `I just compared my building with ${comparePair[1].login}'s in LeetCode City. It wasn't even close. What's yours?`
              )}&url=${encodeURIComponent(
                `${typeof window !== "undefined" ? window.location.origin : ""}/compare/${comparePair[0].login}/${comparePair[1].login}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press flex-1 py-2 text-center text-[10px] text-bg"
              style={{
                backgroundColor: theme.accent,
                boxShadow: `2px 2px 0 0 ${theme.shadow}`,
              }}
            >
              Share on X
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/compare/${comparePair[0].login}/${comparePair[1].login}`
                );
                setCompareCopied(true);
                setTimeout(() => setCompareCopied(false), 2000);
              }}
              className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
            >
              {compareCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          {/* Download compare cards */}
          <div className="px-4 flex flex-col md:flex-row items-stretch md:items-center gap-2 pb-1">
            <div className="flex justify-center md:justify-start gap-0.5 shrink-0">
              {(["en", "pt"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setCompareLang(l)}
                  className="px-2 py-0.5 text-[9px] uppercase transition-colors"
                  style={{
                    color: compareLang === l ? theme.accent : "#666",
                    borderBottom: compareLang === l ? `2px solid ${theme.accent}` : "2px solid transparent",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/compare-card/${comparePair[0].login}/${comparePair[1].login}?format=landscape&lang=${compareLang}`
                );
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `leetcodecity-${comparePair[0].login}-vs-${comparePair[1].login}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              className="btn-press flex-1 border-[2px] border-border py-1.5 text-center text-[9px] text-cream transition-colors hover:border-border-light"
            >
              Card
            </button>
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/compare-card/${comparePair[0].login}/${comparePair[1].login}?format=stories&lang=${compareLang}`
                );
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `leetcodecity-${comparePair[0].login}-vs-${comparePair[1].login}-stories.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              className="btn-press flex-1 border-[2px] border-border py-1.5 text-center text-[9px] text-cream transition-colors hover:border-border-light"
            >
              Stories
            </button>
          </div>

          {/* Compare Again + Close */}
          <div className="flex gap-2 px-4 pt-1 pb-5 md:pb-4">
            <button
              onClick={() => {
                const first = comparePair[0];
                setComparePair(null);
                setCompareBuilding(first);
                setFocusedBuilding(first.login);
              }}
              className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
            >
              Compare Again
            </button>
            <button
              onClick={closeCompare}
              className="btn-press flex-1 border-[2px] border-border py-2 text-center text-[10px] text-cream transition-colors hover:border-border-light"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

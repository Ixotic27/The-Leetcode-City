/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import Link from "next/navigation";
import { useCity } from "@/context/CityContext";

export default function AuthManager() {
  const {
    session,
    handleSignIn,
    handleSignOut,
    needsToLink,
    setShowLinkModal,
    linkedLeetCodeUsername,
    streakData,
    theme,
    myBuilding,
    effectiveLiveStatus,
    effectiveLiveCount,
    analyticsOpen,
    setAnalyticsOpen,
    codingPanelOpen,
    setCodingPanelOpen,
    codingCount,
    liveByLogin,
    selfLogin,
    vsCodeKey,
    setVsCodeKey,
    hasVsCodeKey,
    setHasVsCodeKey,
    vsCodeKeyLoading,
    setVsCodeKeyLoading,
    vsCodeKeyCopied,
    setVsCodeKeyCopied,
    mountedRef,
    generateControllerRef,
    buildings,
    setSelectedBuilding,
    setFocusedBuilding,
    showLinkModal,
    linkInput,
    setLinkInput,
    confirmedUsername,
    setConfirmedUsername,
    linking,
    linkError,
    expectedToken,
    resetting,
    resetMsg,
    handleVerifyLeetCode,
    handleResetClaim,
    setResetMsg,
    flyMode,
    introMode,
    rabbitCinematic,
    exploreMode,
  } = useCity();

  if (flyMode || introMode || rabbitCinematic) return null;

  return (
    <>
      {/* Top-Right Badges: stars, discord, presence, analytics, coding */}
      <div
        className={`pointer-events-auto fixed top-3 left-3 z-30 items-center gap-1.5 sm:gap-2 sm:left-auto sm:right-4 sm:top-4 ${exploreMode ? "hidden lg:flex" : "flex"}`}
      >
        {/* Discord / Live / Analytics counts */}
        <button
          onClick={() => setAnalyticsOpen((v) => !v)}
          className="hidden sm:flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
          style={{ color: analyticsOpen ? "#ffa116" : "#8c8c9c" }}
        >
          [ANALYTICS]
        </button>

        {/* Coding Activity Dropdown */}
        {(() => {
          const energyLabel =
            codingCount === 0
              ? "City sleeping"
              : codingCount <= 2
                ? "City waking up"
                : codingCount <= 9
                  ? "City alive"
                  : "City buzzing";
          const energyDotColor =
            codingCount === 0
              ? "bg-muted/50"
              : codingCount <= 2
                ? "bg-[#fbbf24]"
                : "bg-[#4ade80]";
          const energyDotAnim = codingCount === 0 ? "" : "live-dot";

          return (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setCodingPanelOpen((v) => !v)}
                className="flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
              >
                <span
                  className={`${energyDotAnim} h-1.5 w-1.5 flex-shrink-0 rounded-full ${energyDotColor}`}
                  aria-hidden="true"
                />
                {codingCount > 0 ? (
                  <>
                    <span className="text-cream">{codingCount}</span>
                    <span className="text-muted">coding now</span>
                  </>
                ) : (
                  <span className="text-muted">{energyLabel}</span>
                )}
              </button>

              {codingPanelOpen &&
                (() => {
                  const allDevs = Array.from(liveByLogin.values());
                  const creator = allDevs.find(
                    (d: any) => d.githubLogin.toLowerCase() === "ixotic27"
                  );
                  const others = allDevs.filter(
                    (d: any) => d.githubLogin.toLowerCase() !== "ixotic27"
                  );
                  const displayDevs = [
                    ...(creator ? [creator] : []),
                    ...others.slice(0, creator ? 4 : 5),
                  ];
                  const remaining = allDevs.length - displayDevs.length;

                  return (
                    <div className="absolute right-0 top-full mt-1 w-80 border-[3px] border-border bg-bg/95 backdrop-blur-sm">
                      <div className="border-b border-border px-5 py-3 text-xs text-muted">
                        Coding right now
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {displayDevs.map((dev: any) => {
                          const isCreator = dev.githubLogin.toLowerCase() === "ixotic27";
                          return (
                            <button
                              key={dev.githubLogin}
                              onClick={() => {
                                const b = buildings.find(
                                  (b) => b.login.toLowerCase() === dev.githubLogin.toLowerCase()
                                );
                                if (b) {
                                  setSelectedBuilding(null);
                                  setFocusedBuilding(b.login);
                                  setCodingPanelOpen(false);
                                }
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                            >
                              <div className="relative flex-shrink-0">
                                {dev.avatarUrl && (
                                  <img
                                    src={dev.avatarUrl}
                                    alt=""
                                    className="h-6 w-6 rounded-full"
                                    style={isCreator ? { boxShadow: "0 0 6px #fbbf24" } : undefined}
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`truncate text-[11px] ${isCreator ? "text-[#fbbf24]" : "text-cream"}`}>
                                    {dev.githubLogin}
                                  </span>
                                  {isCreator && (
                                    <span className="shrink-0 text-[8px] text-[#fbbf24]/70">
                                      CREATOR
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-[10px] normal-case text-muted">
                                  {isCreator ? "building the city" : dev.language || ""}
                                </div>
                              </div>
                              <span
                                className={`live-dot h-2 w-2 flex-shrink-0 rounded-full ${isCreator ? "bg-[#fbbf24]" : "bg-[#4ade80]"}`}
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>

                      {remaining > 0 && (
                        <div className="border-t border-border">
                          <a
                            href="/live"
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = "/live";
                            }}
                            className="block px-4 py-2.5 text-center text-[11px] text-muted transition-colors hover:text-cream"
                          >
                            +{remaining} more &rarr;
                          </a>
                        </div>
                      )}

                      {/* Connection setups inside dropdown */}
                      <div className="border-t border-border">
                        {!session ? (
                          <div className="px-5 py-5 text-center">
                            <p className="mb-3 text-xs normal-case text-muted">
                              Keep your city alive while you code
                            </p>
                            <button
                              onClick={() => {
                                setCodingPanelOpen(false);
                                handleSignIn();
                              }}
                              className="btn-press inline-block w-full py-2.5 text-center text-xs text-bg"
                              style={{
                                backgroundColor: "#ffa116",
                                boxShadow: "2px 2px 0 0 #5a7a00",
                              }}
                            >
                              Sign in with LeetCode
                            </button>
                          </div>
                        ) : Array.from(liveByLogin.keys()).some((k: any) => k.toLowerCase() === selfLogin) ? (
                          <div className="px-5 py-4 text-center">
                            <div className="mb-2 text-lg">⚡</div>
                            <p className="mb-1.5 text-xs font-bold normal-case text-[#4ade80]">
                              Your building is glowing!
                            </p>
                            {(() => {
                              const mySession: any = Array.from(liveByLogin.values()).find(
                                (s: any) => s.githubLogin.toLowerCase() === selfLogin
                              );
                              const othersCount = liveByLogin.size - 1;
                              return (
                                <>
                                  {mySession?.language && (
                                    <p className="mb-1 text-[10px] normal-case text-muted">
                                      Coding in <span className="text-cream">{mySession.language}</span>
                                    </p>
                                  )}
                                  <p className="text-[10px] normal-case text-muted/70">
                                    {othersCount > 0
                                      ? `${othersCount} other dev${othersCount > 1 ? "s" : ""} coding alongside you`
                                      : "You're the only one lighting the city right now 🌃"}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        ) : vsCodeKey ? (
                          <div className="px-5 py-5">
                            <p className="mb-3 text-sm font-bold text-cream">
                              Your API Key
                            </p>
                            <div className="mb-3 flex items-center gap-2">
                              <code className="flex-1 truncate bg-white/5 px-3 py-2 text-[11px] normal-case text-cream">
                                {vsCodeKey}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(vsCodeKey);
                                  setVsCodeKeyCopied(true);
                                  setTimeout(() => setVsCodeKeyCopied(false), 2000);
                                }}
                                className="btn-press shrink-0 border border-border px-3 py-2 text-[11px] text-cream transition-colors hover:border-border-light"
                              >
                                {vsCodeKeyCopied ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <div className="space-y-2.5 text-xs normal-case text-muted">
                              <p>
                                <span className="text-cream">1.</span> Install{" "}
                                <a
                                  href="https://marketplace.visualstudio.com/items?itemName=leetcode-city.leetcodecity"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#4ade80] hover:underline"
                                >
                                  LeetCode City: Pulse
                                </a>{" "}
                                in VS Code
                              </p>
                              <p>
                                <span className="text-cream">2.</span> Cmd+Shift+P &rarr; &ldquo;Pulse: Connect&rdquo;
                              </p>
                              <p>
                                <span className="text-cream">3.</span> Paste key and start coding
                              </p>
                            </div>
                          </div>
                        ) : hasVsCodeKey !== false ? (
                          <div className="px-5 py-5 text-center">
                            <div className="mb-3 text-2xl">🌙</div>
                            <p className="mb-2 text-sm normal-case text-cream font-bold">
                              Your building is sleeping
                            </p>
                            <p className="mb-4 text-[11px] normal-case leading-relaxed text-muted">
                              Open your IDE and start coding to light up your building.
                            </p>
                            <button
                              onClick={() => setHasVsCodeKey(false)}
                              className="text-[10px] normal-case text-muted/50 transition-colors hover:text-cream"
                            >
                              Setup extension again &rarr;
                            </button>
                          </div>
                        ) : (
                          <div className="px-5 py-5">
                            <p className="mb-3 text-sm normal-case text-cream font-bold">
                              Keep your city alive
                            </p>
                            <button
                              onClick={async () => {
                                setVsCodeKeyLoading(true);
                                const controller = new AbortController();
                                generateControllerRef.current = controller;
                                try {
                                  const res = await fetch("/api/vscode-key", {
                                    method: "POST",
                                    signal: controller.signal,
                                  });
                                  const data = await res.json();
                                  if (mountedRef.current && data.key) {
                                    setVsCodeKey(data.key);
                                    setHasVsCodeKey(true);
                                    try {
                                      localStorage.setItem("leetcodecity_has_vscode_key", "1");
                                    } catch {}
                                    navigator.clipboard.writeText(data.key);
                                    setVsCodeKeyCopied(true);
                                    setTimeout(() => {
                                      if (mountedRef.current) setVsCodeKeyCopied(false);
                                    }, 2000);
                                  }
                                } catch {} finally {
                                  if (mountedRef.current) setVsCodeKeyLoading(false);
                                }
                              }}
                              className="btn-press w-full py-2.5 text-center text-xs text-bg"
                              style={{
                                backgroundColor: "#4ade80",
                                boxShadow: "2px 2px 0 0 #16a34a",
                              }}
                            >
                              {vsCodeKeyLoading ? "Generating..." : "Generate API Key"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })()}
      </div>

      {/* ─── Link LeetCode Modal ─── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
          <div className="w-full max-w-sm border-[3px] border-border bg-bg p-6 relative">
            <button
              onClick={() => {
                setShowLinkModal(false);
                setResetMsg("");
              }}
              className="absolute top-3 right-4 text-muted hover:text-cream text-lg"
            >
              &#10005;
            </button>
            <h2
              className="text-xl text-cream mb-4 font-pixel"
              style={{ color: theme.accent }}
            >
              Link LeetCode
            </h2>

            {linkedLeetCodeUsername ? (
              <div className="space-y-4">
                <div className="p-3 border border-border/50 bg-bg-card text-[11px] text-cream">
                  Currently linked to:{" "}
                  <span style={{ color: theme.accent }} className="font-bold">
                    @{linkedLeetCodeUsername}
                  </span>
                </div>
                {resetMsg && (
                  <div className="p-2 border border-border/50 text-[10px] text-muted">
                    {resetMsg}
                  </div>
                )}
                <button
                  onClick={handleResetClaim}
                  disabled={resetting}
                  className="w-full btn-press py-3 text-[11px] disabled:opacity-50 border-[2px] border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  {resetting ? "Resetting..." : "Reset Claim (Unlink)"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyLeetCode}>
                <div className="mb-4">
                  <label className="block text-[10px] text-muted mb-2 font-pixel">
                    1. Enter your LeetCode Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="LeetCode Username"
                      className="flex-1 bg-black/50 border border-border px-3 py-2 text-[12px] text-cream outline-none focus:border-border-light normal-case"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (linkInput.trim()) setConfirmedUsername(linkInput.trim());
                      }}
                      className="px-3 py-2 text-[11px] border border-border hover:border-border-light text-cream"
                    >
                      Confirm
                    </button>
                  </div>
                </div>

                {confirmedUsername && (
                  <div className="mb-6 animate-[fade-in_0.2s_ease-out]">
                    <label className="block text-[10px] text-muted mb-2 font-pixel">
                      2. Verify Ownership
                    </label>
                    <p className="text-[10px] text-cream mb-3 leading-relaxed">
                      Copy the code below and paste it into your{" "}
                      <a
                        href={`https://leetcode.com/u/${confirmedUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-blue-400 hover:text-blue-300"
                      >
                        LeetCode Profile → Edit Profile → About Me
                      </a>
                      . Save, then click Verify.
                    </p>

                    <div className="flex items-center gap-2 bg-black/50 border border-border p-3 mb-2">
                      <code
                        className="text-[12px] flex-1 text-center font-bold"
                        style={{ color: theme.accent }}
                      >
                        {expectedToken}
                      </code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(expectedToken)}
                        className="text-[10px] bg-white/10 px-2 py-1 hover:bg-white/20"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {linkError && (
                  <div className="mb-4 p-2 border border-red-500/50 bg-red-500/10 text-red-400 text-[10px]">
                    {linkError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={linking || !linkInput.trim()}
                  className="w-full btn-press py-3 text-[12px] disabled:opacity-50 text-bg"
                  style={{
                    backgroundColor: theme.accent,
                    boxShadow: `3px 3px 0 0 ${theme.shadow}`,
                  }}
                >
                  {linking ? "Verifying..." : "Verify & Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

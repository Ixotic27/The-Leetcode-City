"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { createBrowserSupabase } from "@/lib/supabase";

interface Challenge {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  challenge_date: string;
  reward_points: number;
  reward_xp: number;
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty_rating: number;
    tags: string[];
    time_limit_ms: number;
    memory_limit_mb: number;
    sample_tests: Array<{ input: string; output: string }>;
  };
  status?: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  is_equipped: boolean;
  item: {
    id: string;
    name: string;
    slug: string;
    description: string;
    item_type: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    effect_type: string;
    effect_value: any;
    icon_path: string;
  };
}

interface ActiveBuff {
  id: string;
  buff_type: string;
  buff_value: number;
  expires_at: string;
  item?: {
    name: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  rating: number;
  problems_solved: number;
  current_streak: number;
  best_streak: number;
  last_solved_at: string | null;
  github_login: string;
  lc_username?: string;
  name?: string;
  avatar_url?: string;
  xp_level?: number;
  rank_title?: string;
  rank_badge?: string;
  rank_rarity?: string;
}

interface UserStats {
  rating: number;
  problems_solved: number;
  problems_attempted: number;
  current_streak: number;
  best_streak: number;
}

const ACCENT_ARENA = "#ffa116";
const ACCENT_DIM = "#cc8111";

export default function ArenaPage() {
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [streakFreezes, setStreakFreezes] = useState<number>(0);
  
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const lastLoadedUsername = useRef<string | null | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);

  const solvedCount = challenges.filter(ch => ch.status === "accepted").length;
  const totalCount = challenges.length;
  const progressPercent = totalCount > 0 ? (solvedCount / totalCount) * 100 : 0;

  const supabase = createBrowserSupabase();

  useEffect(() => {
    // 1. Get user session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      if (session?.user) {
        const ghUser = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setUsername(ghUser);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session?.user) {
        const ghUser = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setUsername(ghUser);
      } else {
        setUsername(null);
        setInventory([]);
        setActiveBuffs([]);
        setUserStats(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Load arena data
  const loadData = async () => {
    const isUserChanged = lastLoadedUsername.current !== username;
    if (isFirstLoad.current || isUserChanged) {
      setLoading(true);
    }
    try {
      // Fetch challenges and leaderboard (public endpoints)
      const [challengesRes, leaderboardRes] = await Promise.all([
        fetch("/api/arena/challenge/today"),
        fetch("/api/arena/leaderboard")
      ]);

      if (challengesRes.ok) {
        const cData = await challengesRes.json();
        setChallenges(cData.challenges || []);
      }
      if (leaderboardRes.ok) {
        const lData = await leaderboardRes.json();
        setLeaderboard(lData.leaderboard || []);
      }

      // Fetch private user data if authenticated
      if (session) {
        const headers = {
          Authorization: `Bearer ${session.access_token}`
        };

        const [inventoryRes, buffsRes] = await Promise.all([
          fetch("/api/arena/inventory", { headers }),
          fetch("/api/arena/buffs/active", { headers })
        ]);

        if (inventoryRes.ok) {
          const invData = await inventoryRes.json();
          setInventory(invData.inventory || []);
        }
        if (buffsRes.ok) {
          const buffsData = await buffsRes.json();
          setActiveBuffs(buffsData.active_buffs || []);
        }

        if (username) {
          const statsRes = await fetch(`/api/arena/stats/${username}`, { headers });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setUserStats(statsData.stats);
            setStreakFreezes(statsData.streak_freezes || 0);
          }
        }
      }
    } catch (err) {
      console.error("Error loading Arena data:", err);
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
      lastLoadedUsername.current = username;
    }
  };

  useEffect(() => {
    loadData();
  }, [session, username]);

  const handleUseItem = async (itemId: string, itemName: string) => {
    if (!session) return;
    
    setActionLoading(itemId);
    setMessage(null);

    try {
      const res = await fetch("/api/arena/items/use", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ item_id: itemId })
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMessage({ text: data.error || "Failed to use item", type: "error" });
      } else {
        const actionStr = data.action === "consumed" ? "Consumed" : data.action === "equipped" ? "Equipped" : "Unequipped";
        setMessage({ text: `Successfully ${actionStr.toLowerCase()} ${itemName}!`, type: "success" });
        
        // Reload inventory, buffs and stats
        await loadData();
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Network error", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / (3600 * 1000));
    const mins = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m left`;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "#39ff14";
      case "rare": return "#ffa116";
      case "epic": return "#d300c5";
      case "legendary": return "#ff0055";
      default: return "#8c8c9c";
    }
  };

  const getDifficultyBorder = (diff: string) => {
    switch (diff) {
      case "easy": return "border-[#39ff14]";
      case "medium": return "border-[#ffa116]";
      case "hard": return "border-[#ff0055]";
      default: return "border-border";
    }
  };

  const getDifficultyBadgeColor = (diff: string) => {
    switch (diff) {
      case "easy": return "bg-[#39ff14]/20 text-[#39ff14] border-[#39ff14]";
      case "medium": return "bg-[#ffa116]/20 text-[#ffa116] border-[#ffa116]";
      case "hard": return "bg-[#ff0055]/20 text-[#ff0055] border-[#ff0055]";
      default: return "bg-bg text-muted border-border";
    }
  };

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-7xl px-4 py-8">
        
        {/* Navigation & Title */}
        <div className="flex flex-col items-center justify-between border-b border-border pb-6 md:flex-row">
          <Link
            href="/"
            className="mb-4 inline-block text-sm text-muted transition-colors hover:text-cream md:mb-0"
          >
            &larr; Back to City
          </Link>
          
          <h1 className="text-center text-3xl tracking-widest text-cream" style={{ textShadow: `0 0 10px ${ACCENT_ARENA}44` }}>
            ⚔ Coding <span style={{ color: ACCENT_ARENA }}>Arena</span> ⚔
          </h1>
          
          <div className="w-24 md:block hidden"></div>
        </div>

        {/* Global messages (success/error) */}
        {message && (
          <div className={`mt-4 border-2 p-3 text-center text-xs normal-case ${
            message.type === "success" ? "border-green-400 bg-green-500/10 text-green-300" : "border-red-400 bg-red-500/10 text-red-300"
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center text-cream">
            <span className="blink-dot">Loading Arena...</span>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Left/Middle Column (2/3 width on large screens) - Challenges & Instructions */}
            <div className="flex flex-col gap-6 lg:col-span-8">
              
              <div className="border-[3px] border-border bg-bg-raised p-5">
                <h2 className="text-sm text-cream" style={{ color: ACCENT_ARENA }}>
                  Today's Daily Challenges
                </h2>
                <p className="mt-2 text-[10px] text-muted normal-case leading-relaxed">
                  Earn rating points, experience points (XP), and unlock pixel-art RPG item drops by solving today's challenges.
                  Click a card to read the description and open the problem in your IDE.
                </p>

                {challenges.length > 0 && (
                  <div className="mt-4 border-2 border-border bg-bg p-3">
                    <div className="flex justify-between items-center text-[9px] font-bold text-cream mb-1.5">
                      <span>DAILY PROGRESS</span>
                      <span style={{ color: solvedCount === totalCount ? "#39ff14" : ACCENT_ARENA }}>
                        {solvedCount}/{totalCount} SOLVED
                      </span>
                    </div>
                    <div className="w-full bg-bg-raised border border-border h-3.5 p-0.5 relative overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: `${progressPercent}%`,
                          backgroundColor: solvedCount === totalCount ? "#39ff14" : ACCENT_ARENA,
                          boxShadow: `0 0 8px ${solvedCount === totalCount ? "#39ff14" : ACCENT_ARENA}66`
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-4">
                  {challenges.length === 0 ? (
                    <div className="border border-dashed border-border p-6 text-center text-xs text-muted normal-case">
                      No active daily challenges scheduled for today.
                    </div>
                  ) : (
                    challenges.map((ch) => {
                      const isExpanded = expandedChallenge === ch.id;
                      return (
                        <div
                          key={ch.id}
                          className={`border-[3px] bg-bg-card p-4 transition-all duration-200 ${getDifficultyBorder(ch.difficulty)} ${
                            isExpanded ? "shadow-[0_0_15px_rgba(255,161,22,0.15)]" : ""
                          }`}
                        >
                          <div
                            className="flex cursor-pointer items-center justify-between"
                            onClick={() => setExpandedChallenge(isExpanded ? null : ch.id)}
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`border px-2 py-0.5 text-[9px] font-bold ${getDifficultyBadgeColor(ch.difficulty)}`}>
                                {ch.difficulty}
                              </span>
                              {ch.status === "accepted" && (
                                <span className="border border-[#39ff14] bg-[#39ff14]/15 text-[#39ff14] px-2 py-0.5 text-[9px] font-bold">
                                  ✓ SOLVED
                                </span>
                              )}
                              <h3 className="text-xs text-cream hover:underline">
                                {ch.problem.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="text-[10px] text-cream block">+{ch.reward_points} Pts</span>
                                <span className="text-[8px] text-muted block">+{ch.reward_xp} XP</span>
                              </div>
                              <span className="text-xs text-muted">{isExpanded ? "▲" : "▼"}</span>
                            </div>
                          </div>

                           {/* Expanded problem description & execution details */}
                          {isExpanded && (
                            <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted normal-case">
                              <div className="mb-4 flex flex-wrap gap-5 border-b border-border/50 pb-3">
                                <div>
                                  <span className="text-cream text-[11px] uppercase font-bold block mb-0.5">CF Rating</span>
                                  <span className="text-[12px] text-cream font-bold block">{ch.problem.difficulty_rating}</span>
                                </div>
                                <div>
                                  <span className="text-cream text-[11px] uppercase font-bold block mb-0.5">Time Limit</span>
                                  <span className="text-[12px] text-cream font-bold block">{ch.problem.time_limit_ms}ms</span>
                                </div>
                                <div>
                                  <span className="text-cream text-[11px] uppercase font-bold block mb-0.5">Memory Limit</span>
                                  <span className="text-[12px] text-cream font-bold block">{ch.problem.memory_limit_mb}MB</span>
                                </div>
                                <div>
                                  <span className="text-cream text-[11px] uppercase font-bold block mb-0.5">Drop Pool</span>
                                  <span className="text-[12px] text-cream capitalize font-bold block">
                                    {ch.difficulty === "easy" ? "Common (100%), Rare (15%)" :
                                     ch.difficulty === "medium" ? "Rare (100%), Epic (20%)" :
                                     "Epic (100%), Legendary (5% Jackpot)"}
                                  </span>
                                </div>
                              </div>

                              <div className="mb-4">
                                <span className="text-cream text-[11px] uppercase font-bold block mb-1.5">Tags</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {ch.problem.tags.map(t => (
                                    <span key={t} className="bg-bg-raised border border-border px-2.5 py-1 text-[10px] text-cream font-medium">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Deep link button to launch VS Code / Antigravity extension */}
                              <div className="mt-6 flex flex-col gap-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <a
                                    href={`vscode://leetcode-city.leetcode-city-pulse/arena?challenge=${ch.id}&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`}
                                    className="btn-press block border-[3px] border-border bg-accent px-3 py-1.5 text-center text-[10px] font-bold text-bg transition-colors"
                                    style={{
                                      backgroundColor: ACCENT_ARENA,
                                      borderColor: ACCENT_DIM,
                                      boxShadow: `0 0 10px ${ACCENT_ARENA}22`
                                    }}
                                  >
                                    SOLVE IN VS CODE
                                  </a>
                                  <a
                                    href={`antigravity-ide://leetcode-city.leetcode-city-pulse/arena?challenge=${ch.id}&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`}
                                    className="btn-press block border-[3px] border-border bg-accent px-3 py-1.5 text-center text-[10px] font-bold text-bg transition-colors"
                                    style={{
                                      backgroundColor: "#39ff14",
                                      borderColor: "#20c00a",
                                      color: "#0b0c10",
                                      boxShadow: `0 0 10px #39ff1422`
                                    }}
                                  >
                                    SOLVE IN ANTIGRAVITY
                                  </a>
                                </div>
                                <p className="text-center text-[10px] text-dim normal-case mt-1.5">
                                  Deep link requires the <span className="text-cream">LeetCode City: Pulse</span> extension installed in VS Code or Antigravity IDE.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Instructions card */}
              <div className="border-[3px] border-border bg-bg-raised p-5 text-xs leading-relaxed text-muted normal-case">
                <h3 className="text-xs text-cream uppercase mb-2">⚔ How to Compete</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="text-cream font-bold" style={{ color: ACCENT_ARENA }}>1.</span>
                    <p>Install the <span className="text-cream font-bold">LeetCode City: Pulse</span> extension in VS Code or Antigravity IDE and log in using your API key from settings.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-cream font-bold" style={{ color: ACCENT_ARENA }}>2.</span>
                    <p>Click <span className="text-cream font-bold">"Solve in VS Code"</span> or <span className="text-cream font-bold">"Solve in Antigravity"</span> on any challenge to open the problem files side-by-side in your editor automatically.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-cream font-bold" style={{ color: ACCENT_ARENA }}>3.</span>
                    <p>Write your solution. Click <span className="text-cream font-bold">"Run Samples"</span> in the editor sidebar to compile and execute your code against sample test cases locally.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-cream font-bold" style={{ color: ACCENT_ARENA }}>4.</span>
                    <p>Once sample tests pass, click <span className="text-cream font-bold">"Submit"</span>. The extension decrypts and runs the code against the full hidden test suite, submits results to the server, and awards items!</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (1/3 width on large screens) - Stats, Buffs & Inventory */}
            <div className="flex flex-col gap-6 lg:col-span-4">
              
              {/* Profile Stats Card */}
              {session ? (
                <div className="border-[3px] border-border bg-bg-raised p-5">
                  <h2 className="text-sm text-cream" style={{ color: ACCENT_ARENA }}>
                    Your Arena Stats
                  </h2>

                  {userStats ? (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="border border-border bg-bg-card p-3 text-center">
                        <span className="text-[8px] text-muted block mb-1">Grid Score</span>
                        <span className="text-sm text-cream font-bold" style={{ color: ACCENT_ARENA }}>{userStats.rating}</span>
                      </div>
                      <div className="border border-border bg-bg-card p-3 text-center">
                        <span className="text-[8px] text-muted block mb-1">Solved</span>
                        <span className="text-sm text-cream font-bold">{userStats.problems_solved}</span>
                      </div>
                      <div className="border border-border bg-bg-card p-3 text-center">
                        <span className="text-[8px] text-muted block mb-1">Streak</span>
                        <span className="text-sm text-[#39ff14] font-bold">🔥 {userStats.current_streak} days</span>
                      </div>
                      <div className="border border-border bg-bg-card p-3 text-center">
                        <span className="text-[8px] text-muted block mb-1">Best Streak</span>
                        <span className="text-sm text-[#39ff14] font-bold">🏆 {userStats.best_streak} days</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-[10px] text-muted normal-case">
                      No Arena stats yet. Solve your first daily challenge to establish rating!
                    </div>
                  )}

                  <div className="mt-4 border-t border-border/50 pt-3 flex justify-between items-center text-[10px]">
                    <span className="text-muted">Streak Freezes:</span>
                    <span className="text-cream font-bold">{streakFreezes}/2 Available</span>
                  </div>
                </div>
              ) : (
                <div className="border-[3px] border-border bg-bg-raised p-5 text-center">
                  <h2 className="text-xs text-cream mb-2">Connect Profile</h2>
                  <p className="text-[9px] text-muted normal-case mb-4">
                    Sign in with LeetCode to track Grid Score, streaks, inventory, and buffs!
                  </p>
                  <Link
                    href="/shop"
                    className="btn-press inline-block border-[3px] border-border px-4 py-2 text-[10px] text-bg"
                    style={{ backgroundColor: ACCENT_ARENA, borderColor: ACCENT_DIM }}
                  >
                    SIGN IN NOW
                  </Link>
                </div>
              )}

              {/* Active Buffs Card */}
              {session && (
                <div className="border-[3px] border-border bg-bg-raised p-5">
                  <h2 className="text-sm text-cream mb-3" style={{ color: ACCENT_ARENA }}>
                    Active Buffs
                  </h2>

                  {activeBuffs.length === 0 ? (
                    <p className="text-[9px] text-muted normal-case">
                      No active buffs. Drink potions or equip items to activate XP boosts!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activeBuffs.map((buff) => (
                        <div key={buff.id} className="border border-border bg-bg-card p-2.5 text-[10px] normal-case">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-cream capitalize font-bold">
                              {buff.buff_type.replace("_", " ")}
                            </span>
                            <span className="text-[#39ff14]">
                              {buff.buff_value}x
                            </span>
                          </div>
                          <div className="flex justify-between text-[8px] text-muted">
                            <span>{buff.item?.name || "Consumable Buff"}</span>
                            <span>{formatTimeRemaining(buff.expires_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inventory Card */}
              {session && (
                <div className="border-[3px] border-border bg-bg-raised p-5">
                  <h2 className="text-sm text-cream mb-3" style={{ color: ACCENT_ARENA }}>
                    Your Inventory
                  </h2>

                  {inventory.length === 0 ? (
                    <p className="text-[9px] text-muted normal-case">
                      Empty inventory. Solve challenges to earn item drops!
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                      {inventory.map((inv) => {
                        const isEquippable = ["gear", "cosmetic", "legendary", "companion"].includes(inv.item.item_type);
                        const isActionLoading = actionLoading === inv.item.id;
                        
                        return (
                          <div key={inv.id} className="border border-border bg-bg-card p-2.5 flex items-start gap-3">
                            {/* Icon */}
                            <div className="relative border-2 border-border bg-bg p-1 flex-shrink-0 flex items-center justify-center" style={{ width: "40px", height: "40px" }}>
                              {inv.item.icon_path && (
                                <img
                                  src={inv.item.icon_path}
                                  alt={inv.item.name}
                                  className="w-8 h-8 image-rendering-pixelated"
                                />
                              )}
                              {inv.quantity > 1 && (
                                <span className="absolute -bottom-1 -right-1 bg-bg-raised border border-border text-[8px] text-cream px-1 font-bold">
                                  {inv.quantity}
                                </span>
                              )}
                            </div>

                            {/* Details & Actions */}
                            <div className="flex-grow min-w-0 normal-case text-[10px]">
                              <div className="flex justify-between items-start">
                                <h3 className="font-bold text-cream truncate max-w-[120px]" style={{ color: getRarityColor(inv.item.rarity) }}>
                                  {inv.item.name}
                                </h3>
                                <span className="text-[8px] text-muted uppercase">
                                  {inv.item.item_type}
                                </span>
                              </div>
                              <p className="text-[8px] text-muted mt-0.5 leading-tight line-clamp-2">
                                {inv.item.description}
                              </p>

                              {/* Button */}
                              <button
                                disabled={isActionLoading}
                                onClick={() => handleUseItem(inv.item.id, inv.item.name)}
                                className={`mt-2 border px-2 py-0.5 text-[8px] font-bold block w-full text-center transition-colors btn-press ${
                                  inv.is_equipped 
                                    ? "bg-red-500/20 border-red-500 text-red-300"
                                    : isEquippable
                                      ? "bg-green-500/20 border-green-500 text-green-300"
                                      : "bg-orange-500/20 border-orange-500 text-orange-300"
                                }`}
                              >
                                {isActionLoading 
                                  ? "LOADING..." 
                                  : inv.is_equipped 
                                    ? "UNEQUIP" 
                                    : isEquippable 
                                      ? "EQUIP" 
                                      : "CONSUME"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Top 5 Leaderboard Preview */}
              <div className="border-[3px] border-border bg-bg-raised p-5">
                <h2 className="text-sm text-cream mb-3" style={{ color: ACCENT_ARENA }}>
                  Arena Leaderboard
                </h2>

                <div className="space-y-2">
                  {leaderboard.length === 0 ? (
                    <p className="text-[9px] text-muted normal-case">No coders ranked yet.</p>
                  ) : (
                    leaderboard.slice(0, 5).map((entry, idx) => (
                      <div key={`${entry.github_login || "entry"}-${idx}`} className="flex justify-between items-center text-[10px] border-b border-border/50 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted font-bold w-4">#{idx + 1}</span>
                          <span className="text-cream hover:underline truncate max-w-[120px]">
                            {entry.lc_username ? (
                              <Link href={`/dev/${entry.github_login}`}>
                                @{entry.lc_username}
                              </Link>
                            ) : entry.github_login ? (
                              <Link href={`/dev/${entry.github_login}`}>
                                @{entry.github_login}
                              </Link>
                            ) : (
                              "Anonymous"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#39ff14] text-[8px]">🔥 {entry.current_streak}d</span>
                          <span className="font-bold text-cream" style={{ color: ACCENT_ARENA }}>{entry.rating} Grid</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}

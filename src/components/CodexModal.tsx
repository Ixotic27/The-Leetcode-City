"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface CodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  shadowColor: string;
}

interface CodexData {
  loggedIn: boolean;
  developerId?: number;
  stats: Record<string, any> | null;
  unlockedAchievements: string[];
  ownedItems: string[];
  ownedTitles: string[];
  selectedTitle?: string | null;
  achievements: any[];
  items: any[];
}

type TabType = "titles" | "achievements" | "items";
type FilterType = "all" | "claimed" | "in_progress" | "locked";

const TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};

const CATEGORY_SYMBOLS: Record<string, string> = {
  commits: "[ >_ ]",
  easy_solved: "[ ⚒ ]",
  medium_solved: "[ ❖ ]",
  hard_solved: "[ ◆ ]",
  contributors: "[ ♔ ]",
  streak: "[ ✦ ]",
  kudos_streak: "[ ✦ ]",
  lc_streak: "[ ✦ ]",
  raid: "[ ⚔ ]",
  purchases: "[ ■ ]",
  dailies: "[ ⛭ ]",
  social: "[ ✦ ]",
  kudos: "[ ♥ ]",
  gifts_sent: "[ ⛶ ]",
  gifts_received: "[ ⛶ ]",
  stars: "[ ★ ]",
  repos: "[ ☱ ]",
};

const EQUIPABLE_TITLES = [
  "title_creator",
  "title_lead_dev",
  "title_sys_op",
  "crown_of_code",
  "badge_legendary",
  "badge_diamond",
  "badge_platinum",
  "badge_gold",
  "badge_silver",
  "badge_bronze"
];

export default function CodexModal({ isOpen, onClose, accentColor, shadowColor }: CodexModalProps) {
  const [data, setData] = useState<CodexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("titles");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch Codex data on mount/open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    let active = true;
    const controller = new AbortController();

    fetch("/api/codex", { signal: controller.signal })
      .then(async (res) => {
        const codexData = await res.json();
        if (!active || !isMounted.current) return;
        
        if (!res.ok || codexData.error || !Array.isArray(codexData.achievements) || !Array.isArray(codexData.items)) {
          throw new Error(codexData.error || "Malformed codex data");
        }
        setData(codexData);
        setSelectedTitle(codexData.selectedTitle || null);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!active || !isMounted.current) return;

        console.error("Failed to load Codex data:", err);
        setData({
          loggedIn: false,
          stats: null,
          unlockedAchievements: [],
          ownedItems: [],
          ownedTitles: [],
          selectedTitle: null,
          achievements: [],
          items: [],
        });
        setSelectedTitle(null);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isOpen]);

  const handleEquipTitle = async (slug: string | null) => {
    setEquippingId(slug || "unequip");
    try {
      const res = await fetch("/api/customizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item_id: "selected_title",
          slug,
        }),
      });
      const resData = await res.json();
      
      if (!isMounted.current || !isOpen) return;

      if (res.ok && resData.success) {
        setSelectedTitle(resData.slug);
        if (data && data.developerId) {
          try {
            if (resData.slug) {
              localStorage.setItem(
                "leetcodecity:selected_title_override",
                JSON.stringify({ developerId: data.developerId, value: resData.slug, ts: Date.now() })
              );
            } else {
              localStorage.removeItem("leetcodecity:selected_title_override");
            }
          } catch (e) {
            console.warn("[CodexModal] Failed to set title override:", e);
          }
        }
      } else {
        alert(resData.error || "Failed to save title customization");
      }
    } catch (err) {
      if (!isMounted.current || !isOpen) return;
      console.error("Error equipping title:", err);
      alert("Error saving title customization");
    } finally {
      if (isMounted.current && isOpen) {
        setEquippingId(null);
      }
    }
  };

  if (!isOpen) return null;

  // Static list of all titles for the codex
  const titles = [
    {
      id: "title_creator",
      slug: "title_creator",
      name: "City Creator",
      titleText: "The Architect",
      color: "#ec4899",
      category: "staff",
      description: "Founder & Architect of LeetCode City.",
      howToGet: "Be a core platform founder or admin.",
      symbol: "[ ♕ ] ✦",
    },
    {
      id: "title_lead_dev",
      slug: "title_lead_dev",
      name: "Core Engineer",
      titleText: "Root Access",
      color: "#10b981",
      category: "staff",
      description: "Platform core maintainer and system engineer.",
      howToGet: "Merge core platform contributions.",
      symbol: "[ >_ ] ✦",
    },
    {
      id: "title_sys_op",
      slug: "title_sys_op",
      name: "Database Master",
      titleText: "SysOp",
      color: "#3b82f6",
      category: "staff",
      description: "Keeper of the platform's database and pipelines.",
      howToGet: "Assigned database administrator status.",
      symbol: "[ ☱ ] ✦",
    },
    {
      id: "crown_of_code",
      slug: "crown_of_code",
      name: "Crown of Code",
      titleText: "Code King/Queen",
      color: "#f59e0b",
      category: "shop",
      description: "Holographic crown visual on building and majestic chat text.",
      howToGet: "Unlock by purchasing the Crown of Code in the Customize shop.",
      symbol: "[ ♔ ] ✦",
    },
    {
      id: "badge_legendary",
      slug: "badge_legendary",
      name: "Legendary Sentinel",
      titleText: "The Sentinel",
      color: "#a855f7",
      category: "arena",
      description: "Arena Level 50+ Legendary Badge.",
      howToGet: "Reach Experience Level 50+ in the Coding Arena.",
      symbol: "[ ⚔ ] ✦",
    },
    {
      id: "badge_diamond",
      slug: "badge_diamond",
      name: "Diamond Grandmaster",
      titleText: "The Grandmaster",
      color: "#06b6d4",
      category: "arena",
      description: "Arena Level 40+ Diamond Badge.",
      howToGet: "Reach Experience Level 40+ in the Coding Arena.",
      symbol: "[ ◆ ] ✦",
    },
    {
      id: "badge_platinum",
      slug: "badge_platinum",
      name: "Platinum Architect",
      titleText: "The Architect",
      color: "#3b82f6",
      category: "arena",
      description: "Arena Level 30+ Platinum Badge.",
      howToGet: "Reach Experience Level 30+ in the Coding Arena.",
      symbol: "[ ❖ ] ✦",
    },
    {
      id: "badge_gold",
      slug: "badge_gold",
      name: "Gold Developer",
      titleText: "The Builder",
      color: "#eab308",
      category: "arena",
      description: "Arena Level 20+ Gold Badge.",
      howToGet: "Reach Experience Level 20+ in the Coding Arena.",
      symbol: "[ ■ ] ⚒",
    },
    {
      id: "badge_silver",
      slug: "badge_silver",
      name: "Silver Hacker",
      titleText: "The Script Kiddie",
      color: "#94a3b8",
      category: "arena",
      description: "Arena Level 10+ Silver Badge.",
      howToGet: "Reach Experience Level 10+ in the Coding Arena.",
      symbol: "[ $ ] ⛭",
    },
    {
      id: "badge_bronze",
      slug: "badge_bronze",
      name: "Bronze Coder",
      titleText: "The Apprentice",
      color: "#b45309",
      category: "arena",
      description: "Arena Level 2+ Bronze Badge.",
      howToGet: "Reach Experience Level 2+ in the Coding Arena.",
      symbol: "[ >_ ] ⛭",
    },
    {
      id: "title_kingpin",
      slug: "title_kingpin",
      name: "Kingpin",
      titleText: "Kingpin",
      color: "#f43f5e",
      category: "pvp",
      description: "The ultimate tier of PvP combat supremacy.",
      howToGet: "Reach 10,000+ PvP Raid XP by attacking other buildings.",
      symbol: "[ ⚔ ] ♔",
    },
    {
      id: "title_heist_master",
      slug: "title_heist_master",
      name: "Heist Master",
      titleText: "Heist Master",
      color: "#fbbf24",
      category: "pvp",
      description: "A highly-sought PvP tactical combat raider.",
      howToGet: "Reach 2,000+ PvP Raid XP by attacking other buildings.",
      symbol: "[ ⚔ ] $",
    },
    {
      id: "title_burglar",
      slug: "title_burglar",
      name: "Burglar",
      titleText: "Burglar",
      color: "#94a3b8",
      category: "pvp",
      description: "A skilled code thief and burglar.",
      howToGet: "Reach 500+ PvP Raid XP by attacking other buildings.",
      symbol: "[ ⚔ ] ☱",
    },
    {
      id: "title_pickpocket",
      slug: "title_pickpocket",
      name: "Pickpocket",
      titleText: "Pickpocket",
      color: "#b45309",
      category: "pvp",
      description: "A beginner PvP building pickpocket.",
      howToGet: "Reach 100+ PvP Raid XP by attacking other buildings.",
      symbol: "[ ⚔ ] ⛭",
    },
  ];

  // Helper to get stats progress
  const getProgress = (item: any, type: TabType) => {
    if (!data || !data.stats) return { current: 0, threshold: 0, percent: 0, status: "locked" };

    const stats = data.stats;

    if (type === "achievements") {
      const unlocked = data.unlockedAchievements.includes(item.id);
      if (unlocked) return { current: item.threshold, threshold: item.threshold, percent: 1, status: "claimed" };

      const currentVal = stats[item.category] ?? 0;
      const percent = Math.min(1, currentVal / item.threshold);
      let status = "locked";
      if (percent >= 0.75) status = "almost_claimed";
      else if (percent > 0) status = "in_progress";

      return { current: currentVal, threshold: item.threshold, percent, status };
    }

    if (type === "titles") {
      const claimed = data.ownedTitles.includes(item.slug);
      if (claimed) return { current: 1, threshold: 1, percent: 1, status: "claimed" };

      // Manual checks
      let currentVal = 0;
      let threshold = 1;

      if (item.category === "arena") {
        const reqLevel =
          item.slug === "badge_legendary" ? 50 :
          item.slug === "badge_diamond" ? 40 :
          item.slug === "badge_platinum" ? 30 :
          item.slug === "badge_gold" ? 20 :
          item.slug === "badge_silver" ? 10 : 2;
        currentVal = stats.xp_level ?? 1;
        threshold = reqLevel;
      } else if (item.category === "pvp") {
        const reqXp =
          item.slug === "title_kingpin" ? 10000 :
          item.slug === "title_heist_master" ? 2000 :
          item.slug === "title_burglar" ? 500 : 100;
        currentVal = stats.raid_xp ?? 0;
        threshold = reqXp;
      } else if (item.category === "staff") {
        currentVal = stats.isDeveloper ? 1 : 0;
        threshold = 1;
      }

      const percent = Math.min(1, currentVal / threshold);
      let status = "locked";
      if (percent >= 1) status = "claimed";
      else if (percent >= 0.75) status = "almost_claimed";
      else if (percent > 0) status = "in_progress";

      return { current: currentVal, threshold, percent, status };
    }

    if (type === "items") {
      const owned = data.ownedItems.includes(item.id) || data.ownedTitles.includes(item.slug);
      if (owned) return { current: 1, threshold: 1, percent: 1, status: "claimed" };
      return { current: 0, threshold: 1, percent: 0, status: "locked" };
    }

    return { current: 0, threshold: 0, percent: 0, status: "locked" };
  };

  // Compile list based on active tab, search query, and filters
  const getFilteredList = () => {
    if (!data) return [];

    let rawList: any[] = [];
    if (activeTab === "titles") rawList = titles;
    else if (activeTab === "achievements") rawList = data.achievements;
    else if (activeTab === "items") rawList = data.items;

    // Filter by search
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      rawList = rawList.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Map each item to its progress/status
    const mapped = rawList.map((item) => {
      const prog = getProgress(item, activeTab);
      return { ...item, progress: prog };
    });

    // Filter by status tab
    if (filter === "claimed") return mapped.filter((item) => item.progress.status === "claimed");
    if (filter === "in_progress") return mapped.filter((item) => item.progress.status === "in_progress" || item.progress.status === "almost_claimed");
    if (filter === "locked") return mapped.filter((item) => item.progress.status === "locked");

    return mapped;
  };

  const list = getFilteredList();

  // Reset selection when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  const activeItem = list.find((item) => item.id === selectedId) || list[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm">
      <div
        className="flex h-[90vh] w-full max-w-[960px] flex-col border-[4px] bg-bg font-pixel uppercase text-warm shadow-2xl relative"
        style={{
          borderColor: accentColor,
          boxShadow: `8px 8px 0 0 ${shadowColor}`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3.5 -right-3.5 z-50 flex h-8 w-8 items-center justify-center border-[3px] border-border bg-bg-raised text-cream transition-all hover:border-border-light text-xs font-bold"
        >
          X
        </button>

        {/* Modal Header */}
        <div className="border-b-[4px] border-border bg-bg-raised p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl text-[#39d353]">◆</span>
            <div>
              <h1 className="text-base font-bold text-cream leading-tight">Codex</h1>
              <p className="text-[9px] text-muted normal-case mt-0.5">Explore all titles, achievements, and items in LeetCode City</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b-[3px] border-border bg-bg-card">
          {(["titles", "achievements", "items"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-3 text-center text-[10px] font-bold border-r-[3px] border-border last:border-r-0 transition-colors ${
                activeTab === tab ? "bg-bg-raised text-cream" : "text-muted hover:text-cream"
              }`}
              style={{
                color: activeTab === tab ? accentColor : undefined,
                borderBottom: activeTab === tab ? `3px solid ${accentColor}` : "none",
              }}
            >
              {tab === "titles" && "Titles"}
              {tab === "achievements" && "Achievements"}
              {tab === "items" && "Items"}
            </button>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="p-3 bg-bg-raised border-b-[3px] border-border flex flex-col sm:flex-row gap-2 justify-between">
          {/* Search */}
          <input
            type="text"
            placeholder="Search Codex..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 px-3 border-[2px] border-border bg-bg text-[10px] text-cream flex-1 max-w-sm normal-case"
          />

          {/* Filter buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "claimed", "in_progress", "locked"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn-press px-2.5 py-1 text-[9px] border-[2px] ${
                  filter === f
                    ? "border-[#39d353] bg-[#39d353]/10 text-cream"
                    : "border-border text-muted hover:border-border-light bg-bg-card"
                }`}
              >
                {f === "all" && "All"}
                {f === "claimed" && "Claimed"}
                {f === "in_progress" && "Started"}
                {f === "locked" && "Locked"}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-bg">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-[4px] border-border border-t-amber-500 rounded-full mx-auto mb-2" />
              <p className="text-[10px] text-muted">Reading Codex Archives...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-bg">
            {/* Left Side: Items List */}
            <div className="flex-1 overflow-y-auto border-b-[3px] md:border-b-0 md:border-r-[3px] border-border p-3">
              {list.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-muted text-[10px] py-10 normal-case">
                  No matching records found in this category.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {list.map((item) => {
                    const isSelected = item.id === selectedId || (selectedId === null && item.id === list[0]?.id);

                    // Badge color matching the status
                    let statusLabel = "";
                    let statusColor = "";
                    if (item.progress.status === "claimed") {
                      statusLabel = "CLAIMED";
                      statusColor = "#39d353";
                    } else if (item.progress.status === "in_progress" || item.progress.status === "almost_claimed") {
                      statusLabel = "IN PROGRESS";
                      statusColor = "#fbbf24";
                    } else {
                      statusLabel = "LOCKED";
                      statusColor = "#ff4444";
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`flex items-center gap-3 p-2.5 border-[2px] transition-all text-left w-full ${
                          isSelected
                            ? "border-[#39d353] bg-[#39d353]/5"
                            : "border-border hover:border-border-light bg-bg-card"
                        }`}
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-[2px] border-border bg-bg font-mono text-lg overflow-hidden relative">
                          {activeTab === "items" && item.icon_path ? (
                            <Image
                              src={item.icon_path}
                              alt={item.name}
                              fill
                              sizes="40px"
                              className="object-fill"
                              style={{ imageRendering: "pixelated" }}
                            />
                          ) : activeTab === "achievements" ? (
                            <span style={{ color: TIER_COLORS[item.tier] }}>
                              {CATEGORY_SYMBOLS[item.category] ?? "[ ⛭ ]"}
                            </span>
                          ) : (
                            <span style={{ color: item.color }}>
                              {item.symbol?.split(" ")[1] ?? "♔"}
                            </span>
                          )}
                        </div>

                        {/* Text info */}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[10px] font-bold text-cream">{item.name}</h3>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[7.5px]" style={{ color: statusColor }}>{statusLabel}</span>
                            {item.progress.threshold > 1 && (
                              <span className="text-[7.5px] text-muted">
                                {Math.round(item.progress.current)}/{item.progress.threshold}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Side: Details View */}
            <div className="w-full md:w-[360px] flex-shrink-0 overflow-y-auto bg-bg-raised p-4 flex flex-col justify-between">
              {activeItem ? (
                <div className="space-y-4">
                  {/* Category Label */}
                  <span className="inline-block border-[1.5px] border-border px-2 py-0.5 text-[8px] text-muted">
                    {activeTab === "titles" && "Title Customization"}
                    {activeTab === "achievements" && `Achievement (${activeItem.tier.toUpperCase()})`}
                    {activeTab === "items" && `Item (${activeItem.item_type.toUpperCase()})`}
                  </span>

                  {/* Title & Badge Showcase */}
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex h-16 w-16 items-center justify-center border-[3px] border-border bg-bg font-mono text-2xl overflow-hidden relative">
                      {activeTab === "items" && activeItem.icon_path ? (
                        <Image
                          src={activeItem.icon_path}
                          alt={activeItem.name}
                          fill
                          sizes="64px"
                          className="object-fill"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : activeTab === "achievements" ? (
                        <span style={{ color: TIER_COLORS[activeItem.tier], fontSize: "1.75rem" }}>
                          {CATEGORY_SYMBOLS[activeItem.category] ?? "[ ⛭ ]"}
                        </span>
                      ) : (
                        <span style={{ color: activeItem.color, fontSize: "1.75rem" }}>
                          {activeItem.symbol?.split(" ")[1] ?? "♔"}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-cream">{activeItem.name}</h2>
                      <p className="text-[8px] text-muted normal-case mt-0.5">ID: {activeItem.id}</p>
                    </div>
                  </div>

                  <hr className="border-border/30" />

                  {/* Live Banner Preview for Titles */}
                  {activeTab === "titles" && (
                    <div className="space-y-2">
                      <p className="text-[8.5px] text-muted">Active Banner Preview:</p>
                      {(() => {
                        const bannerImages: Record<string, string> = {
                          title_creator: "/assets/banners/banner_city_creator.png",
                          title_lead_dev: "/assets/banners/banner_core_engineer.png",
                          title_sys_op: "/assets/banners/banner_database_master.png",
                        };

                        const imageUrl = bannerImages[activeItem.slug];

                        if (imageUrl) {
                          return (
                            <div className="flex justify-center select-none w-full">
                              <div className="relative h-14 w-full border-[3px] border-border bg-[#1b1921] overflow-hidden">
                                <Image
                                  src={imageUrl}
                                  alt={activeItem.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 360px"
                                  className="object-fill"
                                  style={{ imageRendering: "pixelated" }}
                                />
                              </div>
                            </div>
                          );
                        }

                        // Dynamic preview
                        const symbols: Record<string, string> = {
                          badge_bronze: "[ >_ ] ⛭",
                          badge_silver: "[ $ ] ⛭",
                          badge_gold: "[ ■ ] ⚒",
                          badge_platinum: "[ ❖ ] ✦",
                          badge_diamond: "[ ◆ ] ✦",
                          badge_legendary: "[ ⚔ ] ✦",
                          crown_of_code: "[ ♔ ] ✦",
                        };

                        const symbol = symbols[activeItem.slug] ?? "[ ★ ]";

                        if (activeItem.slug === "badge_platinum" || activeItem.slug === "badge_diamond") {
                          return (
                            <div className="flex justify-center select-none">
                              <div
                                className="relative flex items-center gap-2.5 py-1.5 px-4 text-[9px] font-bold tracking-wide border-[2.5px] border-solid"
                                style={{
                                  borderColor: activeItem.color,
                                  backgroundColor: "#1b1921",
                                  color: activeItem.color,
                                  boxShadow: `0 0 6px ${activeItem.color}22`,
                                }}
                              >
                                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t-[2px] border-l-[2px]" style={{ borderColor: activeItem.color }} />
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t-[2px] border-r-[2px]" style={{ borderColor: activeItem.color }} />
                                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b-[2px] border-l-[2px]" style={{ borderColor: activeItem.color }} />
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b-[2px] border-r-[2px]" style={{ borderColor: activeItem.color }} />
                                <span className="font-mono text-[10px]">{symbol}</span>
                                <span>{activeItem.name.toUpperCase()}</span>
                              </div>
                            </div>
                          );
                        }

                        if (activeItem.slug === "badge_legendary" || activeItem.slug === "crown_of_code") {
                          return (
                            <div className="flex justify-center select-none">
                              <div className="flex items-center">
                                <div className="w-3 h-5 border-y-[2px] border-l-[2px] flex-shrink-0" style={{
                                  borderColor: activeItem.color,
                                  backgroundColor: "#1b1921",
                                  clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
                                }} />
                                <div
                                  className="flex items-center gap-2.5 py-1.5 px-3 text-[9px] font-bold tracking-wide border-y-[2px] border-x-[1px]"
                                  style={{
                                    borderColor: activeItem.color,
                                    backgroundColor: "#1b1921",
                                    color: activeItem.color,
                                  }}
                                >
                                  <span className="font-mono text-[10px]">{symbol}</span>
                                  <span>{activeItem.name.toUpperCase()}</span>
                                </div>
                                <div className="w-3 h-5 border-y-[2px] border-r-[2px] flex-shrink-0" style={{
                                  borderColor: activeItem.color,
                                  backgroundColor: "#1b1921",
                                  clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                                }} />
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="flex justify-center select-none">
                            <div
                              className="flex items-center gap-2.5 py-1.5 px-3 text-[9px] font-bold tracking-wide border-[3px] border-double"
                              style={{
                                borderColor: activeItem.color,
                                backgroundColor: "#1b1921",
                                color: activeItem.color,
                              }}
                            >
                              <span className="font-mono text-[10px]">{symbol}</span>
                              <span>{activeItem.name.toUpperCase()}</span>
                            </div>
                          </div>
                        );
                      })()}
                      {data?.loggedIn && EQUIPABLE_TITLES.includes(activeItem.slug) && activeItem.progress.status === "claimed" && (
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              if (selectedTitle === activeItem.slug) {
                                handleEquipTitle(null);
                              } else {
                                handleEquipTitle(activeItem.slug);
                              }
                            }}
                            disabled={equippingId !== null}
                            className="btn-press px-4 py-1.5 text-[9px] font-bold border-[2px] transition-colors w-full"
                            style={{
                              backgroundColor: selectedTitle === activeItem.slug ? "#ff4444" : "#39d353",
                              borderColor: selectedTitle === activeItem.slug ? "#b30000" : "#238636",
                              boxShadow: selectedTitle === activeItem.slug ? `1px 1px 0 0 #b30000` : `1px 1px 0 0 #238636`,
                              color: "#000",
                            }}
                          >
                            {equippingId === activeItem.slug || (equippingId === "unequip" && selectedTitle === activeItem.slug)
                              ? "SAVING..."
                              : selectedTitle === activeItem.slug
                              ? "UNEQUIP TITLE"
                              : "EQUIP TITLE"}
                          </button>
                        </div>
                      )}
                      <hr className="border-border/30" />
                    </div>
                  )}

                  {/* Description Box */}
                  <div className="space-y-1.5">
                    <p className="text-[8.5px] text-muted">Description:</p>
                    <p className="text-[10px] leading-relaxed text-cream normal-case bg-bg p-3 border-[2px] border-border">
                      {activeItem.description ?? "No description available."}
                    </p>
                  </div>

                  {/* How to Unlock Box */}
                  <div className="space-y-1.5">
                    <p className="text-[8.5px] text-muted">How to Achieve:</p>
                    <p className="text-[10px] leading-relaxed normal-case bg-bg p-3 border-[2px] border-border border-dashed" style={{ borderColor: accentColor }}>
                      {activeTab === "achievements" && activeItem.description}
                      {activeTab === "titles" && activeItem.howToGet}
                      {activeTab === "items" && (
                        activeItem.price_points != null
                          ? `Unlock by purchasing in the Arena Shop for ${activeItem.price_points} points.`
                          : activeItem.price_usd_cents > 0
                          ? "Purchase in the Customization Shop or unlock via exclusive Achievements."
                          : "Obtained as a free starter item or Arena drop reward."
                      )}
                    </p>
                  </div>

                  {/* Progress Section */}
                  {activeItem.progress.threshold > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-[8.5px] text-muted">Unlock Progress:</p>
                      <div className="bg-bg border-[2px] border-border p-2">
                        <div className="flex items-center justify-between text-[9px] mb-1 text-cream">
                          <span>{Math.round(activeItem.progress.current)} / {activeItem.progress.threshold}</span>
                          <span>{Math.round(activeItem.progress.percent * 100)}%</span>
                        </div>
                        <div className="h-2 bg-border-dark overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${activeItem.progress.percent * 100}%`,
                              backgroundColor: accentColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-[10px] text-muted normal-case">
                  Select an item to view codex details.
                </div>
              )}

              {/* Status footer */}
              {activeItem && (
                <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[9px] text-muted">Completion Status:</span>
                  <span
                    className="border-[1.5px] px-2.5 py-0.5 text-[9px] font-bold"
                    style={{
                      borderColor:
                        activeItem.progress.status === "claimed"
                          ? "#39d353"
                          : activeItem.progress.status === "in_progress" || activeItem.progress.status === "almost_claimed"
                          ? "#fbbf24"
                          : "#ff4444",
                      color:
                        activeItem.progress.status === "claimed"
                          ? "#39d353"
                          : activeItem.progress.status === "in_progress" || activeItem.progress.status === "almost_claimed"
                          ? "#fbbf24"
                          : "#ff4444",
                      backgroundColor:
                        activeItem.progress.status === "claimed"
                          ? "#39d35311"
                          : activeItem.progress.status === "in_progress" || activeItem.progress.status === "almost_claimed"
                          ? "#fbbf2411"
                          : "#ff444411",
                    }}
                  >
                    {activeItem.progress.status === "claimed" && "✓ CLAIMED"}
                    {(activeItem.progress.status === "in_progress" || activeItem.progress.status === "almost_claimed") && "IN PROGRESS"}
                    {activeItem.progress.status === "locked" && "LOCKED"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

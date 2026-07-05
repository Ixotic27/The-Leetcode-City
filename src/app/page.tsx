/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/immutability */
"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WeatherProvider } from "@/context/WeatherContext";
import { CityProvider, useCity } from "@/context/CityContext";
import { CityBuilding } from "@/lib/github";
import { track } from "@vercel/analytics";
import {
  isBuildingAd,
  buildAdLink,
  trackAdEvent,
  trackAdEvents,
} from "@/lib/skyAds";
import {
  trackSkyAdImpression,
  trackSkyAdClick,
  trackSkyAdCtaClick,
  trackBuildingClicked,
} from "@/lib/himetrica";

// Dynamically import Canvas and Chat overlays for performance
const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen bg-black flex items-center justify-center">
      <div className="text-[#ffa116] font-pixel text-lg animate-pulse">
        Loading City...
      </div>
    </div>
  ),
});

const CityChat = dynamic(() => import("@/components/CityChat"), { ssr: false });
const LoadingScreen = dynamic(() => import("@/components/LoadingScreen"), { ssr: false });

// HUD Modular Subcomponents
import SearchBar from "@/components/hud/SearchBar";
import ProfileCard from "@/components/hud/ProfileCard";
import ComparisonPanel from "@/components/hud/ComparisonPanel";
import FlyModeHUD from "@/components/hud/FlyModeHUD";
import RaidSystem from "@/components/hud/RaidSystem";
import CityHUD from "@/components/hud/CityHUD";
import AuthManager from "@/components/hud/AuthManager";
import SettingsPanel from "@/components/hud/SettingsPanel";
import ModalsOverlay from "@/components/hud/ModalsOverlay";

const LEADERBOARD_CATEGORIES = [
  { label: "Solved", key: "contributions" as const, tab: "solved" },
  { label: "LC Rank", key: "rank" as const, tab: "lc_rank" },
  { label: "Streak", key: "lc_streak" as const, tab: "streak" },
] as const;

export function MiniLeaderboard({
  buildings,
  accent,
}: {
  buildings: CityBuilding[];
  accent: string;
}) {
  const [catIndex, setCatIndex] = useState(0);

  // Auto-rotate every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setCatIndex((i) => (i + 1) % LEADERBOARD_CATEGORIES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const cat = LEADERBOARD_CATEGORIES[catIndex];
  const sorted = buildings
    .slice()
    .sort((a, b) => {
      if (cat.key === "rank") {
        const rankA = a.rank && a.rank < 999999 ? a.rank : 999999;
        const rankB = b.rank && b.rank < 999999 ? b.rank : 999999;
        return rankA - rankB;
      }
      return ((b[cat.key] as number) || 0) - ((a[cat.key] as number) || 0);
    })
    .slice(0, 5);

  return (
    <div className="hidden w-[200px] sm:block">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() =>
            setCatIndex((i) => (i + 1) % LEADERBOARD_CATEGORIES.length)
          }
          className="text-[10px] text-muted transition-colors hover:text-cream normal-case"
          style={{ color: accent }}
        >
          {cat.label}
        </button>
        <a
          href={`/leaderboard?tab=${cat.tab}`}
          className="text-[9px] text-muted transition-colors hover:text-cream normal-case"
        >
          View all &rarr;
        </a>
      </div>
      <div className="border-[2px] border-border bg-bg-raised/80 backdrop-blur-sm">
        {sorted.map((b, i) => (
          <a
            key={b.login}
            href={`/dev/${b.login}`}
            className="flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-bg-card"
          >
            <span className="flex items-center gap-2 overflow-hidden">
              <span
                className="text-[10px]"
                style={{
                  color:
                    i === 0
                      ? "#ffd700"
                      : i === 1
                        ? "#c0c0c0"
                        : i === 2
                          ? "#cd7f32"
                          : accent,
                }}
              >
                #{i + 1}
              </span>
              <span className="truncate text-[10px] text-cream normal-case">
                {b.login}
              </span>
            </span>
            <span className="ml-2 flex-shrink-0 text-[10px] text-muted">
              {((b[cat.key] as number) ?? 0).toLocaleString()}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const {
    buildings,
    plazas,
    decorations,
    flyMode,
    relicFocus,
    flyVehicle,
    endFly,
    themeIndex,
    dayNightCycleActive,
    weatherMode,
    setHud,
    setPlayerPos,
    districtZones,
    setDistrictAnnouncement,
    flyPausedAt,
    flyTotalPauseMs,
    setFlyPaused,
    flyScoreRef,
    setFlyScore,
    focusedBuilding,
    theme,
    setFocusedBuilding,
    selectedBuilding,
    comparePair,
    eArcadeOpen,
    setEArcadeOpen,
    zenCodingOpen,
    setZenCodingOpen,
    codeForgeOpen,
    setCodeForgeOpen,
    solanaOpen,
    setSolanaOpen,
    loadStage,
    equippedRelicId,
    skyAds,
    setAdToast,
    setClickedAd,
    introMode,
    endIntro,
    ghostPreviewLogin,
    liveByLogin,
    cityEnergy,
    multiplayerPlayers,
    raidState,
    raidActions,
    setPillModalOpen,
    setSelectedBuilding,
    setExploreMode,
    exploreMode,
    myBuilding,
    setSignInPromptVisible,
    session,
    onRabbitCaught,
    rabbitSighting,
    rabbitCinematic,
    endRabbitCinematic,
    mpChatMessages,
    mpSendChat,
    mpStatus,
    mpIsJoined,
    mpPlayerCount,
    loadProgress,
    loadError,
    handleLoadRetry,
    trackClientMission,
    lastDistrictRef,
    setLoadStage,
    setIntroMode,
    introPhase,
    flyPaused,
  } = useCity();

  // Local UI-only state refs for cooldowns and click thresholds
  const announceCooldownRef = useRef<number>(0);
  const announceTimerRef = useRef<any>(null);
  const buildingClickCountRef = useRef<Record<string, number>>({});
  const signInPromptShownRef = useRef<Set<string>>(new Set());
  const [flyPauseSignal, setFlyPauseSignal] = useState(0);

  const authLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const focusedBuildingB = comparePair ? comparePair[1].login : null;
  const celebrationActive = false;

  const handleLoadFadeComplete = useCallback(() => {
    setLoadStage("done");
    const hasDeepLink = searchParams.get("user") || searchParams.get("compare");
    if (!localStorage.getItem("leetcodecity_intro_seen") && !hasDeepLink) {
      setIntroMode(true);
    }
  }, [searchParams, setLoadStage, setIntroMode]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg font-pixel uppercase text-warm">
      {/* 3D Canvas */}
      <CityCanvas
        buildings={buildings}
        plazas={plazas}
        decorations={decorations}
        flyMode={flyMode}
        relicFocus={relicFocus}
        flyVehicle={flyVehicle}
        onExitFly={endFly}
        themeIndex={themeIndex}
        dayNightCycleActive={dayNightCycleActive}
        weatherMode={weatherMode}
        onHud={(s, a, x, z, yaw) => {
          setHud({ speed: s, altitude: a });
          const mapX = x - Math.sin(yaw) * 40;
          const mapZ = z - Math.cos(yaw) * 40;
          setPlayerPos({ x: mapX, z: mapZ });
          let nearestDistrict: string | null = null;
          let bestDist = Infinity;
          for (const b of buildings) {
            const dx = mapX - b.position[0],
              dz = mapZ - b.position[2];
            const dist = dx * dx + dz * dz;
            if (dist < bestDist) {
              bestDist = dist;
              nearestDistrict = b.district ?? "fullstack";
            }
          }
          const district = nearestDistrict
            ? (districtZones.find((d) => d.id === nearestDistrict) ?? null)
            : null;
          const now = Date.now();
          if (district && district.id !== lastDistrictRef.current) {
            lastDistrictRef.current = district.id;
            if (now - announceCooldownRef.current > 5000) {
              announceCooldownRef.current = now;
              clearTimeout(announceTimerRef.current);
              setDistrictAnnouncement({
                name: district.name,
                color: district.color,
                population: district.population,
              });
              announceTimerRef.current = setTimeout(
                () => setDistrictAnnouncement(null),
                3000,
              );
            }
          }
        }}
        onPause={(p) => {
          if (p) {
            flyPausedAt.current = Date.now();
          } else if (flyPausedAt.current > 0) {
            flyTotalPauseMs.current += Date.now() - flyPausedAt.current;
            flyPausedAt.current = 0;
          }
          setFlyPaused(p);
        }}
        onCollect={(score, earned, combo, collected, maxCombo) => {
          flyScoreRef.current = { score, earned, combo, collected, maxCombo };
          setFlyScore({ score, earned, combo, collected, maxCombo });
        }}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        accentColor={theme.accent}
        onClearFocus={() => setFocusedBuilding(null)}
        onBuildingFocus={(b) => setFocusedBuilding(b.login)}
        flyPauseSignal={flyPauseSignal}
        flyHasOverlay={!!selectedBuilding || eArcadeOpen || zenCodingOpen || codeForgeOpen}
        flyStartPaused={flyPaused}
        holdRise={loadStage !== "rendering" && loadStage !== "ready" && loadStage !== "done"}
        equippedRelicId={equippedRelicId}
        celebrationActive={celebrationActive}
        skyAds={skyAds}
        onAdClick={(ad) => {
          trackSkyAdClick(ad.id, ad.vehicle, ad.link);
          if (ad.link && isBuildingAd(ad.vehicle)) {
            const ctaHref = buildAdLink(ad) ?? ad.link;
            const isMailto = ad.link.startsWith("mailto:");
            trackAdEvents(
              ad.id,
              ["click", "cta_click"],
              authLogin || undefined,
            );
            trackSkyAdCtaClick(ad.id, ad.vehicle);
            track("sky_ad_click", {
              ad_id: ad.id,
              vehicle: ad.vehicle,
              brand: ad.brand ?? "",
            });
            if (isMailto) {
              window.location.href = ctaHref;
            } else {
              const a = document.createElement("a");
              a.href = ctaHref;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              a.click();
            }
            try {
              setAdToast(
                ad.brand || new URL(ad.link).hostname.replace("www.", ""),
              );
            } catch {
              setAdToast(ad.brand || ad.link);
            }
          } else {
            setClickedAd(ad);
            trackAdEvent(ad.id, "click", authLogin || undefined);
            track("sky_ad_click", {
              ad_id: ad.id,
              vehicle: ad.vehicle,
              brand: ad.brand ?? "",
            });
          }
        }}
        onAdViewed={(adId: string) => {
          trackSkyAdImpression(adId, "billboard");
        }}
        onBuildingClick={(b: CityBuilding) => {
          trackBuildingClicked(b.login);
          setFocusedBuilding(b.login);
          setSelectedBuilding(b);
          if (
            myBuilding?.district &&
            b.district &&
            b.district !== myBuilding.district
          ) {
            trackClientMission("explore_district");
          }
          if (flyMode) {
            setFlyPauseSignal((s) => s + 1);
          } else if (!exploreMode) {
            setExploreMode(true);
          }
          const clickCount = (buildingClickCountRef.current[b.login] || 0) + 1;
          buildingClickCountRef.current[b.login] = clickCount;
          if (!session && clickCount >= 3 && !signInPromptShownRef.current.has(b.login)) {
            signInPromptShownRef.current.add(b.login);
            setSignInPromptVisible(true);
          }
        }}
        ghostPreviewLogin={ghostPreviewLogin}
        liveByLogin={liveByLogin}
        cityEnergy={cityEnergy}
        multiplayerPlayers={multiplayerPlayers}
        raidPhase={raidState.phase}
        raidData={raidState.raidData}
        raidAttacker={raidState.attackerBuilding}
        raidDefender={raidState.defenderBuilding}
        onRaidPhaseComplete={raidActions.onPhaseComplete}
        onLandmarkClick={() => setPillModalOpen(true)}
        onEArcadeClick={() => setEArcadeOpen(true)}
        onSkyTempleClick={() => setZenCodingOpen(true)}
        onCodeForgeClick={() => setCodeForgeOpen(true)}
        onSolanaClick={() => setSolanaOpen(true)}
        onRabbitCaught={onRabbitCaught}
        rabbitSighting={rabbitSighting}
        rabbitCinematic={rabbitCinematic}
        onRabbitCinematicEnd={endRabbitCinematic}
      />

      <SearchBar />
      <ProfileCard />
      <ComparisonPanel />
      <FlyModeHUD />
      <RaidSystem />
      <CityHUD />
      <AuthManager />
      <SettingsPanel />
      <ModalsOverlay />

      {/* Multiplayer Chat Overlay */}
      {!introMode && !flyMode && (
        <CityChat
          messages={mpChatMessages}
          onSend={mpSendChat}
          status={mpStatus}
          isJoined={mpIsJoined}
          playerCount={mpPlayerCount}
          accentColor={theme.accent}
        />
      )}

      {/* Loading screen overlay */}
      {loadStage !== "done" && (
        <LoadingScreen
          stage={loadStage}
          progress={loadProgress}
          error={loadError}
          accentColor={theme.accent}
          onRetry={handleLoadRetry}
          onFadeComplete={handleLoadFadeComplete}
        />
      )}

      {/* Cinematic letterbox bars for Intro Flyover */}
      {introMode && (
        <div className="pointer-events-none fixed inset-0 z-50">
          <div
            className="absolute inset-x-0 top-0 origin-top bg-black/80 transition-transform duration-1000"
            style={{
              height: "12%",
              transform: introPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 origin-bottom bg-black/80 transition-transform duration-1000"
            style={{
              height: "12%",
              transform: introPhase >= 0 ? "scaleY(1)" : "scaleY(0)",
            }}
          />
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <ErrorBoundary fallback={
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-red-500 font-pixel text-center px-4">
          Something went wrong loading the city.
          <button
            onClick={() => window.location.reload()}
            className="block mx-auto mt-4 px-4 py-2 bg-[#ffa116] text-black font-pixel text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
    }>
      <WeatherProvider>
        <Suspense fallback={
          <div className="h-screen w-screen bg-black flex items-center justify-center">
            <div className="text-[#ffa116] font-pixel text-lg animate-pulse">
              Loading...
            </div>
          </div>
        }>
          <CityProvider>
            <HomeContent />
          </CityProvider>
        </Suspense>
      </WeatherProvider>
    </ErrorBoundary>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  generateCityLayout,
  type DeveloperRecord,
  type CityBuilding,
  type CityPlaza,
  type CityDecoration,
  type DistrictZone,
} from "@/lib/github";
import { STATIC_RELICS, type Relic } from "@/lib/relics";
import { useStreakCheckin } from "@/lib/useStreakCheckin";
import { useLiveUsers } from "@/lib/useLiveUsers";
import { useCodingPresence } from "@/lib/useCodingPresence";
import { useCityPresence } from "@/lib/multiplayer/useCityPresence";
import { useRaidSequence } from "@/lib/useRaidSequence";
import { useDailies } from "@/lib/useDailies";
import { getRaidConsumableToastMessage } from "@/lib/raid";
import type { CityPlayer, ConnectionStatus } from "@/lib/multiplayer/types";
import { LoadingStage } from "@/components/LoadingScreen";
import { DEFAULT_SKY_ADS, buildAdLink, trackAdEvent } from "@/lib/skyAds";
import { track } from "@vercel/analytics";
import {
  identifyUser,
  trackSignInClicked,
  trackBuildingClaimed,
  trackFreeItemClaimed,
  trackKudosSent,
  trackSearchUsed,
  trackSkyAdCtaClick,
  trackReferralLinkLanded,
  trackShareClicked,
  trackDisabledButtonClicked,
} from "@/lib/himetrica";
import { applyLocalStorageOverrides } from "@/lib/cityOverrides";
import { getCityCache, setCityCache, clearCityCache } from "@/lib/cityCache";

export type CityDeveloperRecord = DeveloperRecord & {
  loadout?: unknown;
  custom_color?: string | null;
  owned_items?: string[];
  billboard_images?: string[];
  building_style?: string | null;
  selected_title?: string | null;
};

export interface CityStats {
  total_developers: number;
  total_contributions: number;
  total_stars?: number;
  renewal_raised_inr?: number;
  renewal_target_inr?: number;
}

export const THEMES = [
  { name: "Midnight", accent: "#ffa116", shadow: "#cc8111" },
  { name: "Sunset", accent: "#ffa116", shadow: "#cc8111" },
  { name: "Neon", accent: "#e040c0", shadow: "#600860" },
  { name: "Emerald", accent: "#f0c060", shadow: "#806020" },
];

export const CELEBRATION_MILESTONES = [
  10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000,
];

export const PERMANENT_ERROR_CODES = new Set(["not-found", "org", "no-activity"]);

interface CityContextProps {
  // State
  username: string;
  setUsername: React.Dispatch<React.SetStateAction<string>>;
  buildings: CityBuilding[];
  setBuildings: React.Dispatch<React.SetStateAction<CityBuilding[]>>;
  plazas: CityPlaza[];
  setPlazas: React.Dispatch<React.SetStateAction<CityPlaza[]>>;
  decorations: CityDecoration[];
  setDecorations: React.Dispatch<React.SetStateAction<CityDecoration[]>>;
  districtZones: DistrictZone[];
  setDistrictZones: React.Dispatch<React.SetStateAction<DistrictZone[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  loadStage: LoadingStage;
  setLoadStage: React.Dispatch<React.SetStateAction<LoadingStage>>;
  loadProgress: number;
  loadError: string | null;
  setLoadError: React.Dispatch<React.SetStateAction<string | null>>;
  feedback: {
    type: "loading" | "error";
    code?:
      | "not-found"
      | "org"
      | "no-activity"
      | "rate-limit"
      | "github-rate-limit"
      | "network"
      | "generic";
    username?: string;
    raw?: string;
  } | null;
  setFeedback: React.Dispatch<React.SetStateAction<any>>;
  flyMode: boolean;
  setFlyMode: React.Dispatch<React.SetStateAction<boolean>>;
  flyVehicle: string;
  setFlyVehicle: React.Dispatch<React.SetStateAction<string>>;
  introMode: boolean;
  setIntroMode: React.Dispatch<React.SetStateAction<boolean>>;
  introPhase: number;
  setIntroPhase: React.Dispatch<React.SetStateAction<number>>;
  exploreMode: boolean;
  setExploreMode: React.Dispatch<React.SetStateAction<boolean>>;
  themeIndex: number;
  setThemeIndex: React.Dispatch<React.SetStateAction<number>>;
  isCodexOpen: boolean;
  setIsCodexOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRelicModalOpen: boolean;
  setIsRelicModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  eArcadeOpen: boolean;
  setEArcadeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  zenCodingOpen: boolean;
  setZenCodingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  codeForgeOpen: boolean;
  setCodeForgeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  solanaOpen: boolean;
  setSolanaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pillModalOpen: boolean;
  setPillModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  relics: Relic[];
  equippedRelicId: string | null;
  setEquippedRelicId: React.Dispatch<React.SetStateAction<string | null>>;
  relicFocus: { x: number; y: number; z: number } | null;
  setRelicFocus: React.Dispatch<React.SetStateAction<{ x: number; y: number; z: number } | null>>;
  dayNightCycleActive: boolean;
  setDayNightCycleActive: React.Dispatch<React.SetStateAction<boolean>>;
  weatherMode: "sunny" | "rainy" | "windy" | "stormy" | "snowy";
  setWeatherMode: React.Dispatch<React.SetStateAction<"sunny" | "rainy" | "windy" | "stormy" | "snowy">>;
  hud: { speed: number; altitude: number };
  setHud: React.Dispatch<React.SetStateAction<{ speed: number; altitude: number }>>;
  playerPos: { x: number; z: number };
  setPlayerPos: React.Dispatch<React.SetStateAction<{ x: number; z: number }>>;
  districtAnnouncement: { name: string; color: string; population: number } | null;
  setDistrictAnnouncement: React.Dispatch<React.SetStateAction<{ name: string; color: string; population: number } | null>>;
  flyPaused: boolean;
  setFlyPaused: React.Dispatch<React.SetStateAction<boolean>>;
  flyScore: { score: number; earned: number; combo: number; collected: number; maxCombo: number };
  setFlyScore: React.Dispatch<React.SetStateAction<{ score: number; earned: number; combo: number; collected: number; maxCombo: number }>>;
  flyPersonalBest: number;
  setFlyPersonalBest: React.Dispatch<React.SetStateAction<number>>;
  flyElapsedSec: number;
  setFlyElapsedSec: React.Dispatch<React.SetStateAction<number>>;
  quotaReached: boolean;
  setQuotaReached: React.Dispatch<React.SetStateAction<boolean>>;
  quotaNotified: boolean;
  setQuotaNotified: React.Dispatch<React.SetStateAction<boolean>>;
  quotaDismissed: boolean;
  setQuotaDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  stats: CityStats;
  githubStars: number;
  discordMembers: number | null;
  milestoneCelebrations: { milestone: number; reached_at: string }[];
  focusedBuilding: string | null;
  setFocusedBuilding: React.Dispatch<React.SetStateAction<string | null>>;
  selectedBuilding: CityBuilding | null;
  setSelectedBuilding: React.Dispatch<React.SetStateAction<CityBuilding | null>>;
  shareData: { login: string; contributions: number; rank: number | null; avatar_url: string | null } | null;
  setShareData: React.Dispatch<React.SetStateAction<{ login: string; contributions: number; rank: number | null; avatar_url: string | null } | null>>;
  copied: boolean;
  setCopied: React.Dispatch<React.SetStateAction<boolean>>;
  vsCodeKey: string | null;
  setVsCodeKey: React.Dispatch<React.SetStateAction<string | null>>;
  hasVsCodeKey: boolean | null;
  setHasVsCodeKey: React.Dispatch<React.SetStateAction<boolean | null>>;
  vsCodeKeyLoading: boolean;
  setVsCodeKeyLoading: React.Dispatch<React.SetStateAction<boolean>>;
  vsCodeKeyCopied: boolean;
  setVsCodeKeyCopied: React.Dispatch<React.SetStateAction<boolean>>;
  codingPanelOpen: boolean;
  setCodingPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  session: Session | null;
  sessionResolved: boolean;
  claiming: boolean;
  purchasedItem: string | null;
  buildingCardLoading: boolean;
  setBuildingCardLoading: React.Dispatch<React.SetStateAction<boolean>>;
  giftClaimed: boolean;
  setGiftClaimed: React.Dispatch<React.SetStateAction<boolean>>;
  claimingGift: boolean;
  feedEvents: any[];
  setFeedEvents: React.Dispatch<React.SetStateAction<any[]>>;
  feedPanelOpen: boolean;
  setFeedPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  analyticsOpen: boolean;
  setAnalyticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  kudosSending: boolean;
  kudosSent: boolean;
  kudosError: string | null;
  compareBuilding: CityBuilding | null;
  setCompareBuilding: React.Dispatch<React.SetStateAction<CityBuilding | null>>;
  comparePair: [CityBuilding, CityBuilding] | null;
  setComparePair: React.Dispatch<React.SetStateAction<[CityBuilding, CityBuilding] | null>>;
  compareSelfHint: boolean;
  setCompareSelfHint: React.Dispatch<React.SetStateAction<boolean>>;
  giftModalOpen: boolean;
  setGiftModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  giftItems: { id: string; price_usd_cents: number; owned: boolean }[] | null;
  setGiftItems: React.Dispatch<React.SetStateAction<{ id: string; price_usd_cents: number; owned: boolean }[] | null>>;
  giftBuying: string | null;
  compareCopied: boolean;
  setCompareCopied: React.Dispatch<React.SetStateAction<boolean>>;
  compareLang: "en" | "pt";
  setCompareLang: React.Dispatch<React.SetStateAction<"en" | "pt">>;
  clickedAd: any;
  setClickedAd: React.Dispatch<React.SetStateAction<any>>;
  skyAds: any[];
  arcadeOnline: number;
  districtChooserOpen: boolean;
  setDistrictChooserOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rabbitCinematic: boolean;
  setRabbitCinematic: React.Dispatch<React.SetStateAction<boolean>>;
  rabbitCinematicPhase: number;
  setRabbitCinematicPhase: React.Dispatch<React.SetStateAction<number>>;
  rabbitProgress: number;
  rabbitSighting: number | null;
  setRabbitSighting: React.Dispatch<React.SetStateAction<number | null>>;
  rabbitCompletion: boolean;
  setRabbitCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  rabbitHintFlash: string | null;
  setRabbitHintFlash: React.Dispatch<React.SetStateAction<string | null>>;
  signInPromptVisible: boolean;
  setSignInPromptVisible: React.Dispatch<React.SetStateAction<boolean>>;
  adToast: string | null;
  setAdToast: React.Dispatch<React.SetStateAction<string | null>>;
  refreshingStats: boolean;
  welcomeCtaVisible: boolean;
  levelUpLevel: number | null;
  setLevelUpLevel: React.Dispatch<React.SetStateAction<number | null>>;
  giftedInfo: { item: string; to: string } | null;
  setGiftedInfo: React.Dispatch<React.SetStateAction<{ item: string; to: string } | null>>;
  showDailyNudge: boolean;
  setShowDailyNudge: React.Dispatch<React.SetStateAction<boolean>>;
  showFlyHint: boolean;
  setShowFlyHint: React.Dispatch<React.SetStateAction<boolean>>;
  showFlyControls: boolean;
  setShowFlyControls: React.Dispatch<React.SetStateAction<boolean>>;
  showFlyResults: {
    score: number;
    collected: number;
    maxCombo: number;
    timeBonus: number;
    isNewPB: boolean;
    rank: number;
    totalPilots: number;
  } | null;
  setShowFlyResults: React.Dispatch<React.SetStateAction<any>>;
  ghostPreviewLogin: string | null;
  setGhostPreviewLogin: React.Dispatch<React.SetStateAction<string | null>>;
  selfLogin: string;
  authLogin: string;
  raidState: any;
  raidActions: any;
  raidToast: string | null;
  isMobile: boolean;
  theme: { name: string; accent: string; shadow: string };
  linkedLeetCodeUsername: string | null;
  linkStatusResolved: boolean;
  identityResolved: boolean;
  showLinkModal: boolean;
  setShowLinkModal: React.Dispatch<React.SetStateAction<boolean>>;
  linkInput: string;
  setLinkInput: React.Dispatch<React.SetStateAction<string>>;
  confirmedUsername: string;
  setConfirmedUsername: React.Dispatch<React.SetStateAction<string>>;
  linking: boolean;
  linkError: string;
  expectedToken: string;
  resetting: boolean;
  resetMsg: string;
  setResetMsg: React.Dispatch<React.SetStateAction<string>>;
  myBuilding: CityBuilding | null;
  needsToLink: boolean;
  shopHref: string;
  hasFreeGift: boolean;
  shouldShowDistrictChooser: boolean;
  streakData: any;
  dailiesData: any;
  dailyToasts: any[];
  liveUsers: number;
  liveStatus: string;
  codingCount: number;
  liveByLogin: Map<string, any>;
  multiplayerPlayers: Map<string, CityPlayer>;
  mpPlayerCount: number;
  mpChatMessages: any[];
  mpStatus: ConnectionStatus;
  mpSendChat: (content: string) => void;
  mpSendMove: (cx: number, cy: number, cz: number, focusedBuilding: string | null) => void;
  mpIsJoined: boolean;
  effectiveLiveCount: number;
  effectiveLiveStatus: string;
  cityEnergy: number;
  welcomeCtaVisibleRef: React.MutableRefObject<boolean>;
  ghostPreviewShownRef: React.MutableRefObject<boolean>;
  mountedRef: React.MutableRefObject<boolean>;
  generateControllerRef: React.MutableRefObject<AbortController | null>;
  flyScoreRef: React.MutableRefObject<any>;
  flyHintTimerRef: React.MutableRefObject<any>;
  flyResultsTimerRef: React.MutableRefObject<any>;
  dailyNudgeTimerRef: React.MutableRefObject<any>;
  lastDistrictRef: React.MutableRefObject<string | null>;
  flyPersonalBestRef: React.MutableRefObject<number>;
  flyStartTime: React.MutableRefObject<number>;
  flyPausedAt: React.MutableRefObject<number>;
  flyTotalPauseMs: React.MutableRefObject<number>;
  announceTimerRef: React.MutableRefObject<any>;
  failedUsernamesRef: React.MutableRefObject<Map<string, { code: string; timestamp: number }>>;
  rawDevsRef: React.MutableRefObject<CityDeveloperRecord[]>;

  // Callbacks / Action Handlers
  cycleWeather: () => void;
  cycleTheme: () => void;
  endFly: (aborted?: boolean) => void;
  endIntro: () => void;
  replayIntro: () => void;
  onRabbitCaught: () => Promise<void>;
  reloadCity: (bustCache?: boolean) => Promise<CityBuilding[] | null>;
  handleGiveKudos: () => Promise<void>;
  handleOpenGift: () => Promise<void>;
  handleGiftCheckout: (itemId: string) => Promise<void>;
  handleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  handleVerifyLeetCode: (e: React.FormEvent) => Promise<void>;
  handleResetClaim: () => Promise<void>;
  handleRefreshStats: () => Promise<void>;
  handleClaimFreeGift: () => Promise<void>;
  claimDailies: () => Promise<{ ok: boolean; streak: number; total: number; freeze_granted: boolean } | null>;
  refreshDailies: () => Promise<void>;
  trackClientMission: (missionId: string, value?: number) => void;
  endRabbitCinematic: () => void;
  handleEquipRelic: (relicId: string | null) => Promise<void>;
  handleLoadRetry: () => void;
}

const CityContext = createContext<CityContextProps | undefined>(undefined);

export function CityProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");
  const giftedParam = searchParams.get("gifted");

  const [username, setUsername] = useState("");
  const failedUsernamesRef = useRef<Map<string, { code: string; timestamp: number }>>(new Map());
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const rawDevsRef = useRef<CityDeveloperRecord[]>([]);
  const [plazas, setPlazas] = useState<CityPlaza[]>([]);
  const [decorations, setDecorations] = useState<CityDecoration[]>([]);
  const [districtZones, setDistrictZones] = useState<DistrictZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState<LoadingStage>("init");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "loading" | "error";
    code?:
      | "not-found"
      | "org"
      | "no-activity"
      | "rate-limit"
      | "github-rate-limit"
      | "network"
      | "generic";
    username?: string;
    raw?: string;
  } | null>(null);

  const [flyMode, setFlyMode] = useState(false);
  const [flyVehicle, setFlyVehicle] = useState<string>("airplane");
  const [introMode, setIntroMode] = useState(false);
  const [introPhase, setIntroPhase] = useState(-1);
  const [exploreMode, setExploreMode] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [isRelicModalOpen, setIsRelicModalOpen] = useState(false);
  const [eArcadeOpen, setEArcadeOpen] = useState(false);
  const [zenCodingOpen, setZenCodingOpen] = useState(false);
  const [codeForgeOpen, setCodeForgeOpen] = useState(false);
  const [solanaOpen, setSolanaOpen] = useState(false);
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const [relics, setRelics] = useState<Relic[]>(STATIC_RELICS);
  const [equippedRelicId, setEquippedRelicId] = useState<string | null>(null);
  const [relicFocus, setRelicFocus] = useState<{ x: number; y: number; z: number } | null>(null);

  const [dayNightCycleActive, setDayNightCycleActive] = useState(true);
  const [weatherMode, setWeatherMode] = useState<"sunny" | "rainy" | "windy" | "stormy" | "snowy">("sunny");

  const [hud, setHud] = useState({ speed: 0, altitude: 0 });
  const [playerPos, setPlayerPos] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [districtAnnouncement, setDistrictAnnouncement] = useState<{ name: string; color: string; population: number } | null>(null);

  const lastDistrictRef = useRef<string | null>(null);
  const announceTimerRef = useRef<any>(undefined);
  const announceCooldownRef = useRef(0);

  const [flyPaused, setFlyPaused] = useState(false);
  const [flyScore, setFlyScore] = useState({ score: 0, earned: 0, combo: 0, collected: 0, maxCombo: 1 });
  const flyScoreRef = useRef({ score: 0, earned: 0, combo: 0, collected: 0, maxCombo: 1 });
  const [flyPersonalBest, setFlyPersonalBest] = useState(0);
  const flyPersonalBestRef = useRef(0);
  const flyStartTime = useRef(0);
  const flyPausedAt = useRef(0);
  const flyTotalPauseMs = useRef(0);
  const [flyElapsedSec, setFlyElapsedSec] = useState(0);

  const [quotaReached, setQuotaReached] = useState(false);
  const [quotaNotified, setQuotaNotified] = useState(false);
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  const [stats, setStats] = useState<CityStats>({ total_developers: 0, total_contributions: 0 });
  const [githubStars, setGithubStars] = useState<number>(0);
  const [discordMembers, setDiscordMembers] = useState<number | null>(null);
  const [milestoneCelebrations, setMilestoneCelebrations] = useState<{ milestone: number; reached_at: string }[]>([]);
  const [focusedBuilding, setFocusedBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);

  const [shareData, setShareData] = useState<{ login: string; contributions: number; rank: number | null; avatar_url: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [vsCodeKey, setVsCodeKey] = useState<string | null>(null);
  const [hasVsCodeKey, setHasVsCodeKey] = useState<boolean | null>(() => {
    try {
      return localStorage.getItem("leetcodecity_has_vscode_key") === "1" ? true : null;
    } catch {
      // localStorage can be unavailable in privacy-restricted browsers.
      return null;
    }
  });
  const [vsCodeKeyLoading, setVsCodeKeyLoading] = useState(false);
  const [vsCodeKeyCopied, setVsCodeKeyCopied] = useState(false);
  const [codingPanelOpen, setCodingPanelOpen] = useState(false);
  const mountedRef = useRef(true);
  const touchYRef = useRef<number | null>(null);
  const generateControllerRef = useRef<AbortController | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [purchasedItem, setPurchasedItem] = useState<string | null>(null);
  const [buildingCardLoading, setBuildingCardLoading] = useState(false);
  const [giftClaimed, setGiftClaimed] = useState(false);
  const [claimingGift, setClaimingGift] = useState(false);
  const [feedEvents, setFeedEvents] = useState<any[]>([]);
  const [feedPanelOpen, setFeedPanelOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [kudosSending, setKudosSending] = useState(false);
  const [kudosSent, setKudosSent] = useState(false);
  const [kudosError, setKudosError] = useState<string | null>(null);

  const [compareBuilding, setCompareBuilding] = useState<CityBuilding | null>(null);
  const [comparePair, setComparePair] = useState<[CityBuilding, CityBuilding] | null>(null);
  const [compareSelfHint, setCompareSelfHint] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftItems, setGiftItems] = useState<{ id: string; price_usd_cents: number; owned: boolean }[] | null>(null);
  const [giftBuying, setGiftBuying] = useState<string | null>(null);
  const [compareCopied, setCompareCopied] = useState(false);
  const [compareLang, setCompareLang] = useState<"en" | "pt">("en");
  const [clickedAd, setClickedAd] = useState<any | null>(null);
  const [skyAds, setSkyAds] = useState<any[]>(DEFAULT_SKY_ADS);
  const [arcadeOnline, setArcadeOnline] = useState<number>(0);
  const [districtChooserOpen, setDistrictChooserOpen] = useState(false);
  const [rabbitCinematic, setRabbitCinematic] = useState(false);
  const [rabbitCinematicPhase, setRabbitCinematicPhase] = useState(-1);
  const [rabbitProgress, setRabbitProgress] = useState(0);
  const [rabbitSighting, setRabbitSighting] = useState<number | null>(null);
  const [rabbitCompletion, setRabbitCompletion] = useState(false);
  const [rabbitHintFlash, setRabbitHintFlash] = useState<string | null>(null);

  const [signInPromptVisible, setSignInPromptVisible] = useState(false);
  const [adToast, setAdToast] = useState<string | null>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [welcomeCtaVisible, setWelcomeCtaVisible] = useState(false);
  const welcomeCtaVisibleRef = useRef(false);

  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [giftedInfo, setGiftedInfo] = useState<{ item: string; to: string } | null>(null);
  const [showDailyNudge, setShowDailyNudge] = useState(false);
  const [showFlyHint, setShowFlyHint] = useState(false);
  const [showFlyControls, setShowFlyControls] = useState(false);
  const [showFlyResults, setShowFlyResults] = useState<{
    score: number;
    collected: number;
    maxCombo: number;
    timeBonus: number;
    isNewPB: boolean;
    rank: number;
    totalPilots: number;
  } | null>(null);

  const dailyNudgeTimerRef = useRef<any>(undefined);
  const flyHintTimerRef = useRef<any>(undefined);
  const flyResultsTimerRef = useRef<any>(undefined);

  const ghostPreviewShownRef = useRef(false);
  const [ghostPreviewLogin, setGhostPreviewLogin] = useState<string | null>(null);

  const [raidState, raidActions] = useRaidSequence();
  const [raidToast, setRaidToast] = useState<string | null>(null);
  const lastRaidToastIdRef = useRef<string | null>(null);
  const prevRaidPhaseRef = useRef<string>("idle");
  const lastSuccessfulRaidRef = useRef<{
    defenderLogin: string;
    attackerLogin: string;
    tagStyle: string;
  } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const theme = THEMES[themeIndex];
  const didInit = useRef(false);
  const savedFocusRef = useRef<string | null>(null);

  const [linkedLeetCodeUsername, setLinkedLeetCodeUsername] = useState<string | null>(null);
  const [linkStatusResolved, setLinkStatusResolved] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [confirmedUsername, setConfirmedUsername] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    if (giftedParam && userParam) {
      setGiftedInfo({ item: giftedParam, to: userParam });
      const timer = setTimeout(() => setGiftedInfo(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [giftedParam, userParam]);

  const expectedToken = useMemo(() => {
    return session?.user?.id
      ? "LCC-" + session.user.id.split("-")[0].toUpperCase()
      : "Linking...";
  }, [session?.user?.id]);

  const cycleWeather = () => {
    const modes: ("sunny" | "rainy" | "windy" | "stormy" | "snowy")[] = ["sunny", "rainy", "windy", "stormy", "snowy"];
    const idx = modes.indexOf(weatherMode);
    const next = modes[(idx + 1) % modes.length];
    setWeatherMode(next);
    try {
      localStorage.setItem("leetcodecity_weather_mode", next);
    } catch (err) {
      console.warn("[cycleWeather] Failed to persist weather mode:", err);
    }
  };

  const cycleTheme = useCallback(() => {
    setThemeIndex((i) => {
      const next = (i + 1) % THEMES.length;
      localStorage.setItem("leetcodecity_theme", String(next));
      if (session?.user?.id) {
        fetch("/api/preferences/theme", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city_theme: next }),
        }).catch(() => { });
      }
      return next;
    });
  }, [session?.user?.id]);

  const authLogin = useMemo(() => {
    return (
      session?.user?.user_metadata?.user_name ??
      session?.user?.user_metadata?.preferred_username ??
      session?.user?.user_metadata?.login ??
      session?.user?.user_metadata?.full_name ??
      ""
    ).toLowerCase();
  }, [session]);

  const selfLogin = useMemo(() => {
    return (linkedLeetCodeUsername ?? authLogin).toLowerCase();
  }, [linkedLeetCodeUsername, authLogin]);

  const identityResolved = sessionResolved && (!session || linkStatusResolved);

  const isOwnBuilding = useMemo(() => {
    return (
      !!selectedBuilding &&
      !!linkedLeetCodeUsername &&
      selectedBuilding.login.toLowerCase() === linkedLeetCodeUsername.toLowerCase()
    );
  }, [selectedBuilding, linkedLeetCodeUsername]);

  const myBuilding = useMemo(() => {
    return linkedLeetCodeUsername
      ? (buildings.find(
          (b) => b.login.toLowerCase() === linkedLeetCodeUsername.toLowerCase(),
        ) ?? null)
      : null;
  }, [linkedLeetCodeUsername, buildings]);

  const needsToLink = !!session && !linkedLeetCodeUsername;

  const shopHref = useMemo(() => {
    return session && myBuilding?.claimed ? `/shop/${myBuilding.login}` : "/shop";
  }, [session, myBuilding?.claimed, myBuilding?.login]);

  const hasFreeGift = useMemo(() => {
    return !!session && !!myBuilding?.claimed && !myBuilding.owned_items.includes("flag");
  }, [session, myBuilding?.claimed, myBuilding?.owned_items]);

  const shouldShowDistrictChooser = useMemo(() => {
    return !!session && !!myBuilding?.claimed && !myBuilding.district_chosen;
  }, [session, myBuilding?.claimed, myBuilding?.district_chosen]);

  // Streak & Dailies checkins
  const { streakData } = useStreakCheckin(session, !!myBuilding?.claimed);
  const {
    data: dailiesData,
    trackClientMission,
    claim: claimDailies,
    refresh: refreshDailies,
    toasts: dailyToasts,
  } = useDailies(session, !!myBuilding?.claimed);

  const trackMissionRef = useRef(trackClientMission);
  trackMissionRef.current = trackClientMission;

  const quotaMissionCompleted = useMemo(() => {
    return dailiesData?.missions.some(
      (mission) => mission.id === "fly_score_50" && mission.completed,
    );
  }, [dailiesData?.missions]);

  // Live Users & presence
  const { count: liveUsers, status: liveStatus } = useLiveUsers();
  const { liveCount: codingCount, liveByLogin } = useCodingPresence();
  const mpLogin = selfLogin || null;
  const mpAvatarUrl = myBuilding?.avatar_url ?? session?.user?.user_metadata?.avatar_url ?? null;
  const {
    players: multiplayerPlayers,
    playerCount: mpPlayerCount,
    chatMessages: mpChatMessages,
    status: mpStatus,
    sendChat: mpSendChat,
    sendMove: mpSendMove,
    isJoined: mpIsJoined,
  } = useCityPresence(mpLogin, mpAvatarUrl);

  const effectiveLiveCount = mpStatus === "connected" && mpPlayerCount > 0
    ? mpPlayerCount
    : liveUsers;
  const effectiveLiveStatus = mpStatus === "connected" ? "connected" : liveStatus;

  const cityEnergy = useMemo(() => {
    if (codingCount === 0) return 0.15;
    if (codingCount === 1) return 0.4;
    if (codingCount === 2) return 0.55;
    if (codingCount <= 5) return 0.55 + (codingCount - 2) * 0.12;
    if (codingCount <= 15) return 1.0 + (Math.min(codingCount, 15) - 5) * 0.02;
    return Math.min(1.4, 1.2 + (codingCount - 15) * 0.02);
  }, [codingCount]);

  const reloadCity = useCallback(async (bustCache = false) => {
    if (bustCache) clearCityCache();
    const cacheBust = bustCache ? `?_t=${Date.now()}` : "";
    let allDevs: CityDeveloperRecord[] = [];
    let cityStats: CityStats = { total_developers: 0, total_contributions: 0 };

    try {
      const v = Math.floor(Date.now() / 300_000);
      const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
      const snapshotUrl = `${supabaseUrl}/storage/v1/object/public/city-data/snapshot.json?v=${v}${cacheBust ? `&_t=${Date.now()}` : ""}`;
      const snapshotRes = await fetch(snapshotUrl);
      if (snapshotRes.ok) {
        const snapshot = await snapshotRes.json();
        allDevs = snapshot.developers;
        cityStats = snapshot.stats;
      }
    } catch (err) {
      console.warn("[city] Snapshot fetch failed; falling back to chunked city data.", err);
    }

    if (allDevs.length === 0) {
      const cbParam = bustCache ? `&_t=${Date.now()}` : "";
      const CHUNK = 1000;
      const res = await fetch(`/api/city?from=0&to=${CHUNK}${cbParam}`);
      if (!res.ok) return null;
      const data = await res.json();
      allDevs = data.developers ?? [];
      cityStats = data.stats;
      const total = cityStats?.total_developers ?? 0;
      if (total > CHUNK && allDevs.length > 0) {
        for (let i = CHUNK; i < total; i += CHUNK * 3) {
          const batchPromises: Promise<{ developers: any[] } | null>[] = [];
          for (let j = 0; j < 3; j++) {
            const from = i + j * CHUNK;
            if (from >= total) break;
            batchPromises.push(
              fetch(`/api/city?from=${from}&to=${from + CHUNK}${cbParam}`).then((r) => (r.ok ? r.json() : null))
            );
          }
          const results = await Promise.all(batchPromises);
          for (const chunk of results) {
            if (chunk?.developers?.length) {
              allDevs = [...allDevs, ...chunk.developers];
            }
          }
        }
      }
    }

    if (allDevs.length === 0) return null;
    applyLocalStorageOverrides(allDevs);
    rawDevsRef.current = allDevs;
    setStats(cityStats);
    const layout = generateCityLayout(allDevs);
    setBuildings(layout.buildings);
    setPlazas(layout.plazas);
    setDecorations(layout.decorations);
    setDistrictZones(layout.districtZones);
    setCityCache({ ...layout, stats: cityStats });
    return layout.buildings;
  }, []);

  const endFly = useCallback(
    (aborted = false) => {
      const currentScore = flyScoreRef.current;
      const wallMs = Date.now() - flyStartTime.current;
      const currentPauseMs = flyPausedAt.current > 0 ? Date.now() - flyPausedAt.current : 0;
      const flightMs = Math.max(0, wallMs - flyTotalPauseMs.current - currentPauseMs);
      const FLY_TIME_LIMIT = 900;
      const timeFraction = !aborted && currentScore.collected > 0 ? Math.max(0, (FLY_TIME_LIMIT - flightMs / 1000) / FLY_TIME_LIMIT) : 0;
      const timeBonus = Math.floor(currentScore.score * 0.5 * timeFraction);
      const finalScore = currentScore.score + timeBonus;

      if (finalScore > 0) {
        trackMissionRef.current("fly_score_50", finalScore);
        trackMissionRef.current("fly_score_150", finalScore);
      }

      let currentPB = flyPersonalBestRef.current;
      try {
        currentPB = Math.max(
          currentPB,
          parseInt(localStorage.getItem("leetcodecity_fly_pb") || "0", 10) || 0
        );
      } catch (err) {
        console.warn("[fly] Failed to read personal best from localStorage:", err);
      }

      const isNewPB = currentPB > 0 && finalScore > currentPB;
      if (isNewPB) {
        setFlyPersonalBest(finalScore);
        flyPersonalBestRef.current = finalScore;
        try {
          localStorage.setItem("leetcodecity_fly_pb", String(finalScore));
        } catch (err) {
          console.warn("[fly] Failed to save new personal best:", err);
        }
      }

      if (finalScore > 0) {
        try {
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 0);
          const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
          const currentSeed = `${now.getFullYear()}-${dayOfYear}`;
          const raw = localStorage.getItem("leetcodecity_fly_history");
          const hist = raw
            ? JSON.parse(raw)
            : { seeds: {}, currentStreak: 0, longestStreak: 0, lastPlayedSeed: "" };
          const prev = hist.seeds[currentSeed];
          hist.seeds[currentSeed] = {
            bestScore: Math.max(prev?.bestScore ?? 0, finalScore),
            playCount: (prev?.playCount ?? 0) + 1,
          };
          if (hist.lastPlayedSeed !== currentSeed) {
            const yesterdayDay = dayOfYear - 1;
            const yesterdaySeed = yesterdayDay >= 1 ? `${now.getFullYear()}-${yesterdayDay}` : `${now.getFullYear() - 1}-365`;
            if (hist.lastPlayedSeed === yesterdaySeed) {
              hist.currentStreak = (hist.currentStreak || 0) + 1;
            } else {
              hist.currentStreak = 1;
            }
            hist.lastPlayedSeed = currentSeed;
          }
          hist.longestStreak = Math.max(hist.longestStreak || 0, hist.currentStreak);
          localStorage.setItem("leetcodecity_fly_history", JSON.stringify(hist));
        } catch (err) {
          console.warn("[fly] Failed to update fly history/streak data:", err);
        }
      }

      setFlyMode(false);
      setFlyPaused(false);
      lastDistrictRef.current = null;
      setDistrictAnnouncement(null);
      clearTimeout(announceTimerRef.current);
      setQuotaReached(false);
      setQuotaNotified(false);
      setQuotaDismissed(false);
      setFlyElapsedSec(0);

      if (finalScore > 0) {
        const captured = {
          score: finalScore,
          collected: currentScore.collected,
          maxCombo: currentScore.maxCombo,
          timeBonus,
          isNewPB,
        };
        setShowFlyResults({ ...captured, rank: 0, totalPilots: 0 });
        if (flyResultsTimerRef.current) clearTimeout(flyResultsTimerRef.current);
        flyResultsTimerRef.current = setTimeout(() => setShowFlyResults(null), 12000);

        if (session) {
          const maxComboVal = Math.min(Math.max(currentScore.maxCombo, 1), 3);
          fetch("/api/fly-scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              score: finalScore,
              collected: currentScore.collected,
              max_combo: maxComboVal,
              flight_ms: flightMs,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.rank_today != null) {
                setShowFlyResults((prev: any) =>
                  prev ? { ...prev, rank: d.rank_today, totalPilots: d.total } : null
                );
              }
            })
            .catch(() => { });
        }
      }
    },
    [session]
  );

  const endIntro = useCallback(() => {
    setIntroMode(false);
    setIntroPhase(-1);
    localStorage.setItem("leetcodecity_intro_seen", "true");
    if (!session && !localStorage.getItem("leetcodecity_welcome_seen")) {
      setWelcomeCtaVisible(true);
      welcomeCtaVisibleRef.current = true;
      setTimeout(() => {
        setWelcomeCtaVisible(false);
        welcomeCtaVisibleRef.current = false;
      }, 12000);
    }
  }, [session]);

  const replayIntro = useCallback(() => {
    setIntroMode(true);
    setIntroPhase(-1);
  }, []);

  const endRabbitCinematic = useCallback(() => {
    setRabbitCinematic(false);
    setRabbitCinematicPhase(-1);
  }, []);

  const handleSignIn = useCallback(async () => {
    trackSignInClicked("city");
    const supabase = createBrowserSupabase();
    let redirectTo = `${window.location.origin}/auth/callback`;
    try {
      const raw = localStorage.getItem("gc_ref");
      if (raw) {
        const { login, expires } = JSON.parse(raw);
        if (Date.now() < expires && login) {
          redirectTo += `?ref=${encodeURIComponent(login)}`;
        }
      }
    } catch (err) {
      console.warn("[auth] Failed to read referral metadata before GitHub login.", err);
    }
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setSession(null);
    setLinkedLeetCodeUsername(null);
  };

  const onRabbitCaught = useCallback(async () => {
    if (!rabbitSighting) return;
    const sighting = rabbitSighting;
    setRabbitSighting(null);

    const login = (session?.user?.user_metadata?.user_name ?? "").toLowerCase();
    const claimed = login && buildings.some((b) => b.login.toLowerCase() === login && b.claimed);
    if (session && claimed) {
      try {
        const res = await fetch("/api/rabbit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sighting }),
        });
        const data = await res.json();
        if (res.ok) {
          setRabbitProgress(data.progress);
          localStorage.setItem("leetcodecity_rabbit_progress", String(data.progress));
          if (data.completed) {
            setRabbitCompletion(true);
            return;
          }
          setRabbitHintFlash("The rabbit moves deeper...");
          setTimeout(() => setRabbitSighting(data.progress + 1), 2000);
          return;
        }
      } catch (err) {
        console.warn("[rabbit] Failed to sync rabbit sighting progress.", err);
      }
    }

    const newProgress = sighting;
    setRabbitProgress(newProgress);
    localStorage.setItem("leetcodecity_rabbit_progress", String(newProgress));

    if (sighting >= 5) {
      handleSignIn();
      return;
    }

    setRabbitHintFlash("The rabbit moves deeper...");
    setTimeout(() => setRabbitSighting(newProgress + 1), 2000);
  }, [rabbitSighting, session, buildings, handleSignIn]);

  const handleGiveKudos = useCallback(async () => {
    if (!identityResolved) return;
    if (!selectedBuilding || kudosSending || kudosSent || !session) return;
    if (isOwnBuilding) return;
    setKudosSending(true);
    setKudosError(null);
    try {
      const res = await fetch("/api/interactions/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_login: selectedBuilding.login }),
      });
      if (res.ok) {
        trackKudosSent(selectedBuilding.login);
        trackMissionRef.current("give_kudos");
        trackMissionRef.current("give_kudos_3");
        setKudosSent(true);
        const newCount = (selectedBuilding.kudos_count ?? 0) + 1;
        setSelectedBuilding({ ...selectedBuilding, kudos_count: newCount });
        setBuildings((prev) =>
          prev.map((b) => (b.login === selectedBuilding.login ? { ...b, kudos_count: newCount } : b))
        );
        setTimeout(() => setKudosSent(false), 3000);
      } else {
        const body = await res.json().catch(() => null);
        const msg = body?.error || "Could not send kudos";
        setKudosError(msg);
        setTimeout(() => setKudosError(null), 3000);
      }
    } catch (err) {
      console.warn("[kudos] Failed to send kudos.", err);
    } finally {
      setKudosSending(false);
    }
  }, [selectedBuilding, kudosSending, kudosSent, session, isOwnBuilding, identityResolved]);

  const handleOpenGift = useCallback(async () => {
    if (!identityResolved || !selectedBuilding || !session) return;
    setGiftModalOpen(true);
    setGiftItems(null);
    try {
      const res = await fetch("/api/items");
      if (!res.ok) return;
      const { items } = await res.json();
      const receiverOwned = new Set(selectedBuilding.owned_items ?? []);
      const NON_GIFTABLE = new Set(["flag", "custom_color"]);
      const available = (items as any[])
        .filter((i) => i.price_usd_cents > 0 && !NON_GIFTABLE.has(i.id))
        .map((i) => ({ ...i, owned: receiverOwned.has(i.id) }));
      setGiftItems(available);
    } catch (err) {
      console.warn("[gifts] Failed to load giftable avatar items.", err);
    }
  }, [selectedBuilding, session, identityResolved]);

  const handleGiftCheckout = useCallback(
    async (itemId: string) => {
      if (!selectedBuilding || giftBuying) return;
      setGiftBuying(itemId);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: itemId,
            provider: "stripe",
            gifted_to_login: selectedBuilding.login,
          }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        }
      } catch (err) {
        console.warn("[gifts] Failed to start gift checkout.", err);
      } finally {
        setGiftBuying(null);
      }
    },
    [selectedBuilding, giftBuying]
  );

  const handleVerifyLeetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setLinking(true);
    setLinkError("");
    try {
      const res = await fetch("/api/verify-leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leetcode_username: linkInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setLinkedLeetCodeUsername(data.leetcode_username);
      setShowLinkModal(false);
      trackBuildingClaimed(data.leetcode_username);
      await reloadCity();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLinking(false);
    }
  };

  const handleResetClaim = async () => {
    if (!confirm("Reset your claimed building? You'll be able to link a new GitHub account.")) return;
    setResetting(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/reset-claim", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setLinkedLeetCodeUsername(null);
      setResetMsg(data.message || "Claim reset. You can now link a new GitHub account.");
      await reloadCity();
    } catch (err) {
      setResetMsg("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setResetting(false);
    }
  };

  const handleRefreshStats = async () => {
    if (!selectedBuilding) return;
    setRefreshingStats(true);
    try {
      const res = await fetch(
        `/api/dev/${encodeURIComponent(selectedBuilding.login)}?refresh=true&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to refresh stats");
      const devData = await res.json();
      const foundIdx = rawDevsRef.current.findIndex(
        (d) => d.github_login.toLowerCase() === devData.github_login.toLowerCase()
      );
      if (foundIdx !== -1) {
        rawDevsRef.current[foundIdx] = { ...rawDevsRef.current[foundIdx], ...devData };
        const layout = generateCityLayout(rawDevsRef.current);
        setBuildings(layout.buildings);
        const updated = layout.buildings.find((b) => b.login.toLowerCase() === selectedBuilding.login.toLowerCase());
        if (updated) setSelectedBuilding(updated);
      }
    } catch (err) {
    } finally {
      setRefreshingStats(false);
    }
  };

  const handleClaimFreeGift = async () => {
    if (claimingGift) return;
    setClaimingGift(true);
    try {
      const res = await fetch("/api/claim-free-item", { method: "POST" });
      if (res.ok) {
        trackFreeItemClaimed();
        await reloadCity();
        setGiftClaimed(true);
      }
    } finally {
      setClaimingGift(false);
    }
  };

  const handleEquipRelic = async (relicId: string | null) => {
    try {
      const res = await fetch("/api/relics/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relicId }),
      });
      if (res.ok) {
        setEquippedRelicId(relicId);
        if (relicId) {
          const active = relics.find((r) => r.id === relicId);
          if (active) {
            setRelicFocus({ x: active.target_x, y: active.target_y, z: active.target_z });
          }
        } else {
          setRelicFocus(null);
        }
      }
    } catch (err) {
      console.error("Failed to equip relic:", err);
    }
  };

  // Auth setup listener
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const updateSession = async (s: Session | null) => {
      setSession(s);
      if (s) {
        setLinkStatusResolved(false);
        const login = (
          s.user?.user_metadata?.user_name ??
          s.user?.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        if (login) identifyUser({ github_login: login, email: s.user?.email ?? undefined });

        try {
          const res = await fetch("/api/me");
          const data = await res.json();
          setLinkedLeetCodeUsername(data.leetcode_username || null);

          if (data.leetcode_username && data.customizations) {
            const devId = data.developer_id;
            const usernameLC = data.leetcode_username.toLowerCase();
            const custs = data.customizations;
            try {
              if (custs.custom_color?.color) {
                localStorage.setItem(
                  "leetcodecity:color_override",
                  JSON.stringify({ developerId: devId, value: custs.custom_color.color, ts: Date.now() })
                );
              }
              if (custs.billboard) {
                const images = Array.isArray(custs.billboard.images)
                  ? custs.billboard.images
                  : custs.billboard.image_url ? [custs.billboard.image_url] : [];
                localStorage.setItem(
                  "leetcodecity:billboard_override",
                  JSON.stringify({ developerId: devId, value: images, ts: Date.now() })
                );
              }
              if (custs.loadout) {
                localStorage.setItem(
                  "leetcodecity:loadout_override",
                  JSON.stringify({ developerId: devId, loadout: custs.loadout, ts: Date.now() })
                );
              }
              if (custs.building_style?.style) {
                localStorage.setItem(
                  "leetcodecity:style_override",
                  JSON.stringify({ developerId: devId, value: custs.building_style.style, ts: Date.now() })
                );
              }
              if (custs.led_banner?.text) {
                localStorage.setItem(
                  "leetcodecity:led_banner_override",
                  JSON.stringify({ developerId: devId, value: custs.led_banner.text, ts: Date.now() })
                );
              }
              if (custs.selected_title?.slug) {
                localStorage.setItem(
                  "leetcodecity:selected_title_override",
                  JSON.stringify({ developerId: devId, value: custs.selected_title.slug, ts: Date.now() })
                );
              }
            } catch (err) {
              console.warn("Failed to set local storage overrides in session update:", err);
            }

            setBuildings((prev) =>
              prev.map((b) => {
                if (b.login.toLowerCase() === usernameLC) {
                  return {
                    ...b,
                    custom_color: custs.custom_color?.color ?? b.custom_color,
                    billboard_images: Array.isArray(custs.billboard?.images)
                      ? custs.billboard.images
                      : custs.billboard?.image_url ? [custs.billboard.image_url] : b.billboard_images,
                    loadout: custs.loadout ?? b.loadout,
                    building_style: custs.building_style?.style ?? b.building_style,
                    led_banner_text: custs.led_banner?.text ?? b.led_banner_text,
                    selected_title: custs.selected_title?.slug ?? b.selected_title,
                  };
                }
                return b;
              })
            );
          }
        } catch (err) {
          console.warn("[profile] Failed to resolve linked LeetCode status.", err);
          setLinkedLeetCodeUsername(null);
        } finally {
          setLinkStatusResolved(true);
          setSessionResolved(true);
        }
      } else {
        setLinkedLeetCodeUsername(null);
        setLinkStatusResolved(true);
        setSessionResolved(true);
      }
    };

    supabase.auth.getSession().then((res: { data: { session: Session | null }; error: any }) => {
      const s = res.data?.session ?? null;
      updateSession(s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, s: Session | null) => {
        if (event !== "TOKEN_REFRESHED") {
          await updateSession(s);
          if (event === "SIGNED_IN" && s) {
            try {
              const res = await fetch("/api/me");
              const data = await res.json();
              if (!data.leetcode_username) {
                setTimeout(() => setShowLinkModal(true), 800);
              }
            } catch (err) {
              console.warn("[auth] Failed to check leetcode_username after sign-in:", err);
            }
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Sync / Active hooks setup
  useEffect(() => {
    if (!session || !linkedLeetCodeUsername) return;
    const ping = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetch("/api/lc-pulse", { method: "POST" }).catch(() => { });
    };
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [session, linkedLeetCodeUsername]);

  useEffect(() => {
    if (!linkedLeetCodeUsername) return;
    const silentRefresh = async () => {
      try {
        const res = await fetch(`/api/dev/${encodeURIComponent(linkedLeetCodeUsername)}?refresh=true&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const devData = await res.json();
        const foundIdx = rawDevsRef.current.findIndex(
          (d) => d.github_login.toLowerCase() === devData.github_login?.toLowerCase()
        );
        if (foundIdx !== -1) {
          const existing = rawDevsRef.current[foundIdx];
          rawDevsRef.current[foundIdx] = {
            ...existing,
            ...devData,
            loadout: devData.loadout ?? existing.loadout ?? null,
            custom_color: devData.custom_color ?? existing.custom_color ?? null,
            owned_items: devData.owned_items?.length ? devData.owned_items : existing.owned_items ?? [],
            billboard_images: devData.billboard_images?.length ? devData.billboard_images : existing.billboard_images ?? [],
            building_style: devData.building_style ?? existing.building_style ?? "tower",
          };
          const layout = generateCityLayout(rawDevsRef.current);
          setBuildings(layout.buildings);
          setSelectedBuilding((prev) => {
            if (!prev || prev.login.toLowerCase() !== devData.github_login?.toLowerCase()) return prev;
            return layout.buildings.find((b) => b.login.toLowerCase() === devData.github_login?.toLowerCase()) ?? prev;
          });
        }
      } catch (err) {
        console.warn("[profile] Silent LeetCode refresh failed.", err);
      }
    };
    const initialDelay = setTimeout(silentRefresh, 10000);
    const interval = setInterval(silentRefresh, 60 * 60 * 1000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [linkedLeetCodeUsername]);

  // General listeners: theme, resize, window, load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("leetcodecity_theme");
    if (saved !== null) {
      const n = parseInt(saved, 10);
      if (n >= 0 && n <= 3) setThemeIndex(n);
    }
    try {
      const savedCycle = localStorage.getItem("leetcodecity_daynight_cycle");
      if (savedCycle === "0") setDayNightCycleActive(false);
    } catch {
      // Preferences are optional; ignore storage failures and keep defaults.
    }
    try {
      const savedWeather = localStorage.getItem("leetcodecity_weather_mode");
      if (["sunny", "rainy", "windy", "stormy", "snowy"].includes(savedWeather ?? "")) {
        setWeatherMode(savedWeather as any);
      }
    } catch {
      // Preferences are optional; ignore storage failures and keep defaults.
    }
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Broadcast layout modes
  useEffect(() => {
    const detail = {
      flyMode,
      raidMode: raidState.phase !== "idle" && raidState.phase !== "preview",
      accent: theme.accent,
      shadow: theme.shadow,
    };
    (window as any).__gcRadioMode = detail;
    window.dispatchEvent(new CustomEvent("gc:radio-mode", { detail }));
  }, [flyMode, raidState.phase, theme.accent, theme.shadow]);

  // Feed events
  useEffect(() => {
    let cancelled = false;
    const fetchFeed = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/feed?limit=50&today=1");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFeedEvents(data.events ?? []);
      } catch (err) {
        console.warn("[feed] Failed to refresh activity feed.", err);
      }
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch ads from database
  useEffect(() => {
    fetch("/api/sky-ads")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setSkyAds(data);
      })
      .catch(() => { });
  }, []);

  // Fetch VS Code key check
  useEffect(() => {
    if (codingPanelOpen && hasVsCodeKey === null) {
      const controller = new AbortController();
      fetch(`/api/vscode-key?t=${Date.now()}`, { cache: "no-store", signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          if (mountedRef.current && typeof d.hasKey === "boolean") {
            setHasVsCodeKey(d.hasKey);
            try {
              if (d.hasKey) localStorage.setItem("leetcodecity_has_vscode_key", "1");
              else localStorage.removeItem("leetcodecity_has_vscode_key");
            } catch {
              // Cache only; keep the in-memory VS Code key status when storage fails.
            }
          }
        })
        .catch((err) => {
          console.warn("[profile] Failed to load VS Code key status.", err);
        });
      return () => controller.abort();
    }
  }, [codingPanelOpen, hasVsCodeKey]);

  // Relic updates save listeners
  useEffect(() => {
    const handler = () => {
      fetch("/api/relics")
        .then((res) => res.json())
        .then((data) => {
          setEquippedRelicId(data.equippedRelicId);
          if (data.equippedRelicId) {
            const active = (data.relics || relics).find((r: Relic) => r.id === data.equippedRelicId);
            if (active) {
              setRelicFocus({ x: active.target_x, y: active.target_y, z: active.target_z });
            }
          } else {
            setRelicFocus(null);
          }
        })
        .catch(() => { });
    };
    window.addEventListener("leetcodecity:relic-saved", handler);
    window.addEventListener("leetcodecity:loadout-saved", handler);
    return () => {
      window.removeEventListener("leetcodecity:relic-saved", handler);
      window.removeEventListener("leetcodecity:loadout-saved", handler);
    };
  }, [relics]);

  // Relics on mount
  useEffect(() => {
    fetch("/api/relics")
      .then((res) => res.json())
      .then((data) => {
        if (data.relics) setRelics(data.relics);
        if (data.equippedRelicId) {
          setEquippedRelicId(data.equippedRelicId);
          const active = (data.relics || STATIC_RELICS).find((r: Relic) => r.id === data.equippedRelicId);
          if (active) {
            setRelicFocus({ x: active.target_x, y: active.target_y, z: active.target_z });
          }
        }
      })
      .catch(() => { });
  }, []);

  // Post loadout save
  useEffect(() => {
    const handler = () => reloadCity(true);
    window.addEventListener("leetcodecity:loadout-saved", handler);
    return () => window.removeEventListener("leetcodecity:loadout-saved", handler);
  }, [reloadCity]);

  // District announcer checks
  useEffect(() => {
    if (shouldShowDistrictChooser && !sessionStorage.getItem("district_dismissed")) {
      setDistrictChooserOpen(true);
    }
  }, [shouldShowDistrictChooser]);

  // Monitor fly score for mission quota
  useEffect(() => {
    if (
      flyMode &&
      !quotaNotified &&
      !quotaDismissed &&
      !quotaMissionCompleted &&
      flyScore.score >= 50
    ) {
      setQuotaReached(true);
      setQuotaNotified(true);
    }
    if (!flyMode) {
      setQuotaReached(false);
      setQuotaNotified(false);
      setQuotaDismissed(false);
    }
  }, [flyMode, flyScore.score, quotaDismissed, quotaMissionCompleted, quotaNotified]);

  // Level-up toasts
  useEffect(() => {
    if (!streakData?.xp || !myBuilding) return;
    const newLevel = streakData.xp.new_level;
    const currentLevel = myBuilding.xp_level ?? 1;
    if (newLevel > currentLevel) {
      setLevelUpLevel(newLevel);
    }
  }, [streakData?.xp, myBuilding]);

  // Milestone celebrations mount check
  useEffect(() => {
    fetch("/api/milestone-celebration")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMilestoneCelebrations(data);
      })
      .catch(() => { });
  }, []);

  // Milestone check when dev counts change
  useEffect(() => {
    if (stats.total_developers < CELEBRATION_MILESTONES[0]) return;
    const current = [...CELEBRATION_MILESTONES].reverse().find((m) => stats.total_developers >= m);
    if (!current) return;
    const alreadyRecorded = milestoneCelebrations.some((c) => c.milestone === current);
    if (alreadyRecorded) return;

    fetch("/api/milestone-celebration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_developers: stats.total_developers }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.celebrated) {
          setMilestoneCelebrations((prev) => [
            { milestone: data.milestone, reached_at: data.reached_at ?? new Date().toISOString() },
            ...prev,
          ]);
        }
      })
      .catch(() => { });
  }, [stats.total_developers, milestoneCelebrations]);

  // Visit counting trigger
  useEffect(() => {
    if (selectedBuilding && session && selectedBuilding.login.toLowerCase() !== authLogin) {
      const timer = setTimeout(async () => {
        try {
          const building = buildings.find((b) => b.login === selectedBuilding.login);
          if (!building) return;
          await fetch("/api/interactions/visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ building_login: selectedBuilding.login }),
          });
          trackMissionRef.current("visit_building");
          trackMissionRef.current("visit_3_buildings");
        } catch (err) {
          console.warn("[missions] Failed to track building visit mission.", err);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedBuilding, session, authLogin, buildings]);

  // Fly timing hook tick
  useEffect(() => {
    if (!flyMode || flyPaused) return;
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = now - flyStartTime.current - flyTotalPauseMs.current;
      setFlyElapsedSec(Math.floor(elapsed / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [flyMode, flyPaused]);

  // Onboarding nudge checks
  useEffect(() => {
    if (loadStage !== "done" || isMobile || !session || flyMode || introMode) return;
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem("leetcodecity_fly_history");
        if (!raw) return;
        const hist = JSON.parse(raw);
        if (!hist.seeds || Object.keys(hist.seeds).length === 0) return;
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
        const currentSeed = `${now.getFullYear()}-${dayOfYear}`;
        if (hist.seeds[currentSeed]) return;
        setShowDailyNudge(true);
        const autoDismiss = setTimeout(() => setShowDailyNudge(false), 15000);
        dailyNudgeTimerRef.current = autoDismiss;
      } catch {
        // Daily nudge history is optional; skip the nudge when storage cannot be read.
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loadStage, isMobile, session, flyMode, introMode]);

  // Fly hint seen check
  useEffect(() => {
    if (loadStage !== "done" || isMobile || flyMode || introMode) return;
    try {
      if (localStorage.getItem("leetcodecity_fly_history") || localStorage.getItem("leetcodecity_fly_hint_seen")) return;
    } catch {
      // Fly-mode hint is optional; avoid showing it when storage cannot be read.
      return;
    }
    const timer = setTimeout(() => {
      setShowFlyHint(true);
      const autoDismiss = setTimeout(() => {
        setShowFlyHint(false);
        try {
          localStorage.setItem("leetcodecity_fly_hint_seen", "1");
        } catch {
          // Hint dismissal is best-effort; failure only means it may show again later.
        }
      }, 10000);
      flyHintTimerRef.current = autoDismiss;
    }, 5000);
    return () => clearTimeout(timer);
  }, [loadStage, isMobile, flyMode, introMode]);

  // Abort mounts reference cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generateControllerRef.current?.abort();
    };
  }, []);

  const handleLoadRetry = useCallback(() => {
    setLoadStage("init");
    setLoadProgress(0);
    setLoadError(null);
    didInit.current = false;
  }, []);

  // Load city on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const cached = getCityCache();
    const needsRefresh = sessionStorage.getItem("leetcodecity:refresh_city") === "true";
    const loadStartTime = performance.now();

    async function loadCity() {
      try {
        setLoadStage("init");
        setLoadProgress(3);
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) {
          setLoadError("Your browser does not support WebGL. Try Chrome, Firefox, or Edge.");
          setLoadStage("error");
          return;
        }

        if (cached && !needsRefresh) {
          setBuildings(cached.buildings);
          setPlazas(cached.plazas);
          setDecorations(cached.decorations);
          setDistrictZones(cached.districtZones);
          setStats(cached.stats);

          setLoadStage("rendering");
          setLoadProgress(70);

          await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
              if (resolved) return;
              resolved = true;
              resolve();
            };
            requestAnimationFrame(() => {
              requestAnimationFrame(() => done());
            });
            setTimeout(done, 500);
          });

          const elapsed = performance.now() - loadStartTime;
          if (elapsed < 800) {
            await new Promise((r) => setTimeout(r, 800 - elapsed));
          }

          setLoadProgress(100);
          setLoadStage("ready");
          return;
        }

        setLoadStage("fetching");
        setLoadProgress(10);

        let allDevs: CityDeveloperRecord[] = [];
        let cityStats: CityStats = {
          total_developers: 0,
          total_contributions: 0,
        };

        try {
          const v = Math.floor(Date.now() / 300_000);
          const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
          const snapshotUrl = `${supabaseUrl}/storage/v1/object/public/city-data/snapshot.json?v=${v}`;
          const snapshotRes = await fetch(snapshotUrl);
          if (snapshotRes.ok) {
            const snapshot = await snapshotRes.json();
            allDevs = snapshot.developers;
            cityStats = snapshot.stats;
          }
        } catch (err) {
          console.warn("[city] Snapshot fetch failed during load; falling back to chunked city data.", err);
        }

        if (allDevs.length === 0) {
          const CHUNK = 1000;
          const cacheBuster = needsRefresh ? `&t=${Date.now()}` : "";
          if (needsRefresh) {
            sessionStorage.removeItem("leetcodecity:refresh_city");
          }

          const res = await fetch(`/api/city?from=0&to=${CHUNK}${cacheBuster}`);
          if (!res.ok) throw new Error("Failed to fetch city data");
          const data = await res.json();
          allDevs = data.developers ?? [];
          cityStats = data.stats;

          const total = cityStats?.total_developers ?? 0;
          if (total > CHUNK && allDevs.length > 0) {
            for (let i = CHUNK; i < total; i += CHUNK * 3) {
              const batchPromises: Promise<{ developers: typeof data.developers } | null>[] = [];
              for (let j = 0; j < 3; j++) {
                const from = i + (j * CHUNK);
                if (from >= total) break;
                batchPromises.push(
                  fetch(`/api/city?from=${from}&to=${from + CHUNK}${cacheBuster}`).then((r) => (r.ok ? r.json() : null))
                );
              }
              const results = await Promise.all(batchPromises);
              for (const chunk of results) {
                if (chunk?.developers?.length) {
                  allDevs = [...allDevs, ...chunk.developers];
                }
              }
            }
          }
        }

        setLoadProgress(30);

        if (!allDevs || allDevs.length === 0) {
          setLoadProgress(100);
          setLoadStage("ready");
          return;
        }

        applyLocalStorageOverrides(allDevs);

        setLoadStage("generating");
        setLoadProgress(45);
        await new Promise((r) => setTimeout(r, 0));

        rawDevsRef.current = allDevs;
        setStats(cityStats);
        const finalLayout = generateCityLayout(allDevs);
        setBuildings(finalLayout.buildings);
        setPlazas(finalLayout.plazas);
        setDecorations(finalLayout.decorations);
        setDistrictZones(finalLayout.districtZones);

        setLoadProgress(55);

        setLoadStage("rendering");
        setLoadProgress(65);

        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };
          let frameCount = 0;
          const waitFrames = () => {
            frameCount++;
            if (frameCount >= 4) {
              done();
            } else {
              requestAnimationFrame(waitFrames);
            }
          };
          requestAnimationFrame(waitFrames);
          setTimeout(done, 2000);
        });

        setLoadProgress(75);

        await new Promise((r) => setTimeout(r, 1200));

        setLoadProgress(85);

        setCityCache({ ...finalLayout, stats: cityStats });
        setLoadProgress(95);

        const elapsed = performance.now() - loadStartTime;
        if (elapsed < 1500) {
          await new Promise((r) => setTimeout(r, 1500 - elapsed));
        }

        setLoadProgress(100);
        setLoadStage("ready");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Something went wrong");
        setLoadStage("error");
      }
    }

    loadCity();
  }, [loadStage]);

  return (
    <CityContext.Provider
      value={{
        username,
        setUsername,
        buildings,
        setBuildings,
        plazas,
        setPlazas,
        decorations,
        setDecorations,
        districtZones,
        setDistrictZones,
        loading,
        setLoading,
        loadStage,
        setLoadStage,
        loadProgress,
        loadError,
        setLoadError,
        feedback,
        setFeedback,
        flyMode,
        setFlyMode,
        flyVehicle,
        setFlyVehicle,
        introMode,
        setIntroMode,
        introPhase,
        setIntroPhase,
        exploreMode,
        setExploreMode,
        themeIndex,
        setThemeIndex,
        isCodexOpen,
        setIsCodexOpen,
        isRelicModalOpen,
        setIsRelicModalOpen,
        eArcadeOpen,
        setEArcadeOpen,
        zenCodingOpen,
        setZenCodingOpen,
        codeForgeOpen,
        setCodeForgeOpen,
        solanaOpen,
        setSolanaOpen,
        pillModalOpen,
        setPillModalOpen,
        relics,
        equippedRelicId,
        setEquippedRelicId,
        relicFocus,
        setRelicFocus,
        dayNightCycleActive,
        setDayNightCycleActive,
        weatherMode,
        setWeatherMode,
        hud,
        setHud,
        playerPos,
        setPlayerPos,
        districtAnnouncement,
        setDistrictAnnouncement,
        flyPaused,
        setFlyPaused,
        flyScore,
        setFlyScore,
        flyPersonalBest,
        setFlyPersonalBest,
        flyElapsedSec,
        setFlyElapsedSec,
        quotaReached,
        setQuotaReached,
        quotaNotified,
        setQuotaNotified,
        quotaDismissed,
        setQuotaDismissed,
        stats,
        githubStars,
        discordMembers,
        milestoneCelebrations,
        focusedBuilding,
        setFocusedBuilding,
        selectedBuilding,
        setSelectedBuilding,
        shareData,
        setShareData,
        copied,
        setCopied,
        vsCodeKey,
        setVsCodeKey,
        hasVsCodeKey,
        setHasVsCodeKey,
        vsCodeKeyLoading,
        setVsCodeKeyLoading,
        vsCodeKeyCopied,
        setVsCodeKeyCopied,
        codingPanelOpen,
        setCodingPanelOpen,
        session,
        sessionResolved,
        claiming,
        purchasedItem,
        buildingCardLoading,
        setBuildingCardLoading,
        giftClaimed,
        setGiftClaimed,
        claimingGift,
        feedEvents,
        setFeedEvents,
        feedPanelOpen,
        setFeedPanelOpen,
        analyticsOpen,
        setAnalyticsOpen,
        kudosSending,
        kudosSent,
        kudosError,
        compareBuilding,
        setCompareBuilding,
        comparePair,
        setComparePair,
        compareSelfHint,
        setCompareSelfHint,
        giftModalOpen,
        setGiftModalOpen,
        giftItems,
        setGiftItems,
        giftBuying,
        compareCopied,
        setCompareCopied,
        compareLang,
        setCompareLang,
        clickedAd,
        setClickedAd,
        skyAds,
        arcadeOnline,
        districtChooserOpen,
        setDistrictChooserOpen,
        rabbitCinematic,
        setRabbitCinematic,
        rabbitCinematicPhase,
        setRabbitCinematicPhase,
        rabbitProgress,
        rabbitSighting,
        setRabbitSighting,
        rabbitCompletion,
        setRabbitCompletion,
        rabbitHintFlash,
        setRabbitHintFlash,
        signInPromptVisible,
        setSignInPromptVisible,
        adToast,
        setAdToast,
        refreshingStats,
        welcomeCtaVisible,
        levelUpLevel,
        setLevelUpLevel,
        giftedInfo,
        setGiftedInfo,
        showDailyNudge,
        setShowDailyNudge,
        showFlyHint,
        setShowFlyHint,
        showFlyControls,
        setShowFlyControls,
        showFlyResults,
        setShowFlyResults,
        ghostPreviewLogin,
        setGhostPreviewLogin,
        selfLogin,
        authLogin,
        raidState,
        raidActions,
        raidToast,
        isMobile,
        theme,
        linkedLeetCodeUsername,
        linkStatusResolved,
        identityResolved,
        showLinkModal,
        setShowLinkModal,
        linkInput,
        setLinkInput,
        confirmedUsername,
        setConfirmedUsername,
        linking,
        linkError,
        expectedToken,
        resetting,
        resetMsg,
        setResetMsg,
        myBuilding,
        needsToLink,
        shopHref,
        hasFreeGift,
        shouldShowDistrictChooser,
        streakData,
        dailiesData,
        dailyToasts,
        liveUsers,
        liveStatus,
        codingCount,
        liveByLogin,
        multiplayerPlayers,
        mpPlayerCount,
        mpChatMessages,
        mpStatus,
        mpSendChat,
        mpSendMove,
        mpIsJoined,
        effectiveLiveCount,
        effectiveLiveStatus,
        cityEnergy,
        welcomeCtaVisibleRef,
        ghostPreviewShownRef,
        mountedRef,
        generateControllerRef,
        flyScoreRef,
        flyHintTimerRef,
        flyResultsTimerRef,
        dailyNudgeTimerRef,
        lastDistrictRef,
        flyPersonalBestRef,
        flyStartTime,
        flyPausedAt,
        flyTotalPauseMs,
        announceTimerRef,
        failedUsernamesRef,
        rawDevsRef,

        // Handlers
        cycleWeather,
        cycleTheme,
        endFly,
        endIntro,
        replayIntro,
        onRabbitCaught,
        reloadCity,
        handleGiveKudos,
        handleOpenGift,
        handleGiftCheckout,
        handleSignIn,
        handleSignOut,
        handleVerifyLeetCode,
        handleResetClaim,
        handleRefreshStats,
        handleClaimFreeGift,
        claimDailies,
        refreshDailies,
        trackClientMission,
        endRabbitCinematic,
        handleEquipRelic,
        handleLoadRetry,
      }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const context = useContext(CityContext);
  if (context === undefined) {
    throw new Error("useCity must be used within a CityProvider");
  }
  return context;
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { CityBuilding } from "@/lib/github";
import type { RaidPreviewResponse, RaidExecuteResponse } from "@/lib/raid";
import { preloadRaidAudio, playRaidSound, stopRaidSound, fadeOutRaidSound, stopAllRaidSounds } from "@/lib/raidAudio";

// ─── Types ────────────────────────────────────────────────────

export type RaidPhase =
  | "idle"
  | "preview"
  | "intro"
  | "flight"
  | "attack"
  | "outro_win"
  | "outro_lose"
  | "share"
  | "done";

export interface RaidState {
  phase: RaidPhase;
  previewData: RaidPreviewResponse | null;
  raidData: RaidExecuteResponse | null;
  attackerBuilding: CityBuilding | null;
  defenderBuilding: CityBuilding | null;
  error: string | null;
  loading: boolean;
}

export interface RaidActions {
  startPreview: (targetLogin: string, buildings: CityBuilding[], myLogin: string) => void;
  executeRaid: (boostPurchaseId?: number, vehicleId?: string, offensiveItemId?: string) => void;
  skipToShare: () => void;
  exitRaid: () => void;
  onPhaseComplete: (phase: RaidPhase) => void;
}

const INITIAL_STATE: RaidState = {
  phase: "idle",
  previewData: null,
  raidData: null,
  attackerBuilding: null,
  defenderBuilding: null,
  error: null,
  loading: false,
};

// Phase durations (ms) - used for auto-transitions (fallback if 3D doesn't fire)
const PHASE_DURATIONS: Partial<Record<RaidPhase, number>> = {
  intro: 3500,
  flight: 5000,
  attack: 4500,
  outro_win: 3000,
  outro_lose: 2500,
};

// ─── Hook ─────────────────────────────────────────────────────

export function useRaidSequence(): [RaidState, RaidActions] {
  const [state, setState] = useState<RaidState>(INITIAL_STATE);
  const targetLoginRef = useRef<string>("");
  const raidDataRef = useRef<RaidExecuteResponse | null>(null);
  const lastCompletedPhaseRef = useRef<RaidPhase | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAllRaidSounds();
    };
  }, []);

  const setPhase = useCallback((phase: RaidPhase) => {
    lastCompletedPhaseRef.current = null;
    setState((prev) => ({ ...prev, phase, error: null }));

    // Audio triggers
    switch (phase) {
      case "intro":
        preloadRaidAudio();
        playRaidSound("takeoff");
        break;
      case "flight":
        playRaidSound("flight");
        break;
      case "attack":
        stopRaidSound("flight");
        break;
      case "outro_win":
        stopAllRaidSounds();
        // explosion already played by 3D component at climax
        playRaidSound("victory");
        break;
      case "outro_lose":
        stopAllRaidSounds();
        playRaidSound("crash");
        setTimeout(() => playRaidSound("defeat"), 500);
        break;
      case "share":
      case "done":
      case "idle":
        stopAllRaidSounds();
        break;
    }
  }, []);

  const startPreview = useCallback(
    async (targetLogin: string, buildings: CityBuilding[], myLogin: string) => {
      targetLoginRef.current = targetLogin;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Find buildings for position data
      const attackerBuilding = buildings.find((b) => b.login === myLogin) ?? null;
      const defenderBuilding = buildings.find((b) => b.login === targetLogin) ?? null;

      try {
        const res = await fetch("/api/raid/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_login: targetLogin }),
        });

        if (!res.ok) {
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Failed to load raid preview",
          }));
          return;
        }

        const previewData = (await res.json()) as RaidPreviewResponse;

        setState({
          phase: "preview",
          previewData,
          raidData: null,
          attackerBuilding,
          defenderBuilding,
          error: null,
          loading: false,
        });
      } catch (err) {
        console.warn("[lib/useRaidSequence.ts] error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Network error",
        }));
      }
    },
    [],
  );

  const executeRaid = useCallback(
    async (boostPurchaseId?: number, vehicleId?: string, offensiveItemId?: string) => {
      setState((prev) => ({ ...prev, loading: true }));

      try {
        const res = await fetch("/api/raid/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_login: targetLoginRef.current,
            boost_purchase_id: boostPurchaseId,
            vehicle_id: vehicleId,
            offensive_item_id: offensiveItemId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Raid failed",
          }));
          return;
        }

        const raidData = (await res.json()) as RaidExecuteResponse;

        // Override positions with client-side building data
        setState((prev) => {
          if (prev.attackerBuilding) {
            raidData.attacker.position = prev.attackerBuilding.position;
            raidData.attacker.height = prev.attackerBuilding.height;
          }
          if (prev.defenderBuilding) {
            raidData.defender.position = prev.defenderBuilding.position;
            raidData.defender.height = prev.defenderBuilding.height;
          }
          raidDataRef.current = raidData;
          return {
            ...prev,
            raidData,
            loading: false,
          };
        });

        // Set phase using setPhase so all audio preloading and fallback timers are set up!
        setPhase("intro");

        
      } catch (err) {
        console.warn("[lib/useRaidSequence.ts] error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Network error",
        }));
      }
    },
    [setPhase],
  );

  const onPhaseComplete = useCallback(
    (completedPhase: RaidPhase) => {
      if (lastCompletedPhaseRef.current === completedPhase) return;
      lastCompletedPhaseRef.current = completedPhase;

      switch (completedPhase) {
        case "intro":
          setPhase("flight");
          break;
        case "flight":
          setPhase("attack");
          break;
        case "attack": {
          const nextPhase = raidDataRef.current?.success ? "outro_win" : "outro_lose";
          setPhase(nextPhase);
          break;
        }
        case "outro_win":
        case "outro_lose":
          setPhase("share");
          break;
        case "share":
          setPhase("done");
          break;
        default:
          break;
      }
    },
    [setPhase],
  );

  const skipToShare = useCallback(() => {
    setPhase("share");
  }, [setPhase]);

  const exitRaid = useCallback(() => {
    stopAllRaidSounds();
    raidDataRef.current = null;
    lastCompletedPhaseRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Auto-advance and visibility handling
  useEffect(() => {
    const phase = state.phase;
    const duration = PHASE_DURATIONS[phase];
    if (!duration) return;

    let startTime = Date.now();
    let remaining = duration;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const startTimer = () => {
      timerId = setTimeout(() => {
        onPhaseComplete(phase);
      }, remaining);
    };

    if (!document.hidden) {
      startTimer();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
          remaining = Math.max(0, remaining - (Date.now() - startTime));
        }
      } else {
        if (!timerId && remaining > 0) {
          startTime = Date.now();
          startTimer();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.phase, onPhaseComplete]);

  return [
    state,
    { startPreview, executeRaid, skipToShare, exitRaid, onPhaseComplete },
  ];
}

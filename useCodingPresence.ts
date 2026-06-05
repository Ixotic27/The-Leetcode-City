"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface LiveSession {
  githubLogin: string;
  avatarUrl: string;
  status: "active" | "idle";
  language?: string;
  updatedAt?: number; // Internal epoch validation checkpoint tracking parameter
}

export function useCodingPresence() {
  const [liveByLogin, setLiveByLogin] = useState<Map<string, LiveSession>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mapRef = useRef<Map<string, LiveSession>>(new Map());

  // Stable setter that creates a new Map reference for React
  const updateMap = useCallback(() => {
    setLiveByLogin(new Map(mapRef.current));
  }, []);

  useEffect(() => {
    // Bootstrap: fetch current active sessions
    fetch("/api/presence")
      .then((r) => r.json())
      .then((data) => {
        if (data.developers) {
          const map = new Map<string, LiveSession>();
          const bootstrapTimestamp = Date.now();
          for (const d of data.developers) {
            map.set(d.githubLogin, {
              githubLogin: d.githubLogin,
              avatarUrl: d.avatarUrl,
              status: d.status,
              language: d.language,
              updatedAt: bootstrapTimestamp,
            });
          }
          mapRef.current = map;
          updateMap();
        }
      })
      .catch(() => {});

    // Subscribe to realtime broadcast
    const supabase = createBrowserSupabase();
    const channel = supabase.channel("coding-presence");
    channelRef.current = channel;

    channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("broadcast", { event: "heartbeat" }, ({ payload }: { payload: any }) => {
        if (!payload?.githubLogin) return;

        const currentTimestamp = Date.now();

        // Offline signal: remove dev from live map immediately
        if (payload.status === "offline") {
          mapRef.current.delete(payload.githubLogin);
          updateMap();
          return;
        }

        mapRef.current.set(payload.githubLogin, {
          githubLogin: payload.githubLogin,
          avatarUrl: payload.avatarUrl,
          status: payload.status ?? "active",
          language: payload.language,
          updatedAt: currentTimestamp, // Track the precise atomic arrival frame of the WebSocket heartbeat
        });
        updateMap();
      })
      .subscribe();

    // Periodically re-fetch to stay in sync with server state without destroying real-time states
    const pruneInterval = setInterval(() => {
      fetch("/api/presence")
        .then((r) => r.json())
        .then((data) => {
          if (data.developers) {
            const pollingTimestamp = Date.now();
            
            // Capture currently active keys to catch users dropped entirely from server state
            const incomingLogins = new Set(data.developers.map((d: any) => d.githubLogin));

            // 1. Remove users no longer in server database, unless they just joined via WebSocket
            for (const key of mapRef.current.keys()) {
              if (!incomingLogins.has(key)) {
                const localizedRecord = mapRef.current.get(key);
                // Keep the record intact if a WebSocket heartbeat refreshed it during this fetch flight window
                if (localizedRecord && localizedRecord.updatedAt && pollingTimestamp - localizedRecord.updatedAt > 15000) {
                  mapRef.current.delete(key);
                }
              }
            }

            // 2. Safely merge newly fetched developers using atomic timestamp deltas
            for (const d of data.developers) {
              const existingRecord = mapRef.current.get(d.githubLogin);

              // Transactional condition check: merge ONLY if the node doesn't exist, OR if the existing
              // node's last recorded lifecycle marker is older than this incoming polling transaction
              if (!existingRecord || !existingRecord.updatedAt || existingRecord.updatedAt < pollingTimestamp) {
                mapRef.current.set(d.githubLogin, {
                  githubLogin: d.githubLogin,
                  avatarUrl: d.avatarUrl,
                  status: d.status,
                  language: d.language,
                  updatedAt: existingRecord?.updatedAt || pollingTimestamp,
                });
              }
            }
            updateMap();
          }
        })
        .catch(() => {});
    }, 30_000);

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      clearInterval(pruneInterval);
    };
  }, [updateMap]);

  const liveCount = liveByLogin.size;
  const liveLogins = new Set(
    Array.from(liveByLogin.values()).map((s) => s.githubLogin),
  );

  return { liveCount, liveLogins, liveByLogin };
}

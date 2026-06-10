"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface LiveSession {
  githubLogin: string;
  avatarUrl: string;
  status: "active" | "idle";
  language?: string;
  lastUpdated?: number;
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
    const fetchPresence = () => {
      const requestTime = Date.now();
      fetch("/api/presence")
        .then((r) => r.json())
        .then((data) => {
          if (data.developers) {
            const newMap = new Map<string, LiveSession>();
            const serverLogins = new Set<string>();

            for (const d of data.developers) {
              serverLogins.add(d.githubLogin);
              const existing = mapRef.current.get(d.githubLogin);
              
              // Only overwrite if our local data isn't newer than the request start time
              if (existing && existing.lastUpdated && existing.lastUpdated > requestTime) {
                newMap.set(d.githubLogin, existing);
              } else {
                newMap.set(d.githubLogin, {
                  githubLogin: d.githubLogin,
                  avatarUrl: d.avatarUrl,
                  status: d.status,
                  language: d.language,
                  lastUpdated: requestTime,
                });
              }
            }

            // Retain recent local sessions that might not have reached the server DB yet
            for (const [login, session] of mapRef.current.entries()) {
              if (!serverLogins.has(login)) {
                if (session.lastUpdated && session.lastUpdated > requestTime) {
                  newMap.set(login, session);
                }
              }
            }

            mapRef.current = newMap;
            updateMap();
          }
        })
        .catch(() => {});
    };

    // Bootstrap: fetch current active sessions
    fetchPresence();

    // Subscribe to realtime broadcast
    const supabase = createBrowserSupabase();
    const channel = supabase.channel("coding-presence");
    channelRef.current = channel;

    channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("broadcast", { event: "heartbeat" }, ({ payload }: { payload: any }) => {
        if (!payload?.githubLogin) return;

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
          lastUpdated: Date.now(),
        });
        updateMap();
      })
      .subscribe();

    // Periodically re-fetch to stay in sync with server state
    const pruneInterval = setInterval(fetchPresence, 30_000);

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

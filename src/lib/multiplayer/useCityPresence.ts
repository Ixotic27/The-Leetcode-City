"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  CityPlayer,
  ChatMessage,
  ConnectionStatus,
} from "@/lib/multiplayer/types";

const ROOM_ID = "leetcode-city";
const MOVE_THROTTLE_MS = 250;
const PRESENCE_TRACK_THROTTLE_MS = 2000;

export interface CityPresenceState {
  players: Map<string, CityPlayer>;
  playerCount: number;
  chatMessages: ChatMessage[];
  status: ConnectionStatus;
  sendChat: (text: string) => void;
  sendMove: (cx: number, cy: number, cz: number, focusedBuilding: string | null) => void;
  isJoined: boolean;
}

export function useCityPresence(
  login: string | null,
  avatarUrl: string | null,
): CityPresenceState {
  const [players, setPlayers] = useState<Map<string, CityPlayer>>(new Map());
  const [playerCount, setPlayerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isJoined, setIsJoined] = useState(false);

  const playersRef = useRef<Map<string, CityPlayer>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const recentMovements = useRef<Map<string, { cx: number; cy: number; cz: number; focusedBuilding: string | null }>>(new Map());
  
  const lastMoveSent = useRef(0);
  const lastPresenceTrack = useRef(0);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMove = useRef<{ cx: number; cy: number; cz: number; focusedBuilding: string | null } | null>(null);
  
  const loginRef = useRef(login);
  loginRef.current = login;
  const avatarUrlRef = useRef(avatarUrl);
  avatarUrlRef.current = avatarUrl;

  const localUserIdRef = useRef<string>("");

  // ── Stable Sync Players ────────────────────────────────────
  const syncPlayers = useCallback(() => {
    const chan = channelRef.current;
    if (!chan) return;

    const presenceState = chan.presenceState();
    const newMap = new Map<string, CityPlayer>();

    for (const [key, presences] of Object.entries(presenceState)) {
      const p = presences[0] as any;
      if (p && p.login) {
        newMap.set(key, {
          id: key,
          login: p.login,
          avatar_url: p.avatar_url,
          cx: p.cx ?? 0,
          cy: p.cy ?? 200,
          cz: p.cz ?? 400,
          focusedBuilding: p.focusedBuilding ?? null,
          joinedAt: p.joinedAt ?? Date.now(),
        });
      }
    }

    // Merge recent movements
    for (const [id, pos] of recentMovements.current.entries()) {
      const p = newMap.get(id);
      if (p) {
        p.cx = pos.cx;
        p.cy = pos.cy;
        p.cz = pos.cz;
        p.focusedBuilding = pos.focusedBuilding;
      }
    }

    playersRef.current = newMap;
    setPlayers(newMap);
    setPlayerCount(newMap.size);
  }, []);

  // ── Send Move (Broadcast + Throttled Presence) ──────────────
  const sendMove = useCallback(
    (cx: number, cy: number, cz: number, focusedBuilding: string | null) => {
      const chan = channelRef.current;
      if (!chan || !isJoined) return;

      pendingMove.current = { cx, cy, cz, focusedBuilding };

      const now = Date.now();
      const elapsedMove = now - lastMoveSent.current;

      const performMove = () => {
        if (!pendingMove.current || !channelRef.current) return;
        const current = pendingMove.current;

        // 1. Broadcast movement instantly to other clients (very fast)
        channelRef.current.send({
          type: "broadcast",
          event: "move",
          payload: {
            id: localUserIdRef.current,
            ...current,
          },
        });

        // 2. Throttled presence tracking updates (slow)
        const elapsedPresence = now - lastPresenceTrack.current;
        if (elapsedPresence >= PRESENCE_TRACK_THROTTLE_MS) {
          channelRef.current.track({
            login: loginRef.current,
            avatar_url: avatarUrlRef.current ?? "",
            joinedAt: now,
            ...current,
          });
          lastPresenceTrack.current = now;
        }

        lastMoveSent.current = now;
        pendingMove.current = null;
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }
      };

      if (elapsedMove >= MOVE_THROTTLE_MS) {
        performMove();
      } else if (!moveTimerRef.current) {
        moveTimerRef.current = setTimeout(performMove, MOVE_THROTTLE_MS - elapsedMove);
      }
    },
    [isJoined],
  );

  // ── Send Chat ──────────────────────────────────────────────
  const sendChat = useCallback((text: string) => {
    const chan = channelRef.current;
    if (!chan || !isJoined || !loginRef.current) return;
    const trimmed = text.trim().slice(0, 120);
    if (trimmed.length === 0) return;

    const payload = {
      id: localUserIdRef.current,
      login: loginRef.current,
      text: trimmed,
      ts: Date.now(),
    };

    // 1. Broadcast to other active clients
    chan.send({
      type: "broadcast",
      event: "chat",
      payload,
    });

    // 2. Update local state instantly for self
    const selfMsg: ChatMessage = {
      id: `${localUserIdRef.current}-${Date.now()}`,
      login: loginRef.current,
      text: trimmed,
      ts: Date.now(),
      isSelf: true,
    };
    setChatMessages((prev) => {
      const next = [...prev, selfMsg];
      return next.length > 50 ? next.slice(-50) : next;
    });

    // 3. Persist to Supabase Database
    const supabase = createBrowserSupabase();
    supabase.auth.getSession().then((res: any) => {
      const session = res.data.session;
      if (session) {
        supabase
          .from("arcade_chat_messages")
          .insert({
            room_id: ROOM_ID,
            user_id: session.user.id,
            username: loginRef.current!,
            text: trimmed,
          })
          .then(() => {});
      }
    });
  }, [isJoined]);

  // ── Supabase Realtime Subscription ─────────────────────────
  useEffect(() => {
    const supabase = createBrowserSupabase();

    let cleanChannel: (() => void) | null = null;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const localId = session?.user?.id ?? `spectator-${Math.random().toString(36).slice(2, 11)}`;
      localUserIdRef.current = localId;

      // 1. Fetch Chat History
      supabase
        .from("arcade_chat_messages")
        .select("username, text, created_at, user_id")
        .eq("room_id", ROOM_ID)
        .order("created_at", { ascending: true })
        .limit(30)
        .then((res: any) => {
          const data = res.data;
          if (data) {
            const history = data.map((msg: any, i: number) => ({
              id: `history-${i}-${msg.created_at}`,
              login: msg.username,
              text: msg.text,
              ts: new Date(msg.created_at).getTime(),
              isSelf: msg.username.toLowerCase() === loginRef.current?.toLowerCase(),
            }));
            setChatMessages(history);
          }
        });

      // 2. Setup Realtime Channel
      const channel = supabase.channel(`city:presence`, {
        config: {
          presence: { key: localId },
        },
      });

      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          syncPlayers();
        })
        .on("presence", { event: "join" }, ({ key }: { key: string }) => {
          syncPlayers();
        })
        .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
          recentMovements.current.delete(key);
          syncPlayers();
        })
        .on("broadcast", { event: "move" }, ({ payload }: { payload: any }) => {
          const { id, cx, cy, cz, focusedBuilding } = payload;
          if (id === localUserIdRef.current) return; // skip self

          recentMovements.current.set(id, { cx, cy, cz, focusedBuilding });

          setPlayers((prev) => {
            const existing = prev.get(id);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(id, {
              ...existing,
              cx,
              cy,
              cz,
              focusedBuilding,
            });
            return next;
          });
        })
        .on("broadcast", { event: "chat" }, ({ payload }: { payload: any }) => {
          const { id, login: msgLogin, text, ts } = payload;
          if (id === localUserIdRef.current) return; // skip self

          const chatMsg: ChatMessage = {
            id: `${id}-${ts}`,
            login: msgLogin,
            text,
            ts,
            isSelf: false,
          };
          setChatMessages((prev) => {
            const next = [...prev, chatMsg];
            return next.length > 50 ? next.slice(-50) : next;
          });
        });

      setStatus("connecting");

      channel.subscribe((subStatus: string) => {
        if (subStatus === "SUBSCRIBED") {
          setStatus("connected");
          if (loginRef.current) {
            channel.track({
              login: loginRef.current,
              avatar_url: avatarUrlRef.current ?? "",
              cx: 0,
              cy: 200,
              cz: 400,
              focusedBuilding: null,
              joinedAt: Date.now(),
            });
            setIsJoined(true);
          }
        } else if (subStatus === "CLOSED" || subStatus === "CHANNEL_ERROR") {
          setStatus("reconnecting");
        }
      });

      cleanChannel = () => {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      };
    }

    init();

    return () => {
      if (cleanChannel) cleanChannel();
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      setIsJoined(false);
      channelRef.current = null;
    };
  }, [avatarUrl, syncPlayers]);

  // ── Re-track on login change ──────────────────────────────
  useEffect(() => {
    const channel = channelRef.current;
    if (login && channel && !isJoined) {
      channel.track({
        login,
        avatar_url: avatarUrl ?? "",
        cx: 0,
        cy: 200,
        cz: 400,
        focusedBuilding: null,
        joinedAt: Date.now(),
      });
      setIsJoined(true);
    }
  }, [login, avatarUrl, isJoined]);

  return useMemo(
    () => ({
      players,
      playerCount,
      chatMessages,
      status,
      sendChat,
      sendMove,
      isJoined,
    }),
    [players, playerCount, chatMessages, status, sendChat, sendMove, isJoined],
  );
}

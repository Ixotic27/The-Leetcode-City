"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PartySocket from "partysocket";
import type {
  CityPlayer,
  ChatMessage,
  ConnectionStatus,
  ServerMsg,
} from "@/lib/multiplayer/types";

// ─── Configuration ──────────────────────────────────────────
const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
const ROOM_ID = "leetcode-city";
const MOVE_THROTTLE_MS = 250;
const RECONNECT_GRACE_MS = 2000;

// ─── Return type ────────────────────────────────────────────
export interface CityPresenceState {
  /** All other players currently in the city */
  players: Map<string, CityPlayer>;
  /** Live player count (includes self) */
  playerCount: number;
  /** Recent chat messages */
  chatMessages: ChatMessage[];
  /** Connection status */
  status: ConnectionStatus;
  /** Send a chat message */
  sendChat: (text: string) => void;
  /** Update local camera position (throttled internally) */
  sendMove: (cx: number, cy: number, cz: number, focusedBuilding: string | null) => void;
  /** Whether the user has joined (sent join message) */
  isJoined: boolean;
}

// ─── Hook ───────────────────────────────────────────────────
export function useCityPresence(
  /** GitHub login of the current user (null = anonymous spectator) */
  login: string | null,
  /** Avatar URL */
  avatarUrl: string | null,
): CityPresenceState {
  const [players, setPlayers] = useState<Map<string, CityPlayer>>(new Map());
  const [playerCount, setPlayerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isJoined, setIsJoined] = useState(false);

  const playersRef = useRef<Map<string, CityPlayer>>(new Map());
  const socketRef = useRef<PartySocket | null>(null);
  const lastMoveSent = useRef(0);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMove = useRef<{ cx: number; cy: number; cz: number; focusedBuilding: string | null } | null>(null);
  const joinedRef = useRef(false);
  const loginRef = useRef(login);
  loginRef.current = login;

  // ── Stable setters ─────────────────────────────────────────
  const updatePlayers = useCallback(() => {
    setPlayers(new Map(playersRef.current));
  }, []);

  // ── Send move (throttled) ──────────────────────────────────
  const sendMove = useCallback(
    (cx: number, cy: number, cz: number, focusedBuilding: string | null) => {
      const ws = socketRef.current;
      if (!ws || !joinedRef.current) return;

      pendingMove.current = { cx, cy, cz, focusedBuilding };

      const now = Date.now();
      const elapsed = now - lastMoveSent.current;

      if (elapsed >= MOVE_THROTTLE_MS) {
        // Send immediately
        ws.send(JSON.stringify({ type: "move", ...pendingMove.current }));
        lastMoveSent.current = now;
        pendingMove.current = null;
        if (moveTimerRef.current) {
          clearTimeout(moveTimerRef.current);
          moveTimerRef.current = null;
        }
      } else if (!moveTimerRef.current) {
        // Schedule a delayed send
        moveTimerRef.current = setTimeout(() => {
          if (pendingMove.current && socketRef.current && joinedRef.current) {
            socketRef.current.send(
              JSON.stringify({ type: "move", ...pendingMove.current }),
            );
            lastMoveSent.current = Date.now();
            pendingMove.current = null;
          }
          moveTimerRef.current = null;
        }, MOVE_THROTTLE_MS - elapsed);
      }
    },
    [],
  );

  // ── Send chat ──────────────────────────────────────────────
  const sendChat = useCallback((text: string) => {
    const ws = socketRef.current;
    if (!ws || !joinedRef.current) return;
    const trimmed = text.trim().slice(0, 120);
    if (trimmed.length === 0) return;
    ws.send(JSON.stringify({ type: "chat", text: trimmed }));
  }, []);

  // ── WebSocket connection ───────────────────────────────────
  useEffect(() => {
    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      room: ROOM_ID,
    });

    socketRef.current = ws;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    ws.addEventListener("open", () => {
      setStatus("connected");

      // Clear reconnect grace timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Auto-join if we have a login
      if (loginRef.current && !joinedRef.current) {
        ws.send(
          JSON.stringify({
            type: "join",
            login: loginRef.current,
            avatar_url: avatarUrl ?? "",
          }),
        );
        joinedRef.current = true;
        setIsJoined(true);
      }
    });

    ws.addEventListener("message", (event) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "sync": {
          const newMap = new Map<string, CityPlayer>();
          for (const p of msg.players) {
            newMap.set(p.id, p);
          }
          playersRef.current = newMap;
          updatePlayers();
          setPlayerCount(newMap.size);

          // Import chat history
          if (msg.chatLog && msg.chatLog.length > 0) {
            const imported: ChatMessage[] = msg.chatLog.map((c, i) => ({
              id: `history-${i}-${c.ts}`,
              login: c.login,
              text: c.text,
              ts: c.ts,
              isSelf: c.login.toLowerCase() === loginRef.current?.toLowerCase(),
            }));
            setChatMessages(imported);
          }
          break;
        }

        case "join": {
          playersRef.current.set(msg.player.id, msg.player);
          updatePlayers();
          break;
        }

        case "leave": {
          playersRef.current.delete(msg.id);
          updatePlayers();
          break;
        }

        case "move": {
          const existing = playersRef.current.get(msg.id);
          if (existing) {
            existing.cx = msg.cx;
            existing.cy = msg.cy;
            existing.cz = msg.cz;
            existing.focusedBuilding = msg.focusedBuilding;
            updatePlayers();
          }
          break;
        }

        case "chat": {
          const chatMsg: ChatMessage = {
            id: `${msg.id}-${Date.now()}`,
            login: msg.login,
            text: msg.text,
            ts: Date.now(),
            isSelf: msg.login.toLowerCase() === loginRef.current?.toLowerCase(),
          };
          setChatMessages((prev) => {
            const next = [...prev, chatMsg];
            // Keep last 50 messages
            return next.length > 50 ? next.slice(-50) : next;
          });
          break;
        }

        case "player_count": {
          setPlayerCount(msg.count);
          break;
        }
      }
    });

    ws.addEventListener("close", (event) => {
      // Code 4000 = duplicate tab, don't reconnect
      if (event.code === 4000) {
        setStatus("error");
        return;
      }

      // Grace period before showing "reconnecting" status
      reconnectTimer = setTimeout(() => {
        setStatus("reconnecting");
      }, RECONNECT_GRACE_MS);
    });

    ws.addEventListener("error", () => {
      // PartySocket auto-reconnects, just update status
      setStatus("reconnecting");
    });

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      joinedRef.current = false;
      setIsJoined(false);
      ws.close();
      socketRef.current = null;
    };
  }, [avatarUrl, updatePlayers]);

  // ── Re-join on login change (e.g., user signs in) ──────────
  useEffect(() => {
    if (!login || !socketRef.current || joinedRef.current) return;

    const ws = socketRef.current;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "join",
          login,
          avatar_url: avatarUrl ?? "",
        }),
      );
      joinedRef.current = true;
      setIsJoined(true);
    }
  }, [login, avatarUrl]);

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

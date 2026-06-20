/**
 * Shared types for the multiplayer system (PartyKit presence + chat).
 * Used by both the client hooks and React components.
 */

// ─── Player State ───────────────────────────────────────────
export interface CityPlayer {
  id: string;
  login: string;
  avatar_url: string;
  /** Camera position in the 3D city */
  cx: number;
  cy: number;
  cz: number;
  /** Which building the user is currently looking at (login) */
  focusedBuilding: string | null;
  joinedAt: number;
}

// ─── Chat ───────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  login: string;
  text: string;
  ts: number;
  /** True if this was sent by the local user */
  isSelf?: boolean;
}

// ─── Connection Status ──────────────────────────────────────
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

// ─── Client → Server Messages ───────────────────────────────
export type ClientMsg =
  | { type: "join"; login: string; avatar_url: string }
  | { type: "move"; cx: number; cy: number; cz: number; focusedBuilding: string | null }
  | { type: "chat"; text: string };

// ─── Server → Client Messages ───────────────────────────────
export type ServerMsg =
  | { type: "sync"; players: CityPlayer[]; chatLog: { login: string; text: string; ts: number }[] }
  | { type: "join"; player: CityPlayer }
  | { type: "leave"; id: string }
  | { type: "move"; id: string; cx: number; cy: number; cz: number; focusedBuilding: string | null }
  | { type: "chat"; id: string; login: string; text: string }
  | { type: "player_count"; count: number };

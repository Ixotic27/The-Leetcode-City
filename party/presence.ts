import type { Party, Connection, ConnectionContext } from "partykit/server";

// ─── Tunables ───────────────────────────────────────────────
const MOVE_INTERVAL_MS = 200; // throttle position updates (city view is slow-paced)
const MAX_MESSAGE_BYTES = 512;
const MAX_PLAYERS = 200;
const CHAT_MAX_LENGTH = 120;
const CHAT_INTERVAL_MS = 1500;
const CHAT_LOG_MAX = 50;

// ─── Types ──────────────────────────────────────────────────
interface CityPlayer {
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

interface ChatLogEntry {
  login: string;
  text: string;
  ts: number;
}

// Client → Server messages
type ClientMsg =
  | { type: "join"; login: string; avatar_url: string }
  | { type: "move"; cx: number; cy: number; cz: number; focusedBuilding: string | null }
  | { type: "chat"; text: string };

// Server → Client messages
type ServerMsg =
  | { type: "sync"; players: CityPlayer[]; chatLog: ChatLogEntry[] }
  | { type: "join"; player: CityPlayer }
  | { type: "leave"; id: string }
  | { type: "move"; id: string; cx: number; cy: number; cz: number; focusedBuilding: string | null }
  | { type: "chat"; id: string; login: string; text: string }
  | { type: "player_count"; count: number };

// ─── Validators ─────────────────────────────────────────────
function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

// ─── Server ─────────────────────────────────────────────────
export default class PresenceServer implements Party.Server {
  options: Party.ServerOptions = { hibernate: true };

  readonly players = new Map<string, CityPlayer>();
  readonly lastMove = new Map<string, number>();
  readonly lastChat = new Map<string, number>();
  chatLog: ChatLogEntry[] = [];

  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Restore chat log from durable storage
    const stored = await this.room.storage.get<ChatLogEntry[]>("chatLog");
    if (stored) this.chatLog = stored;
  }

  // ── Connection ─────────────────────────────────────────────
  onConnect(conn: Connection, _ctx: ConnectionContext) {
    void _ctx;
    // Send current state to new connection
    const syncMsg: ServerMsg = {
      type: "sync",
      players: [...this.players.values()],
      chatLog: this.chatLog,
    };
    conn.send(JSON.stringify(syncMsg));
  }

  // ── Message handling ───────────────────────────────────────
  onMessage(message: string, sender: Connection) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) return;

    let msg: ClientMsg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof (msg as { type?: unknown }).type !== "string") return;

    const id = sender.id;
    const now = Date.now();

    // ── Join ─────────────────────────────────────────────────
    if (msg.type === "join") {
      if (this.players.size >= MAX_PLAYERS) return;
      if (typeof msg.login !== "string" || msg.login.length === 0 || msg.login.length > 60) return;
      if (typeof msg.avatar_url !== "string" || msg.avatar_url.length > 300) return;

      // Check for duplicate login — kick the old connection
      for (const [existingId, existingPlayer] of this.players) {
        if (existingPlayer.login.toLowerCase() === msg.login.toLowerCase() && existingId !== id) {
          this.players.delete(existingId);
          const leaveMsg: ServerMsg = { type: "leave", id: existingId };
          this.room.broadcast(JSON.stringify(leaveMsg));
          // Try to close old connection
          const oldConn = this.room.getConnection(existingId);
          if (oldConn) {
            try { oldConn.close(4000, "duplicate"); } catch { /* ok */ }
          }
          break;
        }
      }

      const player: CityPlayer = {
        id,
        login: msg.login,
        avatar_url: msg.avatar_url,
        cx: 0,
        cy: 200,
        cz: 400,
        focusedBuilding: null,
        joinedAt: now,
      };

      this.players.set(id, player);

      const joinMsg: ServerMsg = { type: "join", player };
      this.room.broadcast(JSON.stringify(joinMsg), [sender.id]);

      // Broadcast updated count
      this.broadcastCount();
      return;
    }

    const player = this.players.get(id);
    if (!player) return;

    // ── Move (camera position update) ────────────────────────
    if (msg.type === "move") {
      const lastMoveTime = this.lastMove.get(id) ?? 0;
      if (now - lastMoveTime < MOVE_INTERVAL_MS) return;
      this.lastMove.set(id, now);

      if (!isFiniteNumber(msg.cx) || !isFiniteNumber(msg.cy) || !isFiniteNumber(msg.cz)) return;

      player.cx = msg.cx;
      player.cy = msg.cy;
      player.cz = msg.cz;
      player.focusedBuilding = typeof msg.focusedBuilding === "string" ? msg.focusedBuilding.slice(0, 60) : null;

      const moveMsg: ServerMsg = {
        type: "move",
        id,
        cx: msg.cx,
        cy: msg.cy,
        cz: msg.cz,
        focusedBuilding: player.focusedBuilding,
      };
      this.room.broadcast(JSON.stringify(moveMsg), [sender.id]);
      return;
    }

    // ── Chat ─────────────────────────────────────────────────
    if (msg.type === "chat") {
      const lastChatTime = this.lastChat.get(id) ?? 0;
      if (now - lastChatTime < CHAT_INTERVAL_MS) return;
      this.lastChat.set(id, now);

      const raw = typeof msg.text === "string" ? msg.text.trim().slice(0, CHAT_MAX_LENGTH) : "";
      if (raw.length === 0) return;

      const chatMsg: ServerMsg = { type: "chat", id, login: player.login, text: raw };
      this.room.broadcast(JSON.stringify(chatMsg));

      this.chatLog.push({ login: player.login, text: raw, ts: now });
      if (this.chatLog.length > CHAT_LOG_MAX) this.chatLog.shift();
      this.room.storage.put("chatLog", this.chatLog);
      return;
    }
  }

  // ── Disconnect ─────────────────────────────────────────────
  onClose(conn: Connection) {
    const id = conn.id;
    this.players.delete(id);
    this.lastMove.delete(id);
    this.lastChat.delete(id);

    const leaveMsg: ServerMsg = { type: "leave", id };
    this.room.broadcast(JSON.stringify(leaveMsg));

    this.broadcastCount();
  }

  private broadcastCount() {
    const countMsg: ServerMsg = { type: "player_count", count: this.players.size };
    this.room.broadcast(JSON.stringify(countMsg));
  }

  // ── HTTP: player count ─────────────────────────────────────
  async onRequest(request: Party.Request) {
    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ count: this.players.size }),
        { headers: corsHeaders },
      );
    }

    return new Response("Not found", { status: 404 });
  }
}

PresenceServer satisfies Party.Worker;

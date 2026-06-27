import { createBrowserSupabase } from "@/lib/supabase";
import type { ClientMsg, ServerMsg, PlayerState, ChatLogEntry, GameResult, AvatarLoadout } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

export interface ArcadeCallbacks {
  onSync: (players: PlayerState[]) => void;
  onJoin: (player: PlayerState) => void;
  onLeave: (id: string) => void;
  onMove: (id: string, x: number, y: number, dir: PlayerState["dir"], ackSeq?: number) => void;
  onChat: (id: string, text: string) => void;
  onChatHistory: (entries: ChatLogEntry[]) => void;
  onSit: (id: string, x: number, y: number, dir: PlayerState["dir"]) => void;
  onStand: (id: string, x: number, y: number) => void;
  onAvatar: (id: string, spriteId: number) => void;
  onLoadout: (id: string, loadout: AvatarLoadout) => void;
  onMapReload: (map: Record<string, unknown>) => void;
  onGameAck: (game: string) => void;
  onGameResult: (game: string, result: GameResult) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const PRESENCE_TRACK_THROTTLE_MS = 1500;

let channel: RealtimeChannel | null = null;
let currentCallbacks: ArcadeCallbacks | null = null;
let currentSlug = "lobby";
let localUserId = "";
let localGithubLogin = "";
let localAvatarUrl = "";
let localSpriteId = 0;
let localLoadout: AvatarLoadout | null = null;
let localToken = "";

let lastPresenceTrack = 0;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let activeGameToken: any = null;

// Track recent positions to prevent visual glitches during presence sync
const recentPositions = new Map<string, { x: number; y: number; dir: PlayerState["dir"] }>();

export function connect(
  token: string,
  callbacks: ArcadeCallbacks,
  spriteId?: number,
  slug: string = "lobby",
): void {
  if (channel) {
    disconnect();
  }

  currentCallbacks = callbacks;
  currentSlug = slug;
  localToken = token;
  if (spriteId !== undefined) {
    localSpriteId = spriteId;
  }

  callbacks.onStatusChange("connecting");

  const supabase = createBrowserSupabase();

  async function init() {
    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session) {
        callbacks.onStatusChange("error");
        return;
      }

      localUserId = session.user.id;
      localGithubLogin = (
        session.user.user_metadata?.user_name ??
        session.user.user_metadata?.preferred_username ??
        "anon"
      );
      localAvatarUrl = session.user.user_metadata?.avatar_url ?? "";

      // Fetch user loadout from Next.js avatar API (cached profile details)
      try {
        const avatarRes = await fetch("/api/arcade/avatar");
        const avatarData = await avatarRes.json();
        if (avatarData.loadout) {
          localLoadout = avatarData.loadout;
        }
      } catch (e) {
        console.warn("Could not load user loadout:", e);
      }

      // Fetch chat history from DB
      try {
        const { data: chatData } = await supabase
          .from("arcade_chat_messages")
          .select("username, text, created_at")
          .eq("room_id", slug)
          .order("created_at", { ascending: true })
          .limit(30);

        if (chatData) {
          const history: ChatLogEntry[] = chatData.map((c: any) => ({
            username: c.username,
            text: c.text,
            ts: new Date(c.created_at).getTime(),
          }));
          callbacks.onChatHistory(history);
        }
      } catch (e) {
        console.warn("Could not query room chat history:", e);
      }

      // Initialize Supabase Realtime Channel
      const chan = supabase.channel(`arcade:${slug}`, {
        config: {
          presence: { key: localUserId },
        },
      });
      channel = chan;

      const syncPlayers = () => {
        const presenceState = chan.presenceState();
        const playersList: PlayerState[] = [];

        for (const [key, presences] of Object.entries(presenceState)) {
          const p = (presences as any[])[0];
          if (p && p.github_login) {
            playersList.push({
              id: key,
              github_login: p.github_login,
              avatar_url: p.avatar_url ?? "",
              sprite_id: p.sprite_id ?? 0,
              loadout: p.loadout ?? undefined,
              x: p.x ?? 0,
              y: p.y ?? 0,
              dir: p.dir ?? "down",
            });
          }
        }

        // Apply recent movements
        for (const p of playersList) {
          const recent = recentPositions.get(p.id);
          if (recent) {
            p.x = recent.x;
            p.y = recent.y;
            p.dir = recent.dir;
          }
        }

        callbacks.onSync(playersList);
      };

      chan
        .on("presence", { event: "sync" }, () => {
          syncPlayers();
        })
        .on("presence", { event: "join" }, ({ key }: { key: string }) => {
          syncPlayers();
        })
        .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
          recentPositions.delete(key);
          syncPlayers();
          callbacks.onLeave(key);
        })
        .on("broadcast", { event: "move" }, ({ payload }: { payload: any }) => {
          const { id, x, y, dir, ackSeq } = payload;
          if (id === localUserId) return;
          recentPositions.set(id, { x, y, dir });
          callbacks.onMove(id, x, y, dir, ackSeq);
        })
        .on("broadcast", { event: "chat" }, ({ payload }: { payload: any }) => {
          const { id, text } = payload;
          if (id === localUserId) return;
          callbacks.onChat(id, text);
        })
        .on("broadcast", { event: "sit" }, ({ payload }: { payload: any }) => {
          const { id, x, y, dir } = payload;
          if (id === localUserId) return;
          recentPositions.set(id, { x, y, dir });
          callbacks.onSit(id, x, y, dir);
        })
        .on("broadcast", { event: "stand" }, ({ payload }: { payload: any }) => {
          const { id, x, y } = payload;
          if (id === localUserId) return;
          if (recentPositions.has(id)) {
            recentPositions.get(id)!.x = x;
            recentPositions.get(id)!.y = y;
          }
          callbacks.onStand(id, x, y);
        })
        .on("broadcast", { event: "avatar" }, ({ payload }: { payload: any }) => {
          const { id, sprite_id } = payload;
          if (id === localUserId) return;
          callbacks.onAvatar(id, sprite_id);
        })
        .on("broadcast", { event: "loadout" }, ({ payload }: { payload: any }) => {
          const { id, loadout } = payload;
          if (id === localUserId) return;
          callbacks.onLoadout(id, loadout);
        })
        .on("broadcast", { event: "warp" }, ({ payload }: { payload: any }) => {
          const { id, x, y, dir } = payload;
          if (id === localUserId) return;
          recentPositions.set(id, { x, y, dir });
          callbacks.onMove(id, x, y, dir);
        })
        .on("broadcast", { event: "map_reload" }, ({ payload }: { payload: any }) => {
          callbacks.onMapReload(payload.map);
        });

      chan.subscribe((subStatus: string) => {
        if (subStatus === "SUBSCRIBED") {
          callbacks.onStatusChange("connected");

          // Start position in room
          const startX = 2;
          const startY = 2;
          recentPositions.set(localUserId, { x: startX, y: startY, dir: "down" });

          chan.track({
            github_login: localGithubLogin,
            avatar_url: localAvatarUrl,
            sprite_id: localSpriteId,
            loadout: localLoadout,
            x: startX,
            y: startY,
            dir: "down",
          });

          // Setup active player heartbeat in DB
          const sendHeartbeat = () => {
            supabase
              .from("arcade_active_players")
              .upsert({
                user_id: localUserId,
                room_id: slug,
                last_heartbeat: new Date().toISOString(),
              })
              .then(() => {});
          };
          sendHeartbeat();
          heartbeatInterval = setInterval(sendHeartbeat, 20000);
        } else if (subStatus === "CLOSED" || subStatus === "CHANNEL_ERROR") {
          callbacks.onStatusChange("reconnecting");
        }
      });
    } catch (e) {
      callbacks.onStatusChange("error");
    }
  }

  init();
}

export function sendMove(msg: ClientMsg & { type: "move"; x?: number; y?: number }): void {
  if (!channel) return;
  const x = msg.x ?? 0;
  const y = msg.y ?? 0;
  const dir = msg.dir;
  const seq = msg.seq;

  // 1. Broadcast movement event to other clients
  channel.send({
    type: "broadcast",
    event: "move",
    payload: {
      id: localUserId,
      x,
      y,
      dir,
      ackSeq: seq,
    },
  });

  // 2. Throttled Presence tracking update
  const now = Date.now();
  if (now - lastPresenceTrack >= PRESENCE_TRACK_THROTTLE_MS) {
    channel.track({
      github_login: localGithubLogin,
      avatar_url: localAvatarUrl,
      sprite_id: localSpriteId,
      loadout: localLoadout,
      x,
      y,
      dir,
    });
    lastPresenceTrack = now;
  }

  // 3. Cache position locally
  recentPositions.set(localUserId, { x, y, dir });

  // 4. Echo callback asynchronously to client for input drops / sync ticks
  if (seq !== undefined) {
    setTimeout(() => {
      currentCallbacks?.onMove(localUserId, x, y, dir, seq);
    }, 0);
  }
}

const CHAT_MAX_LENGTH = 100;

export function sendChat(text: string): void {
  if (!channel) return;
  const trimmed = text.slice(0, CHAT_MAX_LENGTH).trim();
  if (!trimmed) return;

  // 1. Broadcast chat event to other clients
  channel.send({
    type: "broadcast",
    event: "chat",
    payload: {
      id: localUserId,
      text: trimmed,
    },
  });

  // 2. Insert chat message into Database
  const supabase = createBrowserSupabase();
  supabase
    .from("arcade_chat_messages")
    .insert({
      room_id: currentSlug,
      user_id: localUserId,
      username: localGithubLogin,
      text: trimmed,
    })
    .then(() => {});

  // 3. Call local callback directly for fast render response
  currentCallbacks?.onChat(localUserId, trimmed);
}

export function sendSit(x: number, y: number, dir: "up" | "down" | "left" | "right"): void {
  if (!channel) return;

  channel.send({
    type: "broadcast",
    event: "sit",
    payload: {
      id: localUserId,
      x,
      y,
      dir,
    },
  });

  channel.track({
    github_login: localGithubLogin,
    avatar_url: localAvatarUrl,
    sprite_id: localSpriteId,
    loadout: localLoadout,
    x,
    y,
    dir,
    status: "sitting",
  });

  recentPositions.set(localUserId, { x, y, dir });
  currentCallbacks?.onSit(localUserId, x, y, dir);
}

export function sendStand(): void {
  if (!channel) return;
  const currentPos = recentPositions.get(localUserId) || { x: 2, y: 2, dir: "down" as const };

  channel.send({
    type: "broadcast",
    event: "stand",
    payload: {
      id: localUserId,
      x: currentPos.x,
      y: currentPos.y,
    },
  });

  channel.track({
    github_login: localGithubLogin,
    avatar_url: localAvatarUrl,
    sprite_id: localSpriteId,
    loadout: localLoadout,
    x: currentPos.x,
    y: currentPos.y,
    dir: currentPos.dir,
  });

  currentCallbacks?.onStand(localUserId, currentPos.x, currentPos.y);
}

export function sendAvatar(spriteId: number): void {
  if (!channel) return;
  localSpriteId = spriteId;

  channel.send({
    type: "broadcast",
    event: "avatar",
    payload: {
      id: localUserId,
      sprite_id: spriteId,
    },
  });

  const currentPos = recentPositions.get(localUserId) || { x: 2, y: 2, dir: "down" as const };
  channel.track({
    github_login: localGithubLogin,
    avatar_url: localAvatarUrl,
    sprite_id: spriteId,
    loadout: localLoadout,
    x: currentPos.x,
    y: currentPos.y,
    dir: currentPos.dir,
  });

  currentCallbacks?.onAvatar(localUserId, spriteId);
}

export function sendLoadout(loadout: AvatarLoadout): void {
  if (!channel) return;
  localLoadout = loadout;

  channel.send({
    type: "broadcast",
    event: "loadout",
    payload: {
      id: localUserId,
      loadout,
    },
  });

  const currentPos = recentPositions.get(localUserId) || { x: 2, y: 2, dir: "down" as const };
  channel.track({
    github_login: localGithubLogin,
    avatar_url: localAvatarUrl,
    sprite_id: localSpriteId,
    loadout,
    x: currentPos.x,
    y: currentPos.y,
    dir: currentPos.dir,
  });

  currentCallbacks?.onLoadout(localUserId, loadout);
}

export function sendGameStart(game: string): void {
  fetch("/api/arcade/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
    body: JSON.stringify({ action: "start", game, slug: currentSlug }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.game_token) {
        activeGameToken = d.game_token;
        currentCallbacks?.onGameAck(game);
      }
    })
    .catch(() => {});
}

export function sendGameStop(game: string): void {
  fetch("/api/arcade/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    },
    body: JSON.stringify({
      action: "stop",
      game,
      slug: currentSlug,
      game_token: activeGameToken,
    }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.result) {
        currentCallbacks?.onGameResult(game, d.result);
      }
    })
    .catch(() => {});
}

export function sendWarp(x: number, y: number): void {
  if (!channel) return;
  const currentPos = recentPositions.get(localUserId) || { dir: "down" as const };

  channel.send({
    type: "broadcast",
    event: "warp",
    payload: {
      id: localUserId,
      x,
      y,
      dir: currentPos.dir,
    },
  });

  channel.track({
    github_login: localGithubLogin,
    avatar_url: localAvatarUrl,
    sprite_id: localSpriteId,
    loadout: localLoadout,
    x,
    y,
    dir: currentPos.dir,
  });

  recentPositions.set(localUserId, { x, y, dir: currentPos.dir });
  currentCallbacks?.onMove(localUserId, x, y, currentPos.dir);
}

export function disconnect(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Remove player presence heartbeat from DB immediately on active disconnect
  if (localUserId && currentSlug) {
    const supabase = createBrowserSupabase();
    supabase
      .from("arcade_active_players")
      .delete()
      .eq("user_id", localUserId)
      .then(() => {});
  }

  if (channel) {
    channel.unsubscribe();
    channel = null;
  }

  recentPositions.clear();
  currentCallbacks = null;
  activeGameToken = null;
}

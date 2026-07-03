import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, broadcastToChannel } from "@/lib/supabase";
import crypto from "crypto";

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("[api/arcade/game] Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return secret;
}
const GAME_TARGET_MS = 10000;
const GAME_TIMEOUT_MS = 60000;
const VALID_GAMES = ["10s_classic"];

// Milestone evaluation moved to atomic RPC `submit_arcade_score`.

function signToken(userId: string, game: string, startTime: number): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${userId}:${game}:${startTime}`)
    .digest("hex");
}

function verifyToken(userId: string, game: string, startTime: number, sig: string): boolean {
  return signToken(userId, game, startTime) === sig;
}

// POST /api/arcade/game — handles game actions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, game, slug } = body;

    if (!action || !game || !VALID_GAMES.includes(game)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    // Auth check
    const sb = getSupabaseAdmin();
    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = user.id;
    const login = (
      user.user_metadata?.user_name ??
      user.user_metadata?.preferred_username ??
      "anonymous"
    );

    const now = Date.now();

    // ─── START GAME ───────────────────────────────────────────
    if (action === "start") {
      const startTime = now;
      const signature = signToken(userId, game, startTime);
      return NextResponse.json({
        ok: true,
        game_token: { startTime, signature },
      });
    }

    // ─── STOP GAME ────────────────────────────────────────────
    if (action === "stop") {
      const { game_token } = body;
      if (!game_token || typeof game_token.startTime !== "number" || !game_token.signature) {
        return NextResponse.json({ error: "Missing game token" }, { status: 400 });
      }

      const { startTime, signature } = game_token;
      if (!verifyToken(userId, game, startTime, signature)) {
        return NextResponse.json({ error: "Tampered game token" }, { status: 403 });
      }

      const elapsed = now - startTime;
      const diff_ms = Math.abs(elapsed - GAME_TARGET_MS);

      if (diff_ms > GAME_TIMEOUT_MS) {
        return NextResponse.json({ error: "Game timeout" }, { status: 400 });
      }

      // Persist score & milestones atomically via RPC.
      // Always use the `submit_arcade_score` RPC as single source of truth.
      let best_ms = diff_ms;
      let attempts = 1;
      let is_new_record = true;
      let rank: number | null = null;
      const milestones_earned: string[] = [];
      let px_earned = 0;

      // Lookup developer id (may be null) to pass through to RPC
      const { data: devRows } = await sb
        .from("developers")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      const developerId: number | null = devRows?.[0]?.id ?? null;

      type SubmitResult = {
        best_ms: number;
        attempts: number;
        is_new_record: boolean;
        rank: number | null;
        milestones: string[];
        px_earned: number;
      };

      try {
        const { data: rpcData, error: rpcErr } = await sb.rpc("submit_arcade_score", {
          p_developer_id: developerId,
          p_user_id: userId,
          p_game: game,
          p_diff_ms: diff_ms,
          p_slug: slug ?? null,
        });

        if (rpcErr) throw rpcErr;
        const raw = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const res = raw as SubmitResult | undefined;
        if (res) {
          best_ms = res.best_ms;
          attempts = res.attempts;
          is_new_record = res.is_new_record;
          rank = res.rank;
          px_earned = res.px_earned ?? 0;
          if (res.milestones) milestones_earned.push(...res.milestones);
        }
      } catch (err) {
        console.error("[api/arcade/game] submit_arcade_score RPC error:", err);
        return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
      }

      // 5. Check achievements
      try {
        const { data: allAchievements } = await sb
          .from("achievements")
          .select("id, threshold")
          .eq("category", "arcade");

        if (allAchievements && allAchievements.length > 0) {
          const { data: devRows } = await sb
            .from("developers")
            .select("id")
            .eq("user_id", userId);

          const developerId = devRows?.[0]?.id;
          if (developerId) {
            const { data: unlockedAchievements } = await sb
              .from("developer_achievements")
              .select("achievement_id")
              .eq("developer_id", developerId);

            const unlocked = new Set((unlockedAchievements ?? []).map((a) => a.achievement_id));
            const newAchievements = allAchievements.filter((a) => {
              if (unlocked.has(a.id)) return false;
              if (a.id === "arcade_hello_friend") return true;
              return diff_ms <= a.threshold;
            });

            if (newAchievements.length > 0) {
              await sb
                .from("developer_achievements")
                .insert(newAchievements.map((a) => ({ developer_id: developerId, achievement_id: a.id })));
            }
          }
        }
      } catch (achievementErr) {
        console.error("[api/arcade/game] achievement error:", achievementErr);
      }

      const result = {
        diff_ms,
        best_ms,
        attempts,
        is_new_record,
        rank,
        milestones_earned,
        px_earned,
      };

      // 6. If top 10 new record, broadcast to room and insert into DB chat messages
      if (is_new_record && rank !== null && rank <= 10 && slug) {
        const chatText = `${login} scored ${diff_ms}ms off on 10s Challenge! (#${rank})`;
        
        // Save system message in database
        await sb.from("arcade_chat_messages").insert({
          room_id: slug,
          user_id: userId,
          username: "SYSTEM",
          text: chatText,
        });

        // Broadcast chat to realtime channel
        await broadcastToChannel(`arcade:${slug}`, "chat", {
          id: "__system__",
          username: "SYSTEM",
          text: chatText,
          ts: Date.now(),
        });
      }

      return NextResponse.json({
        ok: true,
        result,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[api/arcade/game] error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, broadcastToChannel } from "@/lib/supabase";
import crypto from "crypto";

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";
const GAME_TARGET_MS = 10000;
const GAME_TIMEOUT_MS = 60000;
const VALID_GAMES = ["10s_classic"];

interface MilestoneDef {
  id: string;
  max_diff_ms: number;
  px: number;
}

const MILESTONES: MilestoneDef[] = [
  { id: "first_try", max_diff_ms: Infinity, px: 5 },
  { id: "close_enough", max_diff_ms: 500, px: 10 },
  { id: "sharp", max_diff_ms: 100, px: 25 },
  { id: "sniper", max_diff_ms: 50, px: 50 },
  { id: "inhuman", max_diff_ms: 10, px: 100 },
  { id: "perfection", max_diff_ms: 5, px: 250 },
];

function signToken(userId: string, game: string, startTime: number): string {
  return crypto
    .createHmac("sha256", SECRET)
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

      // Persist score & milestones & achievements (analogous to submitScore in PartyKit server)
      let best_ms = diff_ms;
      let attempts = 1;
      let is_new_record = true;
      let rank: number | null = null;
      const milestones_earned: string[] = [];
      let px_earned = 0;

      // 1. Get current best score + attempt count
      const { data: scoreRows } = await sb
        .from("arcade_scores")
        .select("best_ms, attempts")
        .eq("user_id", userId)
        .eq("game", game);

      const current = scoreRows?.[0] ?? null;
      const prevBest = current?.best_ms ?? Infinity;
      attempts = (current?.attempts ?? 0) + 1;
      is_new_record = diff_ms < prevBest;
      best_ms = Math.min(diff_ms, prevBest);

      // 2. Upsert score
      if (current) {
        const updateBody: Record<string, unknown> = {
          attempts,
          updated_at: new Date().toISOString(),
        };
        if (is_new_record) {
          updateBody.best_ms = diff_ms;
        }
        await sb
          .from("arcade_scores")
          .update(updateBody)
          .eq("user_id", userId)
          .eq("game", game);
      } else {
        await sb
          .from("arcade_scores")
          .insert({ user_id: userId, game, best_ms: diff_ms, attempts: 1 });
      }

      // 3. Get rank if new record
      if (is_new_record) {
        const { count } = await sb
          .from("arcade_scores")
          .select("user_id", { count: "exact", head: true })
          .eq("game", game)
          .lt("best_ms", best_ms);
        rank = (count ?? 0) + 1;
      } else {
        // Get rank of current best
        const { count } = await sb
          .from("arcade_scores")
          .select("user_id", { count: "exact", head: true })
          .eq("game", game)
          .lt("best_ms", best_ms);
        rank = (count ?? 0) + 1;
      }

      // 4. Check milestones
      try {
        const { data: existingMilestones } = await sb
          .from("arcade_milestones")
          .select("milestone")
          .eq("user_id", userId)
          .eq("game", game);

        const existingSet = new Set((existingMilestones ?? []).map((m) => m.milestone));
        const newMilestones: MilestoneDef[] = [];

        for (const m of MILESTONES) {
          if (existingSet.has(m.id)) continue;
          if (m.id === "first_try" || diff_ms <= m.max_diff_ms) {
            newMilestones.push(m);
          }
        }

        if (newMilestones.length > 0) {
          await sb
            .from("arcade_milestones")
            .insert(newMilestones.map((m) => ({ user_id: userId, game, milestone: m.id })));

          px_earned = newMilestones.reduce((sum, m) => sum + m.px, 0);
          milestones_earned.push(...newMilestones.map((m) => m.id));

          // Credit PX via RPC
          if (px_earned > 0) {
            const { data: devRows } = await sb
              .from("developers")
              .select("id")
              .eq("user_id", userId);

            const developerId = devRows?.[0]?.id;
            if (developerId) {
              await sb.rpc("credit_pixels", {
                p_developer_id: developerId,
                p_amount: px_earned,
                p_source: "arcade_milestone",
                p_reference_id: game,
                p_reference_type: "arcade",
                p_description: `Arcade milestones: ${milestones_earned.join(", ")}`,
                p_idempotency_key: `arcade_${userId}_${game}_${milestones_earned.join("_")}`,
              });
            }
          }
        }
      } catch (milestoneErr) {
        console.error("[api/arcade/game] milestone error:", milestoneErr);
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

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

type ArenaItem = {
  id: number;
  name: string;
  slug: string;
  rarity: string;
  item_type: string;
  icon_path: string;
};

const ALLOWED_STATUSES = new Set([
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "runtime_error",
  "compile_error",
  "memory_limit_exceeded",
]);

const ALLOWED_LANGUAGES = new Set([
  "python",
  "python3",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "c",
  "csharp",
  "go",
  "rust",
  "ruby",
  "swift",
  "kotlin",
  "scala",
  "php",
]);

const MAX_CODE_BYTES = 65536;
const CODE_HASH_RE = /^[0-9a-f]{1,128}$/i;

async function rollItemDrops(
  sb: SupabaseClient,
  difficulty: string,
  devId: number,
): Promise<ArenaItem[]> {
  const droppedItems: ArenaItem[] = [];

  /**
   * Fetch all items once up front instead of querying per rarity per call.
   * A single hard-difficulty roll could previously trigger up to 4 sequential
   * round trips (including duplicate "epic" fetches for the same rarity).
   */
  const { data: allItems } = await sb.from("arena_items").select("*");
  const itemsByRarity: Record<string, ArenaItem[]> = {};
  for (const item of allItems ?? []) {
    (itemsByRarity[item.rarity] ??= []).push(item);
  }

  const getRandomItemByRarity = (rarity: string): ArenaItem | null => {
    const pool = itemsByRarity[rarity];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return null;
  };

  const roll = Math.random();

  if (difficulty === "easy") {
    const common = getRandomItemByRarity("common");
    if (common) droppedItems.push(common);
    if (roll < 0.15) {
      const rare = getRandomItemByRarity("rare");
      if (rare) droppedItems.push(rare);
    }
  } else if (difficulty === "medium") {
    const rare = getRandomItemByRarity("rare");
    if (rare) droppedItems.push(rare);
    if (roll < 0.2) {
      const epic = getRandomItemByRarity("epic");
      if (epic) droppedItems.push(epic);
    } else if (roll < 0.3) {
      const rare2 = getRandomItemByRarity("rare");
      if (rare2) droppedItems.push(rare2);
    }
  } else if (difficulty === "hard") {
    const epic = getRandomItemByRarity("epic");
    if (epic) droppedItems.push(epic);

    // Use a single roll to pick at most one of: rare bonus, legendary, epic+rare bonus.
    // Previously three independent Math.random() calls could all fire at once.
    const bonusRoll = Math.random();
    if (bonusRoll < 0.05) {
      const legendary = getRandomItemByRarity("legendary");
      if (legendary) droppedItems.push(legendary);
    } else if (bonusRoll < 0.13) {
      // 0.08 wide window (epic+rare bonus pack)
      const epicBonus = getRandomItemByRarity("epic");
      const rareBonus = getRandomItemByRarity("rare");
      if (epicBonus) droppedItems.push(epicBonus);
      if (rareBonus) droppedItems.push(rareBonus);
    } else if (bonusRoll < 0.38) {
      // 0.25 wide window (single rare bonus)
      const rare = getRandomItemByRarity("rare");
      if (rare) droppedItems.push(rare);
    }
  }

  // Save dropped items to user's inventory concurrently (was sequential await-in-loop)
  await Promise.all(
    droppedItems.map((item) =>
      sb.rpc("upsert_arena_inventory_item", {
        p_user_id: devId,
        p_item_id: item.id,
      }),
    ),
  );

  return droppedItems;
}

export async function POST(request: NextRequest) {
  const dev = await getAuthenticatedDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const {
    challenge_id,
    problem_id,
    language,
    code_hash,
    code,
    status,
    tests_passed,
    tests_total,
    execution_time_ms,
  } = body;

  if (!problem_id || !status) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  if (language !== undefined && language !== null) {
    if (typeof language !== "string" || !ALLOWED_LANGUAGES.has(language)) {
      return NextResponse.json({ error: "Invalid language value" }, { status: 400 });
    }
  }

  if (code !== undefined && code !== null) {
    if (typeof code !== "string") {
      return NextResponse.json({ error: "Invalid code value" }, { status: 400 });
    }
    if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
      return NextResponse.json({ error: "Code exceeds maximum size limit" }, { status: 400 });
    }
  }

  if (code_hash !== undefined && code_hash !== null) {
    if (typeof code_hash !== "string" || !CODE_HASH_RE.test(code_hash)) {
      return NextResponse.json({ error: "Invalid code_hash format" }, { status: 400 });
    }
  }

  const sb = getSupabaseAdmin();

  // Validate problem_id exists in arena_problems before doing any reward work
  const { data: problemRow, error: problemLookupError } = await sb
    .from("arena_problems")
    .select("id")
    .eq("id", problem_id)
    .maybeSingle();

  if (problemLookupError) {
    return NextResponse.json({ error: "Failed to validate problem" }, { status: 500 });
  }

  if (!problemRow) {
    return NextResponse.json({ error: "Invalid problem_id" }, { status: 400 });
  }

  // 1. Fetch challenge details (if linked) and developer timezone in parallel
  let challenge: { difficulty: string; reward_points: number; reward_xp: number } | null = null;
  let difficulty = "medium";
  let basePoints = 100;
  let baseXp = 10;

  const [challengeResult, devProfileResult] = await Promise.all([
    challenge_id
      ? sb
          .from("arena_challenges")
          .select("*")
          .eq("id", challenge_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from("developers").select("timezone").eq("id", dev.id).maybeSingle(),
  ]);

  challenge = challengeResult.data;
  if (challenge) {
    difficulty = challenge.difficulty;
    basePoints = challenge.reward_points || 100;
    baseXp = challenge.reward_xp || 10;
  }

  // Use the developer's stored IANA timezone so streak boundaries are local-date-correct.
  // Falls back to UTC if not set, matching the RPC default.
  const devTimezone: string = devProfileResult.data?.timezone ?? "UTC";

  // 2. Insert submission record
  const { error: insertError } = await sb.from("arena_submissions").insert({
    user_id: dev.id,
    problem_id,
    challenge_id: challenge_id || null,
    language,
    code_hash,
    code,
    status,
    tests_passed: tests_passed || 0,
    tests_total: tests_total || 0,
    execution_time_ms: execution_time_ms || null,
    is_verified: false,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 3. Process rewards only for accepted submissions
  const isAccepted = status === "accepted";
  let grantedXp = 0;
  let grantedPoints = 0;
  let droppedItems: ArenaItem[] = [];
  let isFirstSolve = false;

  if (isAccepted) {
    // Fetch active buffs to compute multipliers before the atomic claim
    const { data: activeBuffs } = await sb
      .from("arena_active_buffs")
      .select("buff_type, buff_value")
      .eq("user_id", dev.id)
      .gt("expires_at", new Date().toISOString());

    let xpMultiplier = 1.0;
    let pointsMultiplier = 1.0;

    if (activeBuffs) {
      for (const buff of activeBuffs) {
        if (buff.buff_type === "xp_boost") {
          xpMultiplier += buff.buff_value - 1.0;
        } else if (buff.buff_type === "reward_multiplier") {
          xpMultiplier += buff.buff_value - 1.0;
          pointsMultiplier += buff.buff_value - 1.0;
        }
      }
    }

    grantedXp = Math.round(baseXp * xpMultiplier);
    grantedPoints = Math.round(basePoints * pointsMultiplier);

    // Atomic first-solve claim — INSERT (ON CONFLICT DO NOTHING inside Postgres)
    // Only the first concurrent caller wins (won_race = true).
    const { data: claimResult, error: claimError } = await sb.rpc(
      "claim_first_solve",
      {
        p_user_id: dev.id,
        p_challenge_id: challenge_id || null,
        p_problem_id: challenge_id ? null : problem_id,
        p_points: grantedPoints,
        p_xp: grantedXp,
      },
    );

    if (claimError) {
      console.error("[arena/submit] claim_first_solve error:", claimError);
      return NextResponse.json(
        { error: "Failed to process submission" },
        { status: 500 },
      );
    }

    isFirstSolve = claimResult?.[0]?.won_race === true;

    if (isFirstSolve) {
      await sb.rpc("grant_xp_atomic", {
        p_developer_id: dev.id,
        p_source: `arena_${difficulty}`,
        p_amount: grantedXp,
      });

      droppedItems = await rollItemDrops(sb, difficulty, dev.id);

      // Track arena solve to update relic progress atomically
      try {
        const { data: newSolves, error: relicErr } = await sb.rpc("increment_relic_progress", {
          p_developer_id: dev.id,
          p_field: "arena_solves",
        });

        if (relicErr) {
          console.error("[arena/submit] increment_relic_progress error:", relicErr.message);
        } else if ((newSolves ?? 0) >= 20) {
          await sb.from("developer_relics").upsert(
            {
              developer_id: dev.id,
              relic_id: "relic_neo_holo_visor",
              is_equipped: false,
              created_at: new Date().toISOString(),
            },
            { onConflict: "developer_id,relic_id" }
          );
        }
      } catch (err) {
        console.error("[arena/submit] Failed to track arena solve for relic:", err);
      }
    }
  }

  /**
   4. Update rating and streak statistics atomically via DB function.
      p_timezone ensures streak boundaries are evaluated in the developer's local date,
      not always UTC — fixing the bug where a solve at e.g. 23:30 IST broke a streak.
  */
  const { error: ratingsError } = await sb.rpc("update_arena_ratings_atomic", {
    p_user_id: dev.id,
    p_is_accepted: isAccepted,
    p_is_first_solve: isFirstSolve,
    p_difficulty: difficulty,
    p_timezone: devTimezone,
  });

  if (ratingsError) {
    console.error(
      "[arena/submit] update_arena_ratings_atomic error:",
      ratingsError,
    );
    return NextResponse.json(
      { error: "Failed to update ratings" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "success",
    submission_status: status,
    is_first_solve: isFirstSolve,
    rewards: {
      points: grantedPoints,
      xp: grantedXp,
    },
    dropped_items: droppedItems.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      rarity: item.rarity,
      item_type: item.item_type,
      icon_path: item.icon_path,
    })),
  });
}

export const dynamic = "force-dynamic";
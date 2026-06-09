import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

async function rollItemDrops(sb: any, difficulty: string, devId: number): Promise<any[]> {
  const droppedItems: any[] = [];

  const getRandomItemByRarity = async (rarity: string): Promise<any> => {
    const { data } = await sb
      .from("arena_items")
      .select("*")
      .eq("rarity", rarity);
    
    if (data && data.length > 0) {
      return data[Math.floor(Math.random() * data.length)];
    }
    return null;
  };

  const roll = Math.random();

  if (difficulty === "easy") {
    const common = await getRandomItemByRarity("common");
    if (common) droppedItems.push(common);
    if (roll < 0.15) {
      const rare = await getRandomItemByRarity("rare");
      if (rare) droppedItems.push(rare);
    }
  } else if (difficulty === "medium") {
    const rare = await getRandomItemByRarity("rare");
    if (rare) droppedItems.push(rare);
    if (roll < 0.20) {
      const epic = await getRandomItemByRarity("epic");
      if (epic) droppedItems.push(epic);
    } else if (roll < 0.30) {
      const rare2 = await getRandomItemByRarity("rare");
      if (rare2) droppedItems.push(rare2);
    }
  } else if (difficulty === "hard") {
    const epic = await getRandomItemByRarity("epic");
    if (epic) droppedItems.push(epic);
    if (roll < 0.25) {
      const rare = await getRandomItemByRarity("rare");
      if (rare) droppedItems.push(rare);
    }
    if (Math.random() < 0.05) {
      const legendary = await getRandomItemByRarity("legendary");
      if (legendary) droppedItems.push(legendary);
    }
    if (Math.random() < 0.08) {
      const epicBonus = await getRandomItemByRarity("epic");
      const rareBonus = await getRandomItemByRarity("rare");
      if (epicBonus) droppedItems.push(epicBonus);
      if (rareBonus) droppedItems.push(rareBonus);
    }
  }

  // Save dropped items to user's inventory using atomic upsert
  // quantity increments atomically — no read-then-write here either
  for (const item of droppedItems) {
    await sb.rpc("upsert_arena_inventory_item", {
      p_user_id: devId,
      p_item_id: item.id,
    });
  }

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
    execution_time_ms
  } = body;

  if (!problem_id || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1. Fetch challenge details (if linked)
  let challenge: any = null;
  let difficulty = "medium";
  let basePoints = 100;
  let baseXp = 10;

  if (challenge_id) {
    const { data: ch } = await sb
      .from("arena_challenges")
      .select("*")
      .eq("id", challenge_id)
      .maybeSingle();
    challenge = ch;
    if (challenge) {
      difficulty = challenge.difficulty;
      basePoints = challenge.reward_points || 100;
      baseXp = challenge.reward_xp || 10;
    }
  }

  // 2. Insert submission record
  const { error: insertError } = await sb
    .from("arena_submissions")
    .insert({
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
  let droppedItems: any[] = [];
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
          xpMultiplier += (buff.buff_value - 1.0);
        } else if (buff.buff_type === "reward_multiplier") {
          xpMultiplier += (buff.buff_value - 1.0);
          pointsMultiplier += (buff.buff_value - 1.0);
        }
      }
    }

    grantedXp = Math.round(baseXp * xpMultiplier);
    grantedPoints = Math.round(basePoints * pointsMultiplier);

    // ── Atomic first-solve claim ──────────────────────────────────
    // claim_first_solve() does an INSERT ... ON CONFLICT DO NOTHING
    // on the arena_first_solves table and atomically increments
    // developers.points inside the same DB function — only the first
    // concurrent caller wins (won_race = true); all others get false.
    const { data: claimResult, error: claimError } = await sb.rpc(
      "claim_first_solve",
      {
        p_user_id:      dev.id,
        p_challenge_id: challenge_id || null,
        p_problem_id:   challenge_id ? null : problem_id,
        p_points:       grantedPoints,
        p_xp:           grantedXp,
      }
    );

    if (claimError) {
      console.error("[arena/submit] claim_first_solve error:", claimError);
      return NextResponse.json({ error: "Failed to process submission" }, { status: 500 });
    }

    isFirstSolve = claimResult?.[0]?.won_race === true;

    if (isFirstSolve) {
      // Grant XP via existing RPC (idempotency handled by claim_first_solve above)
      await sb.rpc("grant_xp_atomic", {
        p_developer_id: dev.id,
        p_source: `arena_${difficulty}`,
        p_amount: grantedXp,
      });

      // Roll for item drops
      droppedItems = await rollItemDrops(sb, difficulty, dev.id);
    }
  }

  // 4. Update rating and streak statistics — atomically via DB function.
  // The RPC acquires a FOR UPDATE row lock so concurrent submissions
  // from the same account queue up inside Postgres; no delta is lost.
  const { error: ratingsError } = await sb.rpc("update_arena_ratings_atomic", {
    p_user_id:        dev.id,
    p_is_accepted:    isAccepted,
    p_is_first_solve: isFirstSolve,
    p_difficulty:     difficulty,
  });

  if (ratingsError) {
    console.error("[arena/submit] update_arena_ratings_atomic error:", ratingsError);
    return NextResponse.json({ error: "Failed to update ratings" }, { status: 500 });
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
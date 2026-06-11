import { createClient } from "@supabase/supabase-js";
import { syncCodeforcesProblems, rotateDailyChallenges } from "../src/lib/arena";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("-----------------------------------------");
  console.log("🏟️  Coding Arena Seeder & Verifier");
  console.log("-----------------------------------------");

  // 1. Sync problems from Codeforces (5 of each difficulty)
  console.log("\n1. Syncing problem pool from Codeforces API...");
  try {
    const totalSynced = await syncCodeforcesProblems(5);
    console.log(`✅ Synced a total of ${totalSynced} problems.`);
  } catch (err: any) {
    console.error("❌ Problem sync failed:", err.message);
  }

  // 2. Rotate daily challenges for today
  const todayStr = new Date().toISOString().split("T")[0];
  console.log(`\n2. Rotating daily challenges for today (${todayStr})...`);
  try {
    const rotated = await rotateDailyChallenges(todayStr);
    if (rotated) {
      console.log("✅ Daily challenges rotated successfully!");
    } else {
      console.error("❌ Daily challenges rotation failed.");
    }
  } catch (err: any) {
    console.error("❌ Daily challenges rotation encountered an error:", err.message);
  }

  // 3. Inspect seeded challenges
  console.log("\n3. Inspecting today's challenges in database:");
  const { data: challenges, error } = await sb
    .from("arena_challenges")
    .select(`
      id,
      difficulty,
      challenge_date,
      reward_points,
      reward_xp,
      problem:arena_problems (
        id,
        title,
        difficulty_rating,
        tags
      )
    `)
    .eq("challenge_date", todayStr);

  if (error) {
    console.error("❌ Failed to query challenges:", error.message);
  } else if (!challenges || challenges.length === 0) {
    console.log("❓ No challenges found for today.");
  } else {
    for (const ch of challenges) {
      const prob = ch.problem as any;
      console.log(`   - [${ch.difficulty.toUpperCase()}] ${prob?.title} (CF Rating: ${prob?.difficulty_rating})`);
      console.log(`     Rewards: ${ch.reward_points} pts, ${ch.reward_xp} XP`);
    }
  }

  console.log("\nSeeding complete!");
}

main().catch((err) => {
  console.error("Unhandled seeder error:", err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

import dotenv from "dotenv";

// Parse .env.local via dotenv
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function main() {
  console.log("Starting achievements v2 migration...");

  // 1. Delete old achievements that are no longer used
  console.log("Deleting old achievements (rising_star, popular, famous)...");
  const { error: delDevError } = await sb
    .from("developer_achievements")
    .delete()
    .in("achievement_id", ["rising_star", "popular", "famous"]);
  if (delDevError) {
    console.error("Error deleting developer_achievements:", delDevError.message);
  }

  const { error: delAchError } = await sb
    .from("achievements")
    .delete()
    .in("id", ["rising_star", "popular", "famous"]);
  if (delAchError) {
    console.error("Error deleting achievements:", delAchError.message);
  }

  // 2. Define updates for existing achievements
  const updates = [
    {
      id: "first_push",
      name: "First Blood",
      description: "Solve 1 LeetCode problem",
      category: "commits",
      threshold: 1,
    },
    {
      id: "committed",
      name: "Problem Solver",
      description: "Solve 100 LeetCode problems",
      category: "commits",
      threshold: 100,
    },
    {
      id: "grinder",
      name: "Grinder",
      description: "Solve 500 LeetCode problems",
      category: "commits",
      threshold: 500,
    },
    {
      id: "machine",
      name: "Algorithmist",
      description: "Solve 1,000 LeetCode problems",
      category: "commits",
      threshold: 1000,
    },
    {
      id: "legend",
      name: "Grandmaster",
      description: "Solve 2,500 LeetCode problems",
      category: "commits",
      threshold: 2500,
    },
    {
      id: "builder",
      name: "Easy Breezy",
      description: "Solve 100 Easy LeetCode problems",
      category: "easy_solved",
      threshold: 100,
    },
    {
      id: "architect",
      name: "Medium Master",
      description: "Solve 250 Medium LeetCode problems",
      category: "medium_solved",
      threshold: 250,
    },
    {
      id: "factory",
      name: "Hardcore",
      description: "Solve 100 Hard LeetCode problems",
      category: "hard_solved",
      threshold: 100,
    },
    {
      id: "god_mode",
      name: "God Mode",
      description: "Solve 500 Hard LeetCode problems",
      category: "hard_solved",
      threshold: 500,
    },
  ];

  console.log("Updating existing achievements...");
  for (const upd of updates) {
    const { error: updErr } = await sb
      .from("achievements")
      .update({
        name: upd.name,
        description: upd.description,
        category: upd.category,
        threshold: upd.threshold,
      })
      .eq("id", upd.id);

    if (updErr) {
      console.error(`Error updating achievement ${upd.id}:`, updErr.message);
    } else {
      console.log(`  Updated ${upd.id} -> ${upd.name}`);
    }
  }

  // 3. Define new platform contributor achievements
  const contributors = [
    {
      id: "contrib_planner",
      category: "contributors",
      name: "City Planner",
      description: "Merge 1 Pull Request into the platform",
      threshold: 1,
      tier: "silver",
      reward_type: "exclusive_badge",
      reward_item_id: null,
      sort_order: 150,
    },
    {
      id: "contrib_architect",
      category: "contributors",
      name: "Architect",
      description: "Merge 10 Pull Requests",
      threshold: 10,
      tier: "gold",
      reward_type: "exclusive_badge",
      reward_item_id: null,
      sort_order: 151,
    },
    {
      id: "contrib_founder",
      category: "contributors",
      name: "Founding Father",
      description: "Core Team Member / Major Feature Contributor",
      threshold: 1,
      tier: "diamond",
      reward_type: "exclusive_badge",
      reward_item_id: null,
      sort_order: 152,
    },
  ];

  console.log("Upserting contributor achievements...");
  const { error: upsertErr } = await sb
    .from("achievements")
    .upsert(contributors, { onConflict: "id" });

  if (upsertErr) {
    console.error("Error upserting contributor achievements:", upsertErr.message);
  } else {
    console.log("  Successfully upserted contributor achievements!");
  }

  console.log("Achievements v2 migration complete!");
}

main().catch(console.error);

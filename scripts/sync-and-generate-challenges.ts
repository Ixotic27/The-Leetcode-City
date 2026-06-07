import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const TARGET_PROBLEMS = 300;
const DAYS_TO_SCHEDULE = 1095; // 3 years

interface HFProblemRow {
  contest_id: number;
  index: string;
  title: string;
  description?: string;
  input_format?: string;
  output_format?: string;
  note?: string;
  examples?: Array<{ input: string; output: string }>;
  official_tests?: Array<{ input: string; output: string }>;
  rating?: number;
  tags?: string[];
  time_limit?: number;
  memory_limit?: number;
}

function cleanText(text: string | undefined): string {
  if (!text) return "";
  return text.trim();
}

async function main() {
  console.log("-----------------------------------------");
  console.log("🏟️  Arena Ingestor & 3-Year Daily Challenge Generator");
  console.log("-----------------------------------------");

  // Step 1: Query current problem counts in database
  console.log("Querying current problem counts in database...");
  
  const { count: easyCount } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "easy");

  const { count: mediumCount } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "medium");

  const { count: hardCount } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "hard");

  let seededCounts = {
    easy: easyCount || 0,
    medium: mediumCount || 0,
    hard: hardCount || 0
  };

  console.log(`Current stats in DB:`);
  console.log(` - Easy: ${seededCounts.easy}`);
  console.log(` - Medium: ${seededCounts.medium}`);
  console.log(` - Hard: ${seededCounts.hard}`);

  // Ingest from Hugging Face until we hit TARGET_PROBLEMS of each
  if (
    seededCounts.easy < TARGET_PROBLEMS ||
    seededCounts.medium < TARGET_PROBLEMS ||
    seededCounts.hard < TARGET_PROBLEMS
  ) {
    console.log(`\nNeed at least ${TARGET_PROBLEMS} problems per difficulty. Starting ingestion loop...`);
    let offset = 0;
    const limit = 100;
    let page = 1;
    let totalInserted = 0;

    while (true) {
      if (
        seededCounts.easy >= TARGET_PROBLEMS &&
        seededCounts.medium >= TARGET_PROBLEMS &&
        seededCounts.hard >= TARGET_PROBLEMS
      ) {
        console.log(`\n🎯 Reached target count of ${TARGET_PROBLEMS} problems for all difficulties!`);
        break;
      }

      console.log(`Fetching Page ${page} (offset: ${offset}, limit: ${limit})...`);
      const url = `https://datasets-server.huggingface.co/rows?dataset=open-r1/codeforces&config=default&split=train&offset=${offset}&limit=${limit}`;
      let rows: any[] = [];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        rows = json.rows || [];
      } catch (err: any) {
        console.error(`❌ Fetch page ${page} failed: ${err.message}. Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      if (rows.length === 0) {
        console.log("📭 Received empty rows from Hugging Face. End of dataset.");
        break;
      }

      for (const item of rows) {
        const row = item.row as HFProblemRow;
        if (!row.contest_id || !row.index || !row.title) continue;

        const sourceId = `${row.contest_id}-${row.index}`;
        const rating = row.rating;
        if (rating === undefined || rating === null) continue;

        // Determine difficulty
        let difficulty: "easy" | "medium" | "hard";
        if (rating < 1300) {
          difficulty = "easy";
        } else if (rating >= 1300 && rating < 1900) {
          difficulty = "medium";
        } else {
          difficulty = "hard";
        }

        if (seededCounts[difficulty] >= TARGET_PROBLEMS) continue;

        const examples = row.examples || [];
        const officialTests = row.official_tests || [];
        if (examples.length === 0 || officialTests.length === 0) continue;

        // Check if problem already exists
        const { data: existing } = await sb
          .from("arena_problems")
          .select("id")
          .eq("source", "codeforces")
          .eq("source_id", sourceId)
          .maybeSingle();

        if (existing) continue;

        // Build markdown
        let markdownDesc = `### Description\n\n${cleanText(row.description)}\n\n`;
        if (row.input_format) markdownDesc += `### Input Specification\n\n${cleanText(row.input_format)}\n\n`;
        if (row.output_format) markdownDesc += `### Output Specification\n\n${cleanText(row.output_format)}\n\n`;
        if (row.note) markdownDesc += `### Note\n\n${cleanText(row.note)}\n\n`;
        markdownDesc = markdownDesc.trim();

        const formattedSamples = examples.map(ex => ({ input: cleanText(ex.input), output: cleanText(ex.output) }));
        const formattedHidden = officialTests.map(ot => ({ input: cleanText(ot.input), output: cleanText(ot.output) }));

        const { error: insertErr } = await sb
          .from("arena_problems")
          .insert({
            source: "codeforces",
            source_id: sourceId,
            title: `${row.index}. ${row.title}`,
            description: markdownDesc,
            difficulty,
            difficulty_rating: rating,
            tags: row.tags || [],
            time_limit_ms: row.time_limit ? Math.round(row.time_limit * 1000) : 2000,
            memory_limit_mb: row.memory_limit || 256,
            sample_tests: formattedSamples,
            hidden_tests: formattedHidden,
            hints: []
          });

        if (!insertErr) {
          seededCounts[difficulty]++;
          totalInserted++;
          console.log(`   + Added [${difficulty.toUpperCase()}] CF ${sourceId}: "${row.title}" (Rating: ${rating})`);
        }
      }

      console.log(`Progress: Easy: ${seededCounts.easy}/${TARGET_PROBLEMS}, Medium: ${seededCounts.medium}/${TARGET_PROBLEMS}, Hard: ${seededCounts.hard}/${TARGET_PROBLEMS}`);
      offset += limit;
      page++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Step 2: Query all active problem IDs from the database to select from
  console.log("\nQuerying all available problem IDs from database...");
  const { data: allEasy } = await sb.from("arena_problems").select("id").eq("difficulty", "easy").eq("is_active", true);
  const { data: allMedium } = await sb.from("arena_problems").select("id").eq("difficulty", "medium").eq("is_active", true);
  const { data: allHard } = await sb.from("arena_problems").select("id").eq("difficulty", "hard").eq("is_active", true);

  const easyIds = allEasy?.map(p => p.id) ?? [];
  const mediumIds = allMedium?.map(p => p.id) ?? [];
  const hardIds = allHard?.map(p => p.id) ?? [];

  if (easyIds.length === 0 || mediumIds.length === 0 || hardIds.length === 0) {
    console.error("❌ Cannot generate challenges: One or more difficulty categories have 0 problems in the database!");
    process.exit(1);
  }

  console.log(`Loaded problem pools: ${easyIds.length} easy, ${mediumIds.length} medium, ${hardIds.length} hard.`);

  // Step 3: Fetch existing daily challenge dates to prevent duplication
  console.log("Checking existing daily challenges...");
  const { data: existingChallenges } = await sb
    .from("arena_challenges")
    .select("challenge_date")
    .eq("type", "daily");

  const existingDates = new Set(existingChallenges?.map(c => c.challenge_date) ?? []);
  console.log(`Found ${existingDates.size} dates with existing daily challenges.`);

  // Step 4: Generate daily challenges for the next 1095 days (3 years)
  console.log(`\nGenerating daily challenges for the next ${DAYS_TO_SCHEDULE} days...`);
  const challengesToInsert: any[] = [];
  const today = new Date();

  for (let i = 0; i < DAYS_TO_SCHEDULE; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const dateStr = futureDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    if (existingDates.has(dateStr)) {
      continue; // Date already has challenges, skip
    }

    const easyId = easyIds[Math.floor(Math.random() * easyIds.length)];
    const mediumId = mediumIds[Math.floor(Math.random() * mediumIds.length)];
    const hardId = hardIds[Math.floor(Math.random() * hardIds.length)];

    challengesToInsert.push(
      {
        type: "daily",
        problem_id: easyId,
        difficulty: "easy",
        challenge_date: dateStr,
        reward_points: 100,
        reward_xp: 10,
        reward_item_pool: ["common", "rare"]
      },
      {
        type: "daily",
        problem_id: mediumId,
        difficulty: "medium",
        challenge_date: dateStr,
        reward_points: 250,
        reward_xp: 25,
        reward_item_pool: ["rare", "epic"]
      },
      {
        type: "daily",
        problem_id: hardId,
        difficulty: "hard",
        challenge_date: dateStr,
        reward_points: 500,
        reward_xp: 50,
        reward_item_pool: ["epic", "legendary"]
      }
    );
  }

  console.log(`Generated ${challengesToInsert.length} challenges (${challengesToInsert.length / 3} days) to insert.`);

  // Step 5: Batch insert the challenges
  if (challengesToInsert.length > 0) {
    const BATCH_SIZE = 300; // 100 days at a time
    for (let i = 0; i < challengesToInsert.length; i += BATCH_SIZE) {
      const batch = challengesToInsert.slice(i, i + BATCH_SIZE);
      console.log(`Inserting batch ${i / BATCH_SIZE + 1} (${batch.length} challenges)...`);
      const { error } = await sb.from("arena_challenges").insert(batch);
      if (error) {
        console.error("❌ Batch insertion failed:", error.message);
        process.exit(1);
      }
    }
    console.log("✅ All challenges inserted successfully!");
  } else {
    console.log("✅ No new daily challenges needed (already fully scheduled).");
  }

  console.log("\n🎉 Done!");
}

main().catch(err => {
  console.error("❌ Script crashed:", err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables! Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const TARGET_PER_DIFFICULTY = 80;

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
  console.log("🏟️  Hugging Face Codeforces Problem Syncer");
  console.log("-----------------------------------------");

  // 1. Get current counts in the database
  console.log("Querying current problem counts in database...");
  
  const { count: easyCount, error: errEasy } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "easy");

  const { count: mediumCount, error: errMedium } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "medium");

  const { count: hardCount, error: errHard } = await sb
    .from("arena_problems")
    .select("*", { count: "exact", head: true })
    .eq("difficulty", "hard");

  if (errEasy || errMedium || errHard) {
    console.error("❌ Failed to query current counts:", errEasy || errMedium || errHard);
    process.exit(1);
  }

  let seededCounts = {
    easy: easyCount || 0,
    medium: mediumCount || 0,
    hard: hardCount || 0
  };

  console.log(`Current stats in DB:`);
  console.log(` - Easy: ${seededCounts.easy}`);
  console.log(` - Medium: ${seededCounts.medium}`);
  console.log(` - Hard: ${seededCounts.hard}`);

  if (
    seededCounts.easy >= TARGET_PER_DIFFICULTY &&
    seededCounts.medium >= TARGET_PER_DIFFICULTY &&
    seededCounts.hard >= TARGET_PER_DIFFICULTY
  ) {
    console.log("✅ Already have at least 80 problems of each difficulty. Synced successfully!");
    return;
  }

  // 2. Fetch and seed from HF Datasets Server
  let offset = 0;
  const limit = 100;
  let page = 1;
  let totalInserted = 0;

  console.log("\nStarting ingestion loop from Hugging Face open-r1/codeforces dataset...");

  while (true) {
    if (
      seededCounts.easy >= TARGET_PER_DIFFICULTY &&
      seededCounts.medium >= TARGET_PER_DIFFICULTY &&
      seededCounts.hard >= TARGET_PER_DIFFICULTY
    ) {
      console.log("\n🎯 Reached target count of 80 problems for all difficulties!");
      break;
    }

    console.log(`\nFetching Page ${page} (offset: ${offset}, limit: ${limit})...`);
    
    const url = `https://datasets-server.huggingface.co/rows?dataset=open-r1/codeforces&config=default&split=train&offset=${offset}&limit=${limit}`;
    let rows: any[] = [];
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      rows = json.rows || [];
    } catch (err: any) {
      console.error(`❌ Fetch page ${page} failed: ${err.message}. Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }

    if (rows.length === 0) {
      console.log("📭 Received empty rows from Hugging Face. End of dataset.");
      break;
    }

    console.log(`Received ${rows.length} rows. Processing...`);

    for (const item of rows) {
      const row = item.row as HFProblemRow;

      if (!row.contest_id || !row.index || !row.title) {
        continue;
      }

      const sourceId = `${row.contest_id}${row.index}`;

      // Check rating
      const rating = row.rating;
      if (rating === undefined || rating === null) {
        continue; // Skip problems without rating to ensure accurate difficulty placement
      }

      // Determine difficulty
      let difficulty: "easy" | "medium" | "hard";
      if (rating < 1300) {
        difficulty = "easy";
      } else if (rating >= 1300 && rating < 1900) {
        difficulty = "medium";
      } else {
        difficulty = "hard";
      }

      // Check if we already reached target for this difficulty
      if (seededCounts[difficulty] >= TARGET_PER_DIFFICULTY) {
        continue;
      }

      // Verify tests
      const examples = row.examples || [];
      const officialTests = row.official_tests || [];

      if (examples.length === 0) {
        continue; // Needs to have sample examples
      }
      if (officialTests.length === 0) {
        continue; // Needs to have hidden tests
      }

      // Check if problem already exists in DB
      const { data: existing } = await sb
        .from("arena_problems")
        .select("id")
        .eq("source", "codeforces")
        .eq("source_id", sourceId)
        .maybeSingle();

      if (existing) {
        continue;
      }

      // Build problem statement description in markdown
      let markdownDesc = `### Description\n\n${cleanText(row.description)}\n\n`;
      if (row.input_format) {
        markdownDesc += `### Input Specification\n\n${cleanText(row.input_format)}\n\n`;
      }
      if (row.output_format) {
        markdownDesc += `### Output Specification\n\n${cleanText(row.output_format)}\n\n`;
      }
      if (row.note) {
        markdownDesc += `### Note\n\n${cleanText(row.note)}\n\n`;
      }

      markdownDesc = markdownDesc.trim();

      // Clean sample/hidden test cases formatting: remove trailing whitespace and ensure standard structure
      const formattedSamples = examples.map(ex => ({
        input: cleanText(ex.input),
        output: cleanText(ex.output)
      }));

      const formattedHidden = officialTests.map(ot => ({
        input: cleanText(ot.input),
        output: cleanText(ot.output)
      }));

      // Insert into DB
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

      if (insertErr) {
        console.error(`❌ Error inserting problem ${sourceId}:`, insertErr.message);
      } else {
        seededCounts[difficulty]++;
        totalInserted++;
        console.log(`   + Added [${difficulty.toUpperCase()}] CF ${sourceId}: "${row.title}" (Rating: ${rating})`);
      }
    }

    console.log(`Progress: Easy: ${seededCounts.easy}/${TARGET_PER_DIFFICULTY}, Medium: ${seededCounts.medium}/${TARGET_PER_DIFFICULTY}, Hard: ${seededCounts.hard}/${TARGET_PER_DIFFICULTY}`);

    offset += limit;
    page++;

    // Small delay to prevent hitting API limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n-----------------------------------------");
  console.log(`🎉 Seeding Complete!`);
  console.log(`Inserted a total of ${totalInserted} new problems.`);
  console.log(`Final Database Stats:`);
  console.log(` - Easy: ${seededCounts.easy}`);
  console.log(` - Medium: ${seededCounts.medium}`);
  console.log(` - Hard: ${seededCounts.hard}`);
  console.log("-----------------------------------------");
}

main().catch(err => {
  console.error("❌ Script crashed:", err);
  process.exit(1);
});

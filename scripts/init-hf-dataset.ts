import { uploadFile } from "@huggingface/hub";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const HF_TOKEN = process.env.HF_WRITE_TOKEN;
const USERNAME = "Ixotic";
const DATASET_NAME = "coding-problems";
const REPO_ID = `${USERNAME}/${DATASET_NAME}`;

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

async function main() {
  console.log("-----------------------------------------");
  console.log("🚀 Initializing HF Private Dataset");
  console.log("-----------------------------------------");

  if (!HF_TOKEN) {
    console.error("❌ Missing HF_WRITE_TOKEN in .env.local");
    process.exit(1);
  }

  const TARGET_TOTAL = 3000;
  let offset = 0;
  const limit = 100;
  let totalFetched = 0;
  
  const outputFile = "temp_dataset.jsonl";
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  console.log(`Downloading ${TARGET_TOTAL} problems from open-r1/codeforces...`);

  while (totalFetched < TARGET_TOTAL) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=open-r1/codeforces&config=default&split=train&offset=${offset}&limit=${limit}`;
    
    let rows: any[] = [];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      rows = json.rows || [];
    } catch (err: any) {
      console.error(`Fetch failed at offset ${offset}: ${err.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }

    if (rows.length === 0) break;

    for (const item of rows) {
      const row = item.row as HFProblemRow;
      if (!row.contest_id || !row.index || !row.title || !row.rating) continue;

      let difficulty: "easy" | "medium" | "hard";
      if (row.rating < 1300) difficulty = "easy";
      else if (row.rating >= 1300 && row.rating < 1900) difficulty = "medium";
      else difficulty = "hard";

      // Append to JSONL file
      const newRow = {
        source_id: `${row.contest_id}-${row.index}`,
        source: "codeforces",
        title: row.title,
        description: row.description || "",
        input_format: row.input_format || "",
        output_format: row.output_format || "",
        examples: row.examples || [],
        hidden_tests: row.official_tests || [],
        difficulty_rating: row.rating,
        difficulty,
        tags: row.tags || [],
        seeded: false, // <--- Key addition!
        created_at: new Date().toISOString()
      };

      fs.appendFileSync(outputFile, JSON.stringify(newRow) + "\n");
      totalFetched++;
      
      if (totalFetched >= TARGET_TOTAL) break;
    }

    offset += limit;
    console.log(`... Fetched ${totalFetched}/${TARGET_TOTAL}`);
    
    // Slight delay to respect HF rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Saved ${totalFetched} questions to ${outputFile}`);
  console.log(`\nUploading to Hugging Face: ${REPO_ID} ...`);

  try {
    await uploadFile({
      repo: { type: "dataset", name: REPO_ID },
      credentials: { accessToken: HF_TOKEN },
      file: {
        path: "data.jsonl",
        content: new Blob([fs.readFileSync(outputFile)])
      },
      commitTitle: "Initial dataset sync with seeded: false",
    });
    console.log(`\n🎉 Upload successful! Dataset available at: https://huggingface.co/datasets/${REPO_ID}`);
  } catch (err: any) {
    console.error("❌ Upload failed. Ensure the dataset repository exists or the token has write access.");
    console.error(err.message);
  } finally {
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
  }
}

main().catch(console.error);

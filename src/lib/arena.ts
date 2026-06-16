import { getSupabaseAdmin } from "./supabase";
import { createServerSupabase } from "./supabase-server";
import crypto from "crypto";

const MIN_ARENA_CRYPTO_KEY_LENGTH = 32;

function getArenaCryptoKey(): Buffer {
  const secret = process.env.ARENA_CRYPTO_KEY?.trim();

  if (!secret) {
    throw new Error(
      "ARENA_CRYPTO_KEY must be configured before encrypting arena hidden tests"
    );
  }

  if (secret.length < MIN_ARENA_CRYPTO_KEY_LENGTH) {
    throw new Error(
      `ARENA_CRYPTO_KEY must contain at least ${MIN_ARENA_CRYPTO_KEY_LENGTH} characters`
    );
  }

  return crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest();
}

export interface CFProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

export interface CFProblemStats {
  contestId?: number;
  index: string;
  solvedCount: number;
}

export interface CFProblemsetResponse {
  status: string;
  result: {
    problems: CFProblem[];
    problemStatistics: CFProblemStats[];
  };
}

const CF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Clean HTML from Codeforces page and convert to plain text/markdown structure */
function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanPreContent(pre: string): string {
  if (pre.includes("test-example-line")) {
    const lines: string[] = [];
    const lineRegex = /<div class="test-example-line"[^>]*>([\s\S]*?)<\/div>/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(pre)) !== null) {
      lines.push(cleanHtml(lineMatch[1]));
    }
    if (lines.length > 0) return lines.join("\n");
  }
  return cleanHtml(pre);
}

/** Scrapes Codeforces problem page for description and sample test cases */
export async function scrapeCodeforcesProblem(contestId: number, index: string) {
  const url = `https://m1.codeforces.com/problemset/problem/${contestId}/${index}`;
  try {
    const res = await fetch(url, { headers: CF_HEADERS });
    if (!res.ok) {
      throw new Error(`Failed to fetch Codeforces problem page: HTTP ${res.status}`);
    }
    const html = await res.ok ? await res.text() : "";
    if (!html || html.includes("Redirecting...")) {
      throw new Error("Empty response or redirect on problem page");
    }

    // Parse Sample Tests
    const inputs: string[] = [];
    const outputs: string[] = [];

    const inputRegex = /<div class="input">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;
    const outputRegex = /<div class="output">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;

    let match;
    while ((match = inputRegex.exec(html)) !== null) {
      inputs.push(cleanPreContent(match[1]));
    }
    while ((match = outputRegex.exec(html)) !== null) {
      outputs.push(cleanPreContent(match[1]));
    }

    const sampleTests: { input: string; output: string }[] = [];
    for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
      sampleTests.push({ input: inputs[i], output: outputs[i] });
    }

    if (sampleTests.length === 0) {
      throw new Error("No sample tests could be parsed from problem page");
    }

    // Parse Description
    const statementStart = html.indexOf('<div class="problem-statement">');
    if (statementStart === -1) {
      throw new Error("Could not find problem statement element");
    }

    const headerEnd = html.indexOf("</div>", html.indexOf('<div class="header">', statementStart));
    if (headerEnd === -1) {
      throw new Error("Could not parse problem statement header");
    }

    const inputSpecStart = html.indexOf('<div class="input-specification">', headerEnd);
    const legendHtml = inputSpecStart !== -1 
      ? html.substring(headerEnd + 6, inputSpecStart) 
      : html.substring(headerEnd + 6, html.indexOf('<div class="sample-tests">', headerEnd));

    let markdown = "### Description\n\n" + cleanHtml(legendHtml) + "\n\n";

    if (inputSpecStart !== -1) {
      const outputSpecStart = html.indexOf('<div class="output-specification">', inputSpecStart);
      const inputHtml = outputSpecStart !== -1
        ? html.substring(inputSpecStart, outputSpecStart)
        : html.substring(inputSpecStart);
      
      markdown += "### Input Specification\n\n" + cleanHtml(inputHtml.replace(/<div class="section-title">[^<]*<\/div>/i, "")) + "\n\n";

      if (outputSpecStart !== -1) {
        const sampleTestsStart = html.indexOf('<div class="sample-tests">', outputSpecStart);
        const outputHtml = sampleTestsStart !== -1
          ? html.substring(outputSpecStart, sampleTestsStart)
          : html.substring(outputSpecStart);

        markdown += "### Output Specification\n\n" + cleanHtml(outputHtml.replace(/<div class="section-title">[^<]*<\/div>/i, "")) + "\n\n";
      }
    }

    const noteStart = html.indexOf('<div class="note">', headerEnd);
    if (noteStart !== -1) {
      const noteHtml = html.substring(noteStart, html.indexOf("</div>", noteStart + 20));
      markdown += "### Note\n\n" + cleanHtml(noteHtml.replace(/<div class="section-title">[^<]*<\/div>/i, "")) + "\n\n";
    }

    // Fetch details like time/memory limit from HTML if possible, fallback to standard defaults
    let timeLimitMs = 2000;
    let memoryLimitMb = 256;

    const timeLimitMatch = /<div class="time-limit">[\s\S]*?<div class="property-title">time limit per test<\/div>([\s\S]*?)<\/div>/.exec(html);
    if (timeLimitMatch) {
      const text = cleanHtml(timeLimitMatch[1]);
      const secVal = parseFloat(text);
      if (!isNaN(secVal)) timeLimitMs = Math.round(secVal * 1000);
    }

    const memoryLimitMatch = /<div class="memory-limit">[\s\S]*?<div class="property-title">memory limit per test<\/div>([\s\S]*?)<\/div>/.exec(html);
    if (memoryLimitMatch) {
      const text = cleanHtml(memoryLimitMatch[1]);
      const mbVal = parseInt(text);
      if (!isNaN(mbVal)) memoryLimitMb = mbVal;
    }

    return {
      description: markdown.trim(),
      sampleTests,
      timeLimitMs,
      memoryLimitMb,
    };
  } catch (err: any) {
    console.error(`Error scraping problem ${contestId}${index}:`, err.message);
    throw err;
  }
}

/** Fetch problems list from CF and sync a set of candidates to database */
export async function syncCodeforcesProblems(limitPerDifficulty = 3): Promise<number> {
  const sb = getSupabaseAdmin();
  console.log("Seeding problem pool from local predefined_problems.json...");

  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(process.cwd(), "src/lib/predefined_problems.json");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const predefinedProblems = JSON.parse(fileContent);

    let totalSynced = 0;
    const difficulties: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];

    for (const diff of difficulties) {
      let syncedForDiff = 0;
      const diffProblems = predefinedProblems.filter((p: any) => p.difficulty === diff);

      for (const p of diffProblems) {
        if (syncedForDiff >= limitPerDifficulty) break;

        // Check if problem already exists
        const { data: existing } = await sb
          .from("arena_problems")
          .select("id")
          .eq("source", "codeforces")
          .eq("source_id", p.source_id)
          .maybeSingle();

        if (existing) {
          syncedForDiff++;
          totalSynced++;
          continue;
        }

        console.log(`Seeding problem ${p.source_id} (${p.title}) - ${diff}...`);
        const { error } = await sb.from("arena_problems").insert({
          source: p.source,
          source_id: p.source_id,
          title: p.title,
          description: p.description,
          difficulty: p.difficulty,
          difficulty_rating: p.difficulty_rating,
          tags: p.tags,
          time_limit_ms: p.time_limit_ms,
          memory_limit_mb: p.memory_limit_mb,
          sample_tests: p.sample_tests,
          hidden_tests: p.hidden_tests,
          hints: p.hints
        });

        if (error) {
          console.error(`DB insert error for ${p.source_id}:`, error.message);
        } else {
          syncedForDiff++;
          totalSynced++;
        }
      }
    }

    console.log(`Predefined seed complete. Seeded: ${totalSynced} problems.`);
    return totalSynced;
  } catch (err: any) {
    console.warn("Failed to seed from predefined list, falling back to network fetch:", err.message);
  }

  console.log("Fetching problem list from Codeforces API...");
  
  const response = await fetch("https://codeforces.com/api/problemset.problems", { headers: CF_HEADERS });
  if (!response.ok) {
    throw new Error(`Codeforces API returned status ${response.status}`);
  }

  const json = (await response.json()) as CFProblemsetResponse;
  if (json.status !== "OK" || !json.result) {
    throw new Error("Invalid response format from Codeforces API");
  }

  const { problems, problemStatistics } = json.result;
  
  // Create stats map for quick lookup
  const statsMap = new Map<string, number>();
  for (const stat of problemStatistics) {
    if (stat.contestId) {
      statsMap.set(`${stat.contestId}${stat.index}`, stat.solvedCount);
    }
  }

  // Filter problems:
  const filterByDifficulty = (minRating: number, maxRating: number) => {
    return problems
      .filter(p => p.type === "PROGRAMMING" && p.contestId && p.rating && p.rating >= minRating && p.rating <= maxRating)
      .map(p => ({
        ...p,
        solvedCount: statsMap.get(`${p.contestId}${p.index}`) ?? 0
      }))
      .filter(p => p.solvedCount > 500)
      .sort((a, b) => b.solvedCount - a.solvedCount);
  };

  const easyCandidates = filterByDifficulty(800, 1200);
  const mediumCandidates = filterByDifficulty(1300, 1800);
  const hardCandidates = filterByDifficulty(1900, 2400);

  const selectAndScrape = async (candidates: typeof easyCandidates, difficulty: "easy" | "medium" | "hard", limit: number) => {
    let synced = 0;
    for (const cand of candidates) {
      if (synced >= limit) break;
      const sourceId = `${cand.contestId}${cand.index}`;

      const { data: existing } = await sb
        .from("arena_problems")
        .select("id")
        .eq("source", "codeforces")
        .eq("source_id", sourceId)
        .maybeSingle();

      if (existing) {
        synced++;
        continue;
      }

      try {
        console.log(`Syncing CF problem ${sourceId} (${cand.name}) - ${difficulty}...`);
        const scraped = await scrapeCodeforcesProblem(cand.contestId!, cand.index);
        const hiddenTests = scraped.sampleTests;

        const { error } = await sb.from("arena_problems").insert({
          source: "codeforces",
          source_id: sourceId,
          title: `${cand.index}. ${cand.name}`,
          description: scraped.description,
          difficulty,
          difficulty_rating: cand.rating,
          tags: cand.tags,
          time_limit_ms: scraped.timeLimitMs,
          memory_limit_mb: scraped.memoryLimitMb,
          sample_tests: scraped.sampleTests,
          hidden_tests: hiddenTests,
          hints: []
        });

        if (error) {
          console.error(`DB insert error for ${sourceId}:`, error.message);
        } else {
          console.log(`Successfully synced CF problem ${sourceId}`);
          synced++;
        }
      } catch (err: any) {
        console.warn(`Skipping candidate ${sourceId} due to sync error:`, err.message);
      }

      await new Promise(r => setTimeout(r, 1000));
    }
    return synced;
  };

  console.log(`Processing Easy problems...`);
  const easyCount = await selectAndScrape(easyCandidates, "easy", limitPerDifficulty);
  
  console.log(`Processing Medium problems...`);
  const mediumCount = await selectAndScrape(mediumCandidates, "medium", limitPerDifficulty);

  console.log(`Processing Hard problems...`);
  const hardCount = await selectAndScrape(hardCandidates, "hard", limitPerDifficulty);

  console.log(`Sync complete. Easy: ${easyCount}, Medium: ${mediumCount}, Hard: ${hardCount}`);
  return easyCount + mediumCount + hardCount;
}

/** Rotate the daily challenges for a given date string (YYYY-MM-DD) */
export async function rotateDailyChallenges(dateStr: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  console.log(`Rotating daily challenges for date: ${dateStr}...`);

  // Check if daily challenges already exist for this date
  const { data: existingChallenges } = await sb
    .from("arena_challenges")
    .select("id")
    .eq("challenge_date", dateStr)
    .eq("type", "daily");

  if (existingChallenges && existingChallenges.length >= 3) {
    console.log(`Daily challenges for ${dateStr} already exist. Skipping rotation.`);
    return true;
  }

  // Get all problem IDs that have ever been used as daily challenges
  const { data: usedChallenges } = await sb
    .from("arena_challenges")
    .select("problem_id")
    .eq("type", "daily");

  const usedProblemIds = new Set(usedChallenges?.map(c => c.problem_id) ?? []);

  // Get problems for each difficulty
  const fetchRandomProblem = async (difficulty: "easy" | "medium" | "hard") => {
    // Select problems of this difficulty
    const { data: problems, error } = await sb
      .from("arena_problems")
      .select("id")
      .eq("difficulty", difficulty)
      .eq("is_active", true);

    if (error || !problems || problems.length === 0) {
      throw new Error(`No active problems found in database for difficulty: ${difficulty}`);
    }

    // Filter out problems that have already been used as daily challenges
    const unusedProblems = problems.filter(p => !usedProblemIds.has(p.id));

    // Fallback to all problems if all of them have been used
    const candidates = unusedProblems.length > 0 ? unusedProblems : problems;

    // Pick one randomly
    const randomIdx = Math.floor(Math.random() * candidates.length);
    return candidates[randomIdx].id;
  };

  try {
    const easyProbId = await fetchRandomProblem("easy");
    const mediumProbId = await fetchRandomProblem("medium");
    const hardProbId = await fetchRandomProblem("hard");

    // Base rewards:
    // Easy: 100 pts, 10 XP, common item pool
    // Medium: 250 pts, 25 XP, rare item pool
    // Hard: 500 pts, 50 XP, epic item pool
    const challengesToInsert = [
      {
        type: "daily",
        problem_id: easyProbId,
        difficulty: "easy",
        challenge_date: dateStr,
        reward_points: 100,
        reward_xp: 10,
        reward_item_pool: ["common", "rare"] // Easy drops common (100%), rare (15% in submit route)
      },
      {
        type: "daily",
        problem_id: mediumProbId,
        difficulty: "medium",
        challenge_date: dateStr,
        reward_points: 250,
        reward_xp: 25,
        reward_item_pool: ["rare", "epic"] // Medium drops rare (100%), epic (20% in submit route)
      },
      {
        type: "daily",
        problem_id: hardProbId,
        difficulty: "hard",
        challenge_date: dateStr,
        reward_points: 500,
        reward_xp: 50,
        reward_item_pool: ["epic", "legendary"] // Hard drops epic (100%), legendary (5% jackpot)
      }
    ];

    const { error } = await sb
      .from("arena_challenges")
      .upsert(challengesToInsert, {
        onConflict: "challenge_date,type,difficulty",
        ignoreDuplicates: true,
      });
    if (error) {
      console.error(`Error upserting daily challenges:`, error.message);
      return false;
    }

    console.log(`Successfully rotated daily challenges for ${dateStr}!`);
    return true;
  } catch (err: any) {
    console.error(`Failed to rotate daily challenges:`, err.message);
    return false;
  }
}

/** Get developer record for request (either from VS Code API key or browser session) */
export async function getAuthenticatedDeveloper(req: Request) {
  const authHeader = req.headers.get("authorization");
  const sb = getSupabaseAdmin();

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const key = authHeader.substring(7);
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const { data: dev } = await sb
      .from("developers")
      .select("id, github_login, claimed_by")
      .eq("vscode_api_key_hash", keyHash)
      .maybeSingle();
    if (dev) return dev;
  }

  // Fall back to browser session cookie
  try {
    const clientSupabase = await createServerSupabase();
    const { data: { user } } = await clientSupabase.auth.getUser();
    if (user) {
      const { data: dev } = await sb
        .from("developers")
        .select("id, github_login, claimed_by")
        .eq("claimed_by", user.id)
        .maybeSingle();
      return dev;
    }
  } catch (err) {
    console.warn("Failed to retrieve user from cookies:", err);
  }

  return null;
}

/** Encrypt hidden tests using AES-256-CBC */
export function encryptHiddenTests(tests: any[]): { iv: string; encryptedData: string } {
  const algorithm = "aes-256-cbc";
  const key = getArenaCryptoKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(tests), "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    iv: iv.toString("hex"),
    encryptedData: encrypted
  };
}


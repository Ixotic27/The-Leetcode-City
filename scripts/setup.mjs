#!/usr/bin/env node

/**
 * The Leetcode City — One-Command Development Setup
 *
 * Usage:
 *   npm run setup          — Full setup (install deps + env + dev server)
 *   npm run setup -- --env — Only create .env.local (skip install)
 *   npm run setup -- --check — Only validate environment (no changes)
 */

import { execSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Colors ──────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const ok = (msg) => console.log(`${c.green}  ✓${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠${c.reset} ${msg}`);
const fail = (msg) => console.log(`${c.red}  ✗${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}  ℹ${c.reset} ${msg}`);
const step = (n, msg) =>
  console.log(`\n${c.bold}${c.magenta}[${n}]${c.reset} ${c.bold}${msg}${c.reset}`);

// ── Args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const envOnly = args.includes("--env");
const checkOnly = args.includes("--check");

console.log(`
${c.bold}${c.cyan}╔══════════════════════════════════════════════╗
║     🏙️  The Leetcode City — Dev Setup       ║
╚══════════════════════════════════════════════╝${c.reset}
`);

// ── Step 1: Check Node.js ───────────────────────────────────
step(1, "Checking prerequisites");

const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);

if (major < 18) {
  fail(`Node.js ${nodeVersion} detected — Node.js 18+ is required.`);
  fail(`Download: https://nodejs.org`);
  process.exit(1);
}
ok(`Node.js ${nodeVersion}`);

// Check npm
try {
  const npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
  ok(`npm ${npmVersion}`);
} catch {
  fail("npm not found. Install Node.js from https://nodejs.org");
  process.exit(1);
}

// ── Step 2: Environment file ────────────────────────────────
step(2, "Setting up environment variables");

const envLocalPath = resolve(ROOT, ".env.local");
const envExamplePath = resolve(ROOT, ".env.example");

if (existsSync(envLocalPath)) {
  ok(".env.local already exists — keeping your current config.");

  // Validate required vars
  const envContent = readFileSync(envLocalPath, "utf-8");
  const hasSupabaseUrl = envContent.includes("NEXT_PUBLIC_SUPABASE_URL=") &&
    !envContent.includes("NEXT_PUBLIC_SUPABASE_URL=your-") &&
    !envContent.match(/NEXT_PUBLIC_SUPABASE_URL=\s*$/m);
  const hasSupabaseAnon = envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY=") &&
    !envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY=your-") &&
    !envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=\s*$/m);
  const hasServiceRole = envContent.includes("SUPABASE_SERVICE_ROLE_KEY=") &&
    !envContent.match(/SUPABASE_SERVICE_ROLE_KEY=\s*$/m);

  if (hasSupabaseUrl && hasSupabaseAnon) {
    ok("Supabase public keys ✓");
  } else {
    warn("Supabase public keys missing — the app may not load data.");
    info("Run: npm run setup -- --env  to regenerate from template.");
  }

  if (hasServiceRole) {
    ok("Supabase service role key ✓ (full API access)");
  } else {
    warn("No service role key — running in dev mode (read-only, no auth).");
    info("This is fine for most frontend work!");
  }
} else if (existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envLocalPath);
  ok("Created .env.local from .env.example");
  ok("Public Supabase keys are pre-filled — ready for frontend development!");
  warn("Service role key is empty — the app will run in dev mode (read-only).");
  info("For full API access, ask @Ixotic27 for the service role key.");
} else {
  fail(".env.example not found — are you in the project root?");
  process.exit(1);
}

if (checkOnly) {
  console.log(`\n${c.green}${c.bold}Environment check complete!${c.reset}\n`);
  process.exit(0);
}

// ── Step 3: Install dependencies ────────────────────────────
if (!envOnly) {
  step(3, "Installing dependencies");

  if (existsSync(resolve(ROOT, "node_modules"))) {
    ok("node_modules exists — running npm install for updates...");
  }

  try {
    execSync("npm install", {
      cwd: ROOT,
      stdio: "inherit",
    });
    ok("Dependencies installed!");
  } catch {
    fail("npm install failed — check the output above.");
    process.exit(1);
  }
}

// ── Done! ───────────────────────────────────────────────────
console.log(`
${c.bold}${c.green}══════════════════════════════════════════════${c.reset}
${c.bold}${c.green}  🎉 Setup complete! You're ready to develop.${c.reset}
${c.bold}${c.green}══════════════════════════════════════════════${c.reset}

  ${c.bold}Start the dev server:${c.reset}
  ${c.cyan}npm run dev${c.reset}

  ${c.dim}The app runs on http://localhost:3001${c.reset}

${c.bold}  What works without secret keys:${c.reset}
  ${c.green}✓${c.reset} View the city (all public data)
  ${c.green}✓${c.reset} Browse developer profiles
  ${c.green}✓${c.reset} UI/CSS/component changes
  ${c.green}✓${c.reset} 3D rendering & animations
  ${c.green}✓${c.reset} Leaderboard & search

${c.bold}  What needs the service role key:${c.reset}
  ${c.yellow}⚠${c.reset} Sign in / auth
  ${c.yellow}⚠${c.reset} Claiming buildings
  ${c.yellow}⚠${c.reset} Shop purchases
  ${c.yellow}⚠${c.reset} Raids & interactions
  ${c.yellow}⚠${c.reset} API route changes

  ${c.dim}Need full access? Ask @Ixotic27 for the service role key.${c.reset}
`);

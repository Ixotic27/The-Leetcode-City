#!/usr/bin/env node

/**
 * leetcode-city CLI
 *
 * Usage:
 *   npx leetcode-city init           — Clone, install, configure, start dev server
 *   npx leetcode-city init my-folder — Clone into a specific folder
 *   npx leetcode-city doctor         — Validate an existing setup
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";

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
  blue: "\x1b[34m",
};

const ok = (msg) => console.log(`${c.green}  ✓${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠${c.reset} ${msg}`);
const fail = (msg) => console.log(`${c.red}  ✗${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}  ℹ${c.reset} ${msg}`);
const step = (n, total, msg) =>
  console.log(`\n${c.bold}${c.magenta}[${n}/${total}]${c.reset} ${c.bold}${msg}${c.reset}`);

const REPO_URL = "https://github.com/Ixotic27/The-Leetcode-City.git";
const REPO_NAME = "The-Leetcode-City";

// ── Banner ──────────────────────────────────────────────────
function banner() {
  console.log(`
${c.cyan}${c.bold}
  ██╗     ███████╗███████╗████████╗ ██████╗ ██████╗ ██████╗ ███████╗
  ██║     ██╔════╝██╔════╝╚══██╔══╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
  ██║     █████╗  █████╗     ██║   ██║     ██║   ██║██║  ██║█████╗
  ██║     ██╔══╝  ██╔══╝     ██║   ██║     ██║   ██║██║  ██║██╔══╝
  ███████╗███████╗███████╗   ██║   ╚██████╗╚██████╔╝██████╔╝███████╗
  ╚══════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
${c.reset}${c.bold}${c.yellow}                        ⚡ C I T Y ⚡${c.reset}
${c.dim}       Your LeetCode profile as a 3D pixel art building${c.reset}
`);
}

// ── Commands ────────────────────────────────────────────────
const command = process.argv[2];
const folderArg = process.argv[3];

if (!command || command === "--help" || command === "-h") {
  banner();
  console.log(`${c.bold}Usage:${c.reset}`);
  console.log(`  ${c.cyan}npx leetcode-city init${c.reset}              Clone & set up the project`);
  console.log(`  ${c.cyan}npx leetcode-city init my-folder${c.reset}    Clone into a specific folder`);
  console.log(`  ${c.cyan}npx leetcode-city doctor${c.reset}            Validate existing setup`);
  console.log();
  process.exit(0);
}

if (command === "init") {
  init(folderArg);
} else if (command === "doctor") {
  doctor();
} else {
  fail(`Unknown command: ${command}`);
  info(`Run ${c.cyan}npx leetcode-city --help${c.reset} to see available commands.`);
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════
// init — full setup from scratch
// ═════════════════════════════════════════════════════════════
function init(folder) {
  banner();
  const targetDir = resolve(process.cwd(), folder || REPO_NAME);
  const dirName = basename(targetDir);
  const totalSteps = 5;

  // ── Step 1: Check prerequisites ───────────────────────────
  step(1, totalSteps, "Checking prerequisites");

  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split(".").map(Number);
  if (major < 18) {
    fail(`Node.js ${nodeVersion} — version 18+ required.`);
    fail("Download: https://nodejs.org");
    process.exit(1);
  }
  ok(`Node.js ${nodeVersion}`);

  try {
    const npmV = execSync("npm --version", { encoding: "utf-8" }).trim();
    ok(`npm ${npmV}`);
  } catch {
    fail("npm not found.");
    process.exit(1);
  }

  try {
    execSync("git --version", { encoding: "utf-8", stdio: "pipe" });
    ok("git installed");
  } catch {
    fail("git not found. Install: https://git-scm.com");
    process.exit(1);
  }

  // ── Step 2: Clone the repository ──────────────────────────
  step(2, totalSteps, "Cloning The Leetcode City");

  if (existsSync(targetDir)) {
    ok(`${dirName}/ already exists — skipping clone.`);
  } else {
    console.log(`${c.dim}  Cloning into ${dirName}/...${c.reset}`);
    try {
      execSync(`git clone ${REPO_URL} "${targetDir}"`, { stdio: "inherit" });
      ok("Repository cloned!");
    } catch {
      fail("git clone failed. Check your internet connection.");
      process.exit(1);
    }
  }

  // ── Step 3: Install dependencies ──────────────────────────
  step(3, totalSteps, "Installing dependencies");

  try {
    execSync("npm install", { cwd: targetDir, stdio: "inherit" });
    ok("Dependencies installed!");
  } catch {
    fail("npm install failed.");
    process.exit(1);
  }

  // ── Step 4: Set up environment ────────────────────────────
  step(4, totalSteps, "Configuring environment");

  const envLocal = resolve(targetDir, ".env.local");
  const envExample = resolve(targetDir, ".env.example");

  if (existsSync(envLocal)) {
    ok(".env.local already exists — keeping your config.");
  } else if (existsSync(envExample)) {
    copyFileSync(envExample, envLocal);
    ok("Created .env.local with pre-filled public keys!");
    warn("Service role key is empty — running in dev mode (read-only).");
    info("This is perfect for frontend/UI work!");
  } else {
    warn(".env.example not found — you'll need to create .env.local manually.");
  }

  // ── Step 5: Done! ────────────────────────────────────────
  step(5, totalSteps, "Ready!");

  console.log(`
${c.green}${c.bold}  ══════════════════════════════════════════════
  🎉 Setup complete! You're ready to develop.
  ══════════════════════════════════════════════${c.reset}

  ${c.bold}Start the dev server:${c.reset}
  ${c.cyan}cd ${dirName}${c.reset}
  ${c.cyan}npm run dev${c.reset}

  ${c.dim}Opens at http://localhost:3001${c.reset}

${c.bold}  What works without secret keys:${c.reset}
  ${c.green}✓${c.reset} View the city, browse profiles
  ${c.green}✓${c.reset} UI/CSS/3D component changes
  ${c.green}✓${c.reset} Leaderboard, search, animations

${c.bold}  What needs the service role key:${c.reset}
  ${c.yellow}⚠${c.reset} Auth, raids, shop, claiming

  ${c.dim}Need full access? Ask @Ixotic27 for the key.${c.reset}

${c.bold}  Happy contributing! 🚀${c.reset}
`);
}

// ═════════════════════════════════════════════════════════════
// doctor — validate existing setup
// ═════════════════════════════════════════════════════════════
function doctor() {
  banner();
  console.log(`${c.bold}Running diagnostics...${c.reset}\n`);

  let issues = 0;

  // Node.js
  const [major] = process.versions.node.split(".").map(Number);
  if (major >= 18) {
    ok(`Node.js ${process.versions.node}`);
  } else {
    fail(`Node.js ${process.versions.node} — need 18+`);
    issues++;
  }

  // npm
  try {
    const npmV = execSync("npm --version", { encoding: "utf-8", stdio: "pipe" }).trim();
    ok(`npm ${npmV}`);
  } catch {
    fail("npm not found");
    issues++;
  }

  // git
  try {
    execSync("git --version", { encoding: "utf-8", stdio: "pipe" });
    ok("git installed");
  } catch {
    fail("git not found");
    issues++;
  }

  // package.json
  if (existsSync("package.json")) {
    ok("package.json found");
  } else {
    fail("package.json not found — are you in the project root?");
    issues++;
  }

  // node_modules
  if (existsSync("node_modules")) {
    ok("node_modules exists");
  } else {
    warn("node_modules missing — run: npm install");
    issues++;
  }

  // .env.local
  if (existsSync(".env.local")) {
    ok(".env.local exists");
  } else {
    warn(".env.local missing — run: npm run setup");
    issues++;
  }

  console.log();
  if (issues === 0) {
    console.log(`${c.green}${c.bold}  All checks passed! ✅${c.reset}\n`);
  } else {
    console.log(`${c.yellow}${c.bold}  ${issues} issue(s) found — see above.${c.reset}\n`);
  }
}

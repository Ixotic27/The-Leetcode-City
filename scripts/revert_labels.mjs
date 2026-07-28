import fs from "fs";

const repo = "Ixotic27/The-Leetcode-City";
const token = fs
  .readFileSync(".env.local", "utf-8")
  .split("\n")
  .find((line) => line.startsWith("GITHUB_TOKEN="))
  ?.split("=")[1]
  ?.trim();

if (!token) {
  console.error("No GITHUB_TOKEN found in .env.local");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github.v3+json",
  Authorization: `token ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "Node-Script",
};

// Reverting back to original names and colors
const RENAMES = [
  {
    oldName: "! GSSoC'26",
    newName: "Gssoc 26",
    color: "170100", // Original color
  },
  {
    oldName: "! GSSoC Approved",
    newName: "gssoc:approved",
    color: "9313a8", // Original color
  },
];

async function renameLabel(oldName, newName, color) {
  const url = `https://api.github.com/repos/${repo}/labels/${encodeURIComponent(oldName)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ new_name: newName, color }),
  });

  if (res.ok) {
    console.log(`✅ Reverted "${oldName}" → "${newName}"`);
  } else if (res.status === 404) {
    console.log(
      `⚠️  "${oldName}" not found. It might have already been reverted.`,
    );
    // Ensure newName exists with correct color
    const checkUrl = `https://api.github.com/repos/${repo}/labels/${encodeURIComponent(newName)}`;
    const checkRes = await fetch(checkUrl, { headers });
    if (checkRes.ok) {
      await fetch(checkUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ color }),
      });
      console.log(`✅ Ensured "${newName}" has correct color.`);
    }
  } else {
    console.error(`❌ Failed to revert "${oldName}":`, await res.text());
  }
}

async function run() {
  console.log("Reverting GSSoC labels to their original names...\n");

  for (const r of RENAMES) {
    await renameLabel(r.oldName, r.newName, r.color);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n🎉 Done! Labels reverted.");
}

run().catch(console.error);

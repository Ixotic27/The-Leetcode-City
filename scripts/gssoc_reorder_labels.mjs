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

// Rename labels so they sort FIRST alphabetically (before "advanced", "backend", "beginner", "bug"...)
// "!" sorts before all letters and digits in ASCII, making them appear first.
const RENAMES = [
  {
    oldName: "Gssoc 26",
    newName: "! GSSoC'26",
    color: "FF6F00", // Bright orange — impossible to miss
    description: "Part of GirlScript Summer of Code 2026",
  },
  {
    oldName: "gssoc:approved",
    newName: "! GSSoC Approved",
    color: "00C853", // Bright green — signals "approved / go ahead"
    description: "Approved for GSSoC contributions",
  },
];

async function renameLabel(oldName, newName, color, description) {
  // GitHub API: PATCH /repos/{owner}/{repo}/labels/{label_name}
  const url = `https://api.github.com/repos/${repo}/labels/${encodeURIComponent(oldName)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ new_name: newName, color, description }),
  });

  if (res.ok) {
    console.log(`✅ Renamed "${oldName}" → "${newName}" (color: #${color})`);
  } else if (res.status === 404) {
    // Label doesn't exist with old name — maybe already renamed. Try to update directly.
    console.log(
      `⚠️  "${oldName}" not found. Checking if "${newName}" already exists...`,
    );
    const checkUrl = `https://api.github.com/repos/${repo}/labels/${encodeURIComponent(newName)}`;
    const checkRes = await fetch(checkUrl, { headers });
    if (checkRes.ok) {
      // Update color/description on existing label
      const updateRes = await fetch(checkUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ color, description }),
      });
      if (updateRes.ok) {
        console.log(`✅ Updated "${newName}" color to #${color}`);
      }
    } else {
      // Create it fresh
      const createRes = await fetch(
        `https://api.github.com/repos/${repo}/labels`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ name: newName, color, description }),
        },
      );
      if (createRes.ok || createRes.status === 422) {
        console.log(`✅ Created "${newName}"`);
      } else {
        console.error(
          `❌ Failed to create "${newName}":`,
          await createRes.text(),
        );
      }
    }
  } else {
    console.error(`❌ Failed to rename "${oldName}":`, await res.text());
  }
}

async function run() {
  console.log("Renaming GSSoC labels to sort first (using '!' prefix)...\n");

  for (const r of RENAMES) {
    await renameLabel(r.oldName, r.newName, r.color, r.description);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n--- Verifying all issues have the updated labels ---\n");

  // Fetch all open issues and ensure they have the new label names
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`,
    { headers },
  );
  const issues = await res.json();

  for (const issue of issues) {
    if (issue.pull_request) continue;

    const labelNames = issue.labels.map((l) => l.name);
    const needsUpdate = [];

    // Check if issue has old names that need swapping
    for (const r of RENAMES) {
      if (labelNames.includes(r.oldName) && !labelNames.includes(r.newName)) {
        needsUpdate.push({ remove: r.oldName, add: r.newName });
      }
    }

    if (needsUpdate.length > 0) {
      const newLabels = labelNames
        .filter((n) => !needsUpdate.some((u) => u.remove === n))
        .concat(needsUpdate.map((u) => u.add));

      const updateRes = await fetch(
        `https://api.github.com/repos/${repo}/issues/${issue.number}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ labels: newLabels }),
        },
      );

      if (updateRes.ok) {
        console.log(`✅ Issue #${issue.number} — labels updated`);
      } else {
        console.error(
          `❌ Issue #${issue.number} — update failed:`,
          await updateRes.text(),
        );
      }
      await new Promise((r) => setTimeout(r, 300));
    } else {
      console.log(`✓  Issue #${issue.number} — already has correct labels`);
    }
  }

  console.log("\n🎉 Done! GSSoC labels now sort first and are eye-catching.");
  console.log(
    "   '!' prefix ensures they appear before 'advanced', 'bug', 'beginner', etc.",
  );
}

run().catch(console.error);

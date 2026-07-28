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

const GSSOC_LABELS = ["Gssoc 26", "gssoc:approved"];

async function addGssocTags() {
  // Fetch all open issues
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`,
    { headers },
  );
  if (!res.ok) {
    console.error("Failed to fetch issues", await res.text());
    return;
  }
  const issues = await res.json();

  for (const issue of issues) {
    if (issue.pull_request) continue; // Skip PRs

    const existingLabels = issue.labels.map((l) => l.name);
    const missingLabels = GSSOC_LABELS.filter(
      (l) => !existingLabels.includes(l),
    );

    if (missingLabels.length === 0) {
      console.log(`Issue #${issue.number} already has all GSSoC labels.`);
      continue;
    }

    const newLabels = [...existingLabels, ...missingLabels];

    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issue.number}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ labels: newLabels }),
      },
    );

    if (updateRes.ok) {
      console.log(
        `Updated issue #${issue.number} "${issue.title}" with GSSoC labels: ${missingLabels.join(", ")}`,
      );
    } else {
      console.error(
        `Failed to update issue #${issue.number}:`,
        await updateRes.text(),
      );
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    "\nDone! All open issues now have GSSoC 26 and gssoc:approved labels.",
  );
}

addGssocTags().catch(console.error);

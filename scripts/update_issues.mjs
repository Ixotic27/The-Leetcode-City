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

async function updateIssues() {
  // 1. Fetch open issues
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`,
    { headers },
  );
  if (!res.ok) {
    console.error("Failed to fetch issues", await res.text());
    return;
  }
  const issues = await res.json();

  // 2. Iterate and update
  for (const issue of issues) {
    if (issue.pull_request) continue; // Skip PRs

    const appendText = `\n\n---\n**Note for Contributors:** Please create a branch named with this issue number and name to make it easier to identify (e.g., \`git checkout -b ${issue.number}-issue-name\`).`;

    // Don't append if it already has it
    if (
      issue.body &&
      issue.body.includes("branch named with this issue number")
    ) {
      console.log(`Issue #${issue.number} already has the note.`);
      continue;
    }

    const newBody = (issue.body || "") + appendText;

    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issue.number}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ body: newBody }),
      },
    );

    if (updateRes.ok) {
      console.log(
        `Updated issue #${issue.number} with branch naming instructions.`,
      );
    } else {
      console.error(
        `Failed to update issue #${issue.number}:`,
        await updateRes.text(),
      );
    }
  }
}

updateIssues().catch(console.error);

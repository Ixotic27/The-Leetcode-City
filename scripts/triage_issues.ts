import fs from 'fs';
import path from 'path';

const repo = "Ixotic27/The-Leetcode-City";
const envPath = path.join(process.cwd(), ".env.local");
const token = fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

if (!token) {
    console.error("No GITHUB_TOKEN found in .env.local");
    process.exit(1);
}

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

const issuesToTriage = [
    {
        number: 671,
        author: "ZainabTravadi",
        labels: ["Gssoc 26", "gssoc:approved", "good first issues", "level:beginner", "type:bug"]
    },
    {
        number: 672,
        author: "ZainabTravadi",
        labels: ["Gssoc 26", "gssoc:approved", "good first issues", "level:beginner", "type:bug"]
    },
    {
        number: 673,
        author: "ZainabTravadi",
        labels: ["Gssoc 26", "gssoc:approved", "good first issues", "level:intermediate", "type:bug"]
    }
];

async function triageIssue(issue: typeof issuesToTriage[0]) {
    console.log(`\nProcessing issue #${issue.number}...`);

    // 1. Update labels (this replaces all labels, removing "needs-triage")
    const labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/labels`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ labels: issue.labels })
    });
    if (labelRes.status === 200) {
        console.log(`✅ Updated labels for #${issue.number}`);
    } else {
        console.error(`❌ Failed to update labels for #${issue.number}:`, await labelRes.text());
        return;
    }

    // 2. Assign the author
    const assignRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/assignees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ assignees: [issue.author] })
    });
    if (assignRes.status === 201) {
        console.log(`✅ Assigned @${issue.author} to #${issue.number}`);
    } else {
        console.error(`❌ Failed to assign @${issue.author} to #${issue.number}:`, await assignRes.text());
    }

    // 3. Post welcome comment with 48h deadline
    const commentBody = `Hello @${issue.author}, you have been selected to work on this issue! 🚀 Please read the \`CONTRIBUTING.md\` file before starting.

⏰ **Deadline: You have 48 hours from this exact moment to submit a Pull Request for this issue.** If no PR is submitted within that time, the issue will be unassigned and made available for other contributors. This keeps the project moving and ensures everyone gets a fair opportunity!

**📝 Important - PR Submission Rules:**
1. **Branch Name:** Please name your branch starting with the issue number (e.g., \`${issue.number}-feature-name\`).
2. **PR Description:** Make sure your Pull Request description includes \`Fixes #${issue.number}\` so it automatically links to this issue and inherits its labels.

⭐ **If you're excited to contribute, please consider starring this repository to help increase its visibility and support the developer!**

🔒 *This conversation will now be locked. Please use your Pull Request for any further discussion about this issue.*`;

    const commentRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: commentBody })
    });
    if (commentRes.status === 201) {
        console.log(`✅ Posted welcome comment on #${issue.number}`);
    } else {
        console.error(`❌ Failed to post comment on #${issue.number}:`, await commentRes.text());
    }

    // 4. Lock the conversation
    const lockRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/lock`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ lock_reason: "resolved" })
    });
    if (lockRes.status === 204) {
        console.log(`✅ Locked issue #${issue.number}`);
    } else {
        console.error(`❌ Failed to lock issue #${issue.number}:`, await lockRes.text());
    }
}

async function run() {
    for (const issue of issuesToTriage) {
        await triageIssue(issue);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit buffer
    }
    console.log("\nAll issues triaged successfully!");
}

run().catch(console.error);

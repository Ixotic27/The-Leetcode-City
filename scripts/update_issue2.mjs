import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

async function updateIssueAndReply() {
    // First, get issue #2 details to find the assignee
    const issueRes = await fetch(`https://api.github.com/repos/${repo}/issues/2`, { headers });
    const issue = await issueRes.json();
    const assignee = issue.assignees?.[0]?.login || "contributor";
    const isLocked = issue.locked;
    
    console.log(`Issue #2 assignee: @${assignee}, locked: ${isLocked}`);
    
    // Unlock if locked so we can comment
    if (isLocked) {
        await fetch(`https://api.github.com/repos/${repo}/issues/2/lock`, {
            method: 'DELETE', headers
        });
        console.log("Unlocked issue #2");
    }

    // Update the issue body
    const newBody = `## Summary\n\nThe file \`src/app/api/share-card/[username]/route.tsx\` contains a Portuguese (\`pt\`) translation block inside both the \`i18n\` dictionary and the \`TAUNTS\` dictionary. Since this project is **English-only**, the Portuguese translations should be completely removed and the code simplified.\n\n## What needs to be done\n\n1. **Remove the \`pt\` block from the \`i18n\` object** (lines ~46-54) — delete the entire \`pt: { ... }\` entry.\n2. **Remove the \`pt\` block from the \`TAUNTS\` object** (lines ~516-535) — delete the entire \`pt: { ... }\` entry.\n3. **Remove the \`Lang\` type union** — change \`type Lang = "en" | "pt"\` to just \`type Lang = "en"\` (or remove the type entirely and hardcode \`"en"\`).\n4. **Remove the language query parameter logic** — on line ~106, remove the \`lang\` query parameter check and just hardcode \`const lang = "en"\`.\n5. **Clean up the \`getTaunt\` function** — since there's only one language now, simplify the \`lang\` parameter or remove it.\n6. **Clean up the \`renderStories\` function** — remove the \`lang\` parameter if it's no longer needed.\n\n## Files to modify\n\n- \`src/app/api/share-card/[username]/route.tsx\`\n\n## Note for Contributors\n\nPlease create a branch named with this issue number (e.g., \`git checkout -b 2-remove-portuguese-translations\`).`;

    const updateRes = await fetch(`https://api.github.com/repos/${repo}/issues/2`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
            title: "Remove Portuguese translation block — English only",
            body: newBody
        })
    });

    if (updateRes.ok) {
        console.log("Issue #2 body updated successfully.");
    } else {
        console.error("Failed to update issue:", await updateRes.text());
    }

    // Post a reply to the assignee
    const comment = `Hey @${assignee}, thanks for looking into this and asking for clarification! 👏\n\nI've updated the issue description with clearer instructions. Here's the summary:\n\nThe Portuguese (\`pt\`) translation blocks in this file are **not needed** — this project is **English-only**. The \`pt\` block inside both the \`i18n\` dictionary and the \`TAUNTS\` dictionary should be **completely removed**, not translated.\n\nSpecifically, you need to:\n1. Delete the \`pt: { ... }\` block from the \`i18n\` object (~lines 46-54)\n2. Delete the \`pt: { ... }\` block from the \`TAUNTS\` object (~lines 516-535)\n3. Simplify \`type Lang = "en" | "pt"\` → just use \`"en"\` everywhere\n4. Remove the \`lang\` query parameter logic on ~line 106 and hardcode \`"en"\`\n5. Clean up any function parameters that pass \`lang\` if they're no longer needed\n\nThe English translations already exist side-by-side, so no new translations are required — just a clean removal of the Portuguese code paths.\n\nLet me know if you have any questions! ⏰ Remember: you have **48 hours** to submit a PR for this.`;

    const commentRes = await fetch(`https://api.github.com/repos/${repo}/issues/2/comments`, {
        method: 'POST', headers,
        body: JSON.stringify({ body: comment })
    });

    if (commentRes.ok) {
        console.log("Reply posted successfully!");
    } else {
        console.error("Failed to post comment:", await commentRes.text());
    }
}

updateIssueAndReply().catch(console.error);

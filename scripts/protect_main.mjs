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

async function protectBranch() {
    console.log("Applying branch protection to main...");
    const res = await fetch(`https://api.github.com/repos/${repo}/branches/main/protection`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            required_status_checks: {
                strict: true,
                contexts: ["security-checks", "review", "enforce-branch"] // Requires these actions to pass
            },
            enforce_admins: false, // You (the admin) can still bypass rules if needed
            required_pull_request_reviews: {
                dismiss_stale_reviews: true,
                require_code_owner_reviews: false,
                required_approving_review_count: 1 // AI or human must approve
            },
            restrictions: null,
            required_linear_history: true,
            allow_force_pushes: false,
            allow_deletions: false
        })
    });
    
    if (!res.ok) {
        console.error("Failed to protect branch:", await res.text());
    } else {
        console.log("Branch protection applied successfully!");
    }
}

protectBranch().catch(console.error);

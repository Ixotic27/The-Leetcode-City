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

async function checkAllPRs() {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=30`, { headers });
    const prs = await res.json();
    
    console.log(`Found ${prs.length} open PRs:\n`);
    
    for (const pr of prs) {
        console.log(`[PR #${pr.number}] ${pr.title}`);
        console.log(`  Author: @${pr.user.login}`);
        console.log(`  Branch: ${pr.head.ref}`);
        console.log(`  Assignees: ${pr.assignees.map(a => a.login).join(', ') || 'NONE'}`);
        console.log(`  Labels: ${pr.labels.map(l => l.name).join(', ') || 'NONE'}`);
        console.log(`  Reviewers: ${pr.requested_reviewers.map(r => r.login).join(', ') || 'NONE'}`);
        console.log(`  Mergeable: ${pr.mergeable_state}`);
        console.log(`  Draft: ${pr.draft}`);
        
        // Check reviews
        const reviewsRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/reviews`, { headers });
        const reviews = await reviewsRes.json();
        const latestReview = reviews[reviews.length - 1];
        console.log(`  Reviews: ${reviews.length} total, latest: ${latestReview ? `${latestReview.state} by @${latestReview.user.login}` : 'NONE'}`);
        
        // Check CI status
        const statusRes = await fetch(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/status`, { headers });
        const status = await statusRes.json();
        console.log(`  CI Status: ${status.state}`);
        console.log('');
    }
}

checkAllPRs().catch(console.error);

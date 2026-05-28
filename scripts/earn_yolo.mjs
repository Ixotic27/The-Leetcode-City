import fs from 'fs';
import { execSync } from 'child_process';

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

async function earnYolo() {
    console.log("Opening PR...");
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            title: "YOLO dummy PR",
            head: "yolo-dummy",
            base: "main",
            body: "Merge without review for YOLO achievement"
        })
    });
    
    if (!prRes.ok) {
        console.error(await prRes.text());
        return;
    }
    const pr = await prRes.json();
    console.log(`Created PR #${pr.number}`);

    // Wait a couple seconds
    await new Promise(r => setTimeout(r, 2000));

    console.log("Merging instantly without review...");
    await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/merge`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            merge_method: 'squash'
        })
    });
    console.log("Merged PR! YOLO achieved!");

    console.log("Cleaning up branch...");
    try { execSync('git push origin --delete yolo-dummy'); } catch(e){}
    try { execSync('git checkout main'); } catch(e){}
    try { execSync('git branch -D yolo-dummy'); } catch(e){}
}

earnYolo().catch(console.error);

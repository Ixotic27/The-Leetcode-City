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

async function createIssue(title: string, body: string, labels: string[]) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels })
    });
    if (res.status === 201) {
        const issue = await res.json();
        console.log(`✅ Created issue #${issue.number}: "${title}"`);
    } else {
        console.error(`❌ Failed to create issue "${title}":`, await res.text());
    }
    await new Promise(r => setTimeout(r, 600));
}

async function run() {
    console.log("Posting performance optimization issues to GitHub...");
    
    const issues = [
        {
            title: "⚡ Performance: Optimize Loading Screen Asset Caching and Pre-fetching",
            body: `### Description\nCurrently, the loading screen sequentially waits for all 3D assets, textures, and styles to load. On return visits, assets are re-downloaded or re-evaluated, making the initial loading bar take several seconds even when the browser cache is enabled.\n\n### Expected Behavior\nAsset loading should be optimized via parallelization, asset pre-fetching, and secure caching so that returning visitors experience an instantaneous transition.\n\n### Proposed Solution\n1. Use \`<link rel="prefetch">\` or Next.js dynamic imports to start loading heavy chunks (like Three.js libraries and landmark models) in the background.\n2. Configure explicit HTTP cache-control headers on static 3D models (\`.glb\`) and audio files.\n3. Add a Service Worker cache strategy (e.g. Cache First) specifically optimized for game assets.`,
            labels: ["gssoc 26", "gssoc:approved", "good first issues", "level:medium", "type:enhancement"]
        },
        {
            title: "⚡ Performance: Reduce Lag via Level of Detail (LOD) for Distant Voxel Buildings",
            body: `### Description\nThe city renders hundreds of voxel buildings. Although instanced meshes are used for basic building blocks, rendering detailed features (like custom colored window frames, outlines, and lighting updates) for buildings far from the camera creates a massive vertex processing load, dropping the framerate below 30 FPS on low-end or mobile devices.\n\n### Expected Behavior\nThe scene should run smoothly at 60 FPS on all modern devices by reducing geometry complexity for distant objects.\n\n### Proposed Solution\nImplement a Level of Detail (LOD) rendering system:\n1. For buildings close to the camera, render detailed instanced blocks, windows, and light updates.\n2. For buildings far away (e.g. distance > 1000 units), swap the geometry with simplified low-poly single-box meshes and disable local window/lighting calculations.\n3. Implement simple frustum-based viewport culling to avoid updating or rendering blocks entirely out of bounds.`,
            labels: ["gssoc 26", "gssoc:approved", "good first issues", "level:hard", "type:enhancement"]
        },
        {
            title: "⚡ Performance: Handle WebGL Context Loss to Stabilize the 3D Render Loop",
            body: `### Description\nWhen running LeetCode City in background browser tabs, or under heavy graphic load on mobile devices, the browser occasionally triggers a WebGL Context Lost crash. When this happens, the page goes entirely black or white and remains unresponsive until the user performs a hard refresh.\n\n### Expected Behavior\nThe system should handle WebGL crashes gracefully and recover the scene structure automatically without user intervention.\n\n### Proposed Solution\n1. Add listener handlers for \`webglcontextlost\` and \`webglcontextrestored\` events on the canvas render target.\n2. Upon context loss, pause the render loop, save the current camera coordinates, and clean up active references.\n3. Upon context restoration, re-initialize the Three.js WebGLRenderer, re-load the models/textures, and resume the frame updates.`,
            labels: ["gssoc 26", "gssoc:approved", "good first issues", "level:medium", "type:bug"]
        }
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }

    console.log("\nDone posting optimization issues!");
}

run().catch(console.error);

import fs from 'fs';
import https from 'https';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
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

// Helper for REST API requests
function restRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.github.com',
            path,
            method,
            headers: {
                ...headers,
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };

        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(resBody ? JSON.parse(resBody) : {});
                } else {
                    reject(new Error(`Request to ${path} failed with status ${res.statusCode}: ${resBody}`));
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

// Helper for GraphQL API requests
function graphqlRequest(query, variables = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query, variables });
        const options = {
            hostname: 'api.github.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `bearer ${token}`,
                'User-Agent': 'Node.js',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(resBody));
                } else {
                    reject(new Error(`GraphQL failed with status ${res.statusCode}: ${resBody}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log("Starting GitHub updates...");

    // 1. Ensure 'level:critical' label exists
    try {
        await restRequest('POST', `/repos/${repo}/labels`, {
            name: "level:critical",
            color: "b60205",
            description: "Critical severity/priority level"
        });
        console.log("Created label: level:critical");
    } catch (e) {
        console.log("Label level:critical might already exist.");
    }

    // 2. Find and delete (close/lock) the issue regarding "dark continent"
    try {
        console.log("Searching for 'dark continent' issue...");
        const searchResults = await restRequest('GET', `/search/issues?q=repo:${repo}+state:open+dark+continent`);
        const items = searchResults.items || [];
        if (items.length > 0) {
            for (const item of items) {
                console.log(`Closing and locking issue #${item.number}: "${item.title}"`);
                // Close the issue
                await restRequest('PATCH', `/repos/${repo}/issues/${item.number}`, {
                    state: "closed",
                    state_reason: "not_planned"
                });
                // Comment on the issue
                await restRequest('POST', `/repos/${repo}/issues/${item.number}/comments`, {
                    body: "This issue has been superseded by the new Supabase Realtime Multiplayer and Open Map Development roadmap."
                });
                // Lock the issue
                await restRequest('PUT', `/repos/${repo}/issues/${item.number}/lock`, {
                    lock_reason: "resolved"
                });
                console.log(`Successfully locked and closed issue #${item.number}`);
            }
        } else {
            console.log("No open 'dark continent' issues found.");
        }
    } catch (e) {
        console.error("Error closing 'dark continent' issue:", e);
    }

    // 3. Create the new critical issue: "[RFC] E.Arcade Open Map Development & Multiplayer Improvements"
    let newIssueNodeId = "";
    let newIssueNumber = 0;
    try {
        console.log("Creating new critical issue...");
        const issueBody = `### Introduction
We have recently migrated the E.Arcade multiplayer system from **PartyKit** (server-authoritative) to **Supabase Realtime** (client-authoritative using Broadcast and Presence). This transition provides a 100% free, reliable, and serverless multiplayer experience. 

However, the **Open Map (Ixotopia)** is currently under active development and has several known issues, missing features, and rendering bugs. We need your feedback and contributions to make it a state-of-the-art virtual town!

### Current System & Known Issues
1. **No Collision / Clipping Issues:** Players can currently walk through walls, trees, buildings, and water boundaries because complete bounding-box collisions are not yet implemented in the client-side canvas engine.
2. **Choppy Remote Movement:** Remote players are broadcasted instantly, but without linear interpolation (lerp) or movement smoothing, they might appear to jump or teleport across the screen on latency spikes.
3. **No Interactive Elements:** Plazas and buildings are static. There are no interactable NPCs, portals (elevator transitions work, but need styling/dialogues), or mini-games.
4. **Stale Active Player Counts:** If a player closes their tab suddenly, their entry in \`arcade_active_players\` remains until the session expires or a database cron cleans it up.

### Call to Action for Contributors 🚀
We want to hear your proposals and see your PRs on how we should change and improve the Open Map!
- How should we implement efficient 2D/3D collision boundaries for the tiling system?
- What mini-games (e.g. quiz challenges, pixel-art collectible hunt) should we add to the town squares?
- How can we structure local quests that fetch LeetCode profiles/API stats to unlock custom map cosmetics?
- What visual improvements or layout changes would make the town feel more alive?

Please put your thoughts, ideas, and architecture designs in the comments below. Let's build LeetCode City together!`;

        const newIssue = await restRequest('POST', `/repos/${repo}/issues`, {
            title: "[RFC] E.Arcade Open Map Development & Multiplayer Improvements",
            body: issueBody,
            labels: ["level:critical", "realtime", "backend"]
        });
        
        newIssueNodeId = newIssue.node_id;
        newIssueNumber = newIssue.number;
        console.log(`Created new issue #${newIssueNumber} (Node ID: ${newIssueNodeId})`);
    } catch (e) {
        console.error("Error creating new critical issue:", e);
        process.exit(1);
    }

    // 4. Pin the new issue using the GraphQL API
    if (newIssueNodeId) {
        try {
            console.log("Pinning the new critical issue...");
            const pinMutation = `
                mutation($issueId: ID!) {
                    pinIssue(input: {issueId: $issueId}) {
                        issue {
                            title
                            isPinned
                        }
                    }
                }
            `;
            const pinResult = await graphqlRequest(pinMutation, { issueId: newIssueNodeId });
            if (pinResult.errors) {
                console.error("Failed to pin issue:", pinResult.errors);
            } else {
                console.log("Successfully pinned issue:", pinResult.data.pinIssue.issue.title);
            }
        } catch (e) {
            console.error("Error pinning issue via GraphQL:", e);
        }
    }

    // 5. Create a GitHub Discussion introducing the new system
    try {
        console.log("Fetching repository ID and discussion categories...");
        const getCategoriesQuery = `
            query {
                repository(owner: "Ixotic27", name: "The-Leetcode-City") {
                    id
                    discussionCategories(first: 10) {
                        nodes {
                            id
                            name
                        }
                    }
                }
            }
        `;
        const repoData = await graphqlRequest(getCategoriesQuery);
        if (repoData.errors) {
            console.error("Error fetching repository info:", repoData.errors);
            return;
        }

        const repoId = repoData.data.repository.id;
        const categories = repoData.data.repository.discussionCategories.nodes;

        // Find announcements or general category
        let categoryId = categories.find(c => c.name.toLowerCase().includes('announcement'))?.id;
        if (!categoryId) categoryId = categories.find(c => c.name.toLowerCase().includes('general'))?.id;
        if (!categoryId) categoryId = categories[0].id;

        const discTitle = "Introducing Supabase Realtime Multiplayer & Open Map Development";
        const discBody = `Hello everyone! 🎉

We are excited to announce a major architectural upgrade to the **E.Arcade Multiplayer System**! 

### What's New?
We have completely migrated from PartyKit to **Supabase Realtime**. This brings several benefits:
- **100% Free & Serverless:** Eliminates all deployment costs and limits of PartyKit.
- **Client-Authoritative Broadcast:** Near zero-latency player movement and chat using Supabase Realtime Broadcast.
- **Ephemeral Presence:** Player online listings and status sync are handled smoothly via Supabase Presence.
- **Persistent DB Logging:** Key messages and user locations are logged directly into standard Supabase tables for seamless data queries.

### The Open Map (Ixotopia) is Under Development!
The open overworld town is currently in its early stages. There are missing features and issues:
- Bounding-box collisions are not fully set up (you can walk through walls).
- Player positions snap on packet updates.
- No interactable shops, portals, or quests.

We have created a critical issue **[RFC] E.Arcade Open Map Development & Multiplayer Improvements** to coordinate contributions. We want to hear your proposals and ideas on how to build out these features!

Check out the issue here: https://github.com/Ixotic27/The-Leetcode-City/issues/${newIssueNumber}

Thank you for your incredible support in making LeetCode City amazing!`;

        const createDiscMutation = `
            mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
                createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
                    discussion {
                        url
                    }
                }
            }
        `;
        const discResult = await graphqlRequest(createDiscMutation, {
            repositoryId: repoId,
            categoryId: categoryId,
            title: discTitle,
            body: discBody
        });

        if (discResult.errors) {
            console.error("Error creating discussion:", discResult.errors);
        } else {
            console.log("Successfully created discussion:", discResult.data.createDiscussion.discussion.url);
        }
    } catch (e) {
        console.error("Error creating GitHub discussion:", e);
    }
}

run().catch(console.error);

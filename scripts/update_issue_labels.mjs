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

async function run() {
    try {
        // Fetch all open issues in the repo
        const issues = await restRequest('GET', `/repos/${repo}/issues?state=open&per_page=100`);
        
        console.log(`Found ${issues.length} open issues in total.`);
        
        const targetTitles = {
            mapTheme: "Redesign E.Arcade Map Theme to Arcade Grey Style",
            dailyBuilding: "Redesign Daily Questions Building to Match E.Arcade Style",
            traffic: "Replace Tower-Orbiting Traffic with Optimized Street/Ring Random Cars"
        };
        
        const mapThemeLabels = ["gssoc 26", "gssoc:approved", "level:advanced", "type:feature", "type:design"];
        const dailyBuildingLabels = ["gssoc 26", "gssoc:approved", "level:intermediate", "type:feature", "type:design"];
        const trafficLabels = ["gssoc 26", "gssoc:approved", "level:advanced", "type:refactor", "type:performance"];

        let updatedCount = 0;
        for (const issue of issues) {
            let labelsToSet = null;
            if (issue.title.includes(targetTitles.mapTheme)) {
                labelsToSet = mapThemeLabels;
            } else if (issue.title.includes(targetTitles.dailyBuilding)) {
                labelsToSet = dailyBuildingLabels;
            } else if (issue.title.includes(targetTitles.traffic)) {
                labelsToSet = trafficLabels;
            }

            if (labelsToSet) {
                console.log(`Updating labels for issue #${issue.number}: "${issue.title}"`);
                console.log(`Setting labels: ${labelsToSet.join(", ")}`);
                // Replace all labels on the issue
                await restRequest('PUT', `/repos/${repo}/issues/${issue.number}/labels`, { labels: labelsToSet });
                console.log(`Successfully updated #${issue.number}`);
                updatedCount++;
            }
        }
        console.log(`Updated ${updatedCount} issues.`);
    } catch (err) {
        console.error("Failed to update issue labels:", err);
    }
}

run().catch(console.error);

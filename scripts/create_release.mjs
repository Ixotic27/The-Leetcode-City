const repo = "Ixotic27/The-Leetcode-City";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("Missing GITHUB_TOKEN environment variable.");
}

const headers = {
  Accept: "application/vnd.github.v3+json",
  Authorization: `token ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "Node-Script",
};

async function createRelease() {
  console.log("Creating v1.0.1 Release...");
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tag_name: "v1.0.1",
      target_commitish: "main",
      name: "v1.0.1 - Initial Official Release 🚀",
      body: "Welcome to the first official release of **The LeetCode City**!\n\nThis release includes:\n- Full gamification of LeetCode stats into a vibrant 3D city.\n- Automated GSSoC onboarding and issue management.\n- Secure code base with strict CI/CD pipelines.\n- Complete Docker containerization and package publishing.\n\nThank you to all contributors who have helped build this amazing project!",
      draft: false,
      prerelease: false,
      generate_release_notes: false,
    }),
  });

  if (!res.ok) {
    console.error("Failed to create release:", await res.text());
  } else {
    const release = await res.json();
    console.log(`Release created successfully! URL: ${release.html_url}`);
  }
}

createRelease().catch(console.error);

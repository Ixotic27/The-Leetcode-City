import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getConfig } from "../config";
import { getKey } from "../auth/keystore";

export interface ChallengeData {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  challenge_date: string;
  reward_points: number;
  reward_xp: number;
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty_rating: number;
    tags: string[];
    time_limit_ms: number;
    memory_limit_mb: number;
    sample_tests: Array<{ input: string; output: string }>;
    encrypted_hidden_tests: string;
    iv: string;
  };
}

export async function fetchChallenge(challengeId: string, origin?: string): Promise<ChallengeData> {
  const { apiUrl: configApiUrl } = getConfig();
  const apiUrl = origin || configApiUrl;
  const apiKey = await getKey();
  if (!apiKey) {
    throw new Error("Pulse key not found. Please connect your extension to LeetCode City first.");
  }
  
  // Using global fetch (available in modern VS Code node environments)
  const res = await (globalThis as any).fetch(`${apiUrl}/api/arena/challenge/${challengeId}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });
  
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP error ${res.status}`);
  }
  
  return await res.json() as ChallengeData;
}

export async function fetchTodayChallenges(origin?: string): Promise<ChallengeData[]> {
  const { apiUrl: configApiUrl } = getConfig();
  const apiUrl = origin || configApiUrl;
  const apiKey = await getKey();
  if (!apiKey) {
    throw new Error("Pulse key not found. Please connect your extension to LeetCode City first.");
  }

  const res = await (globalThis as any).fetch(`${apiUrl}/api/arena/challenge/today`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP error ${res.status}`);
  }

  const data = await res.json();
  return (data.challenges || []) as ChallengeData[];
}

/** Convert a problem title to a snake_case slug for filenames */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")           // spaces/hyphens → underscores
    .replace(/[^a-z0-9_]/g, "")         // remove non-alphanumeric
    .replace(/_+/g, "_")                // collapse consecutive underscores
    .replace(/^_|_$/g, "");             // trim leading/trailing underscores
}

/** Convert a problem title to PascalCase for Java class names */
export function pascalCaseTitle(title: string): string {
  let cleanTitle = title.replace(/^\d+[a-zA-Z]*[\.\s]+/, "");
  if (!cleanTitle.trim()) {
    cleanTitle = "Problem" + title;
  }
  return cleanTitle
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function generateBoilerplate(ext: string, title: string): string {
  const header = `LeetCode City Arena -- ${title}`;

  switch (ext) {
    case "py":
      return `# ${header}\n# Input is read from stdin, output written to stdout\nimport sys\n\ndef main():\n    input_data = sys.stdin.read().split('\\n')\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    main()\n`;
    case "js":
      return `// ${header}\n// Input is read from stdin, output written to stdout\nconst fs = require('fs');\n\nfunction main() {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nmain();\n`;
    case "ts":
      return `// ${header}\n// Input is read from stdin, output written to stdout\nimport * as fs from 'fs';\n\nfunction main(): void {\n  const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\n  // Write your solution here\n}\n\nmain();\n`;
    case "cpp":
      return `// ${header}\n#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    // Write your solution here\n\n    return 0;\n}\n`;
    case "java": {
      const className = pascalCaseTitle(title);
      return `// ${header}\nimport java.util.*;\nimport java.io.*;\n\npublic class ${className} {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your solution here\n    }\n}\n`;
    }
    case "go":
      return `// ${header}\npackage main\n\nimport (\n\t"fmt"\n\t"io"\n\t"os"\n)\n\nfunc main() {\n\t// Write your solution here\n}\n`;
    case "rs":
      return `// ${header}\nuse std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    // Write your solution here\n}\n`;
    default:
      return `# ${header}\n# Write your solution here\n`;
  }
}

export async function setupChallengeWorkspace(challenge: ChallengeData, ext: string): Promise<string> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("Please open a folder or workspace in VS Code to start the challenge.");
  }
  
  const rootPath = folders[0].uri.fsPath;
  const arenaDir = path.join(rootPath, ".leetcode-city-arena");
  if (!fs.existsSync(arenaDir)) {
    fs.mkdirSync(arenaDir, { recursive: true });
  }

  // Build filename from problem title
  const slug = slugifyTitle(challenge.problem.title);
  const isJava = ext === "java";
  const fileName = isJava
    ? `${pascalCaseTitle(challenge.problem.title)}.java`
    : `${slug}.${ext}`;

  const solutionPath = path.join(arenaDir, fileName);

  // Create solution file only if it doesn't exist
  if (!fs.existsSync(solutionPath)) {
    const boilerplate = generateBoilerplate(ext, challenge.problem.title);
    fs.writeFileSync(solutionPath, boilerplate, "utf8");
  }
  
  // Open the solution file in editor
  const doc = await vscode.workspace.openTextDocument(solutionPath);
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });

  return solutionPath;
}

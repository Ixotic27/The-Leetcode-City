import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/Ixotic27/The-Leetcode-City/main/packages/vscode-extension";

const PACKAGE_JSON_URL = `${GITHUB_RAW_BASE}/package.json`;

/**
 * Compare two semver strings.  Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * Download a file from a URL to a local path.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for download

  const res = await (globalThis as any).fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Runs once on activation – silently checks if a newer version exists on the
 * main branch. If so, downloads the .vsix and installs it automatically,
 * just like a marketplace extension update.
 *
 * Debounced: runs at most once every 6 hours via globalState timestamp.
 */
export async function checkForUpdates(context: vscode.ExtensionContext) {
  const DEBOUNCE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const lastCheck = context.globalState.get<number>("leetcodecity.lastUpdateCheck", 0);
  if (Date.now() - lastCheck < DEBOUNCE_MS) return;

  try {
    // 1. Fetch remote package.json to get latest version
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await (globalThis as any).fetch(PACKAGE_JSON_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return;

    const remote = await res.json();
    const remoteVersion: string = remote.version;
    const ext = vscode.extensions.getExtension("leetcode-city.leetcode-city-pulse");
    if (!ext) return;

    const localVersion: string = ext.packageJSON.version;

    // Update the last-check timestamp regardless of outcome
    context.globalState.update("leetcodecity.lastUpdateCheck", Date.now());

    if (compareSemver(remoteVersion, localVersion) <= 0) return;

    // 2. Newer version available — download the .vsix
    const vsixUrl = `${GITHUB_RAW_BASE}/leetcode-city-pulse-${remoteVersion}.vsix`;
    const tmpDir = os.tmpdir();
    const vsixPath = path.join(tmpDir, `leetcode-city-pulse-${remoteVersion}.vsix`);

    // Show a progress notification while downloading
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🏙️ Updating LeetCode City: Pulse to v${remoteVersion}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading..." });
        await downloadFile(vsixUrl, vsixPath);

        // 3. Install the .vsix using VS Code's built-in command
        progress.report({ message: "Installing..." });
        await vscode.commands.executeCommand(
          "workbench.extensions.installExtension",
          vscode.Uri.file(vsixPath)
        );

        // 4. Clean up the temp file
        try { fs.unlinkSync(vsixPath); } catch { /* best effort */ }
      }
    );

    // 5. Prompt to reload so the new version activates
    const action = await vscode.window.showInformationMessage(
      `🏙️ LeetCode City: Pulse has been updated to v${remoteVersion}! Please reload to activate.`,
      "Reload Now",
      "Later"
    );

    if (action === "Reload Now") {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch {
    // Network error, download failure, or timeout – fail silently.
  }
}

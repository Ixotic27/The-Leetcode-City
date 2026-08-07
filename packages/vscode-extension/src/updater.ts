import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/Ixotic27/The-Leetcode-City/main/packages/vscode-extension";

export const PACKAGE_JSON_URL = `${GITHUB_RAW_BASE}/package.json`;

/**
 * Compare two semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
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
 * Perform a fetch call with timeout control via AbortController.
 * Respects any caller-provided RequestInit.signal by propagating abort events.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let abortListener: (() => void) | undefined;
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      abortListener = () => controller.abort();
      options.signal.addEventListener("abort", abortListener);
    }
  }

  try {
    const res = await (globalThis as any).fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal && abortListener) {
      options.signal.removeEventListener("abort", abortListener);
    }
  }
}

/**
 * Perform fetch with retries on network failures, timeouts, or non-200 HTTP statuses.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
  retries = 2,
  backoffMs = 1000
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok) {
        return res;
      }
      throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
    } catch (err: any) {
      lastError = err;
      if (attempt < retries && backoffMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Download a file from a URL to a local path with retries and validation.
 */
export async function downloadFile(
  url: string,
  destPath: string,
  backoffMs = 1000
): Promise<void> {
  const res = await fetchWithRetry(url, {}, 30000, 2, backoffMs);
  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Downloaded file is empty");
  }
  await fs.promises.writeFile(destPath, Buffer.from(buffer));
}

/**
 * Runs once on activation – checks if a newer version exists on the main branch.
 * If so, downloads the .vsix and installs it automatically, with retries, logging,
 * and robust error handling.
 *
 * Debounced: runs at most once every 6 hours via globalState timestamp.
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
  const DEBOUNCE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const lastCheck = context.globalState.get<number>("leetcodecity.lastUpdateCheck", 0);
  if (Date.now() - lastCheck < DEBOUNCE_MS) return;

  let remotePackage: any;
  try {
    const res = await fetchWithRetry(
      PACKAGE_JSON_URL,
      { headers: { "Cache-Control": "no-cache" } },
      5000,
      2,
      1000
    );
    const rawText = await res.text();
    remotePackage = JSON.parse(rawText);
  } catch (err: any) {
    console.warn(`[LeetCode City Updater] Check for updates failed: ${err?.message || err}`);
    return;
  }

  const remoteVersion = remotePackage?.version;
  if (typeof remoteVersion !== "string") {
    console.warn("[LeetCode City Updater] Invalid remote package.json version format");
    return;
  }

  const ext = vscode.extensions.getExtension("leetcode-city.leetcode-city-pulse");
  if (!ext) {
    console.warn("[LeetCode City Updater] Extension 'leetcode-city.leetcode-city-pulse' not found");
    return;
  }

  const localVersion: string = ext.packageJSON.version;

  if (compareSemver(remoteVersion, localVersion) <= 0) {
    // Update last-check timestamp if we are already on the latest version
    await context.globalState.update("leetcodecity.lastUpdateCheck", Date.now());
    return;
  }

  // Newer version available — download the .vsix
  const vsixUrl = `${GITHUB_RAW_BASE}/leetcode-city-pulse-${remoteVersion}.vsix`;
  const tmpDir = os.tmpdir();
  const vsixPath = path.join(tmpDir, `leetcode-city-pulse-${remoteVersion}.vsix`);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Updating LeetCode City: Pulse to v${remoteVersion}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading..." });
        await downloadFile(vsixUrl, vsixPath);

        // Install the .vsix using VS Code's built-in command
        progress.report({ message: "Installing..." });
        await vscode.commands.executeCommand(
          "workbench.extensions.installExtension",
          vscode.Uri.file(vsixPath)
        );
      }
    );

    // Update the last-check timestamp ONLY after successful download & installation
    await context.globalState.update("leetcodecity.lastUpdateCheck", Date.now());

    // Prompt to reload so the new version activates
    const action = await vscode.window.showInformationMessage(
      `LeetCode City: Pulse has been updated to v${remoteVersion}! Please reload to activate.`,
      "Reload Now",
      "Later"
    );

    if (action === "Reload Now") {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn(`[LeetCode City Updater] Extension update failed: ${errMsg}`);
    vscode.window.showWarningMessage(
      `LeetCode City: Pulse update failed: ${errMsg}`
    );
  } finally {
    try {
      await fs.promises.unlink(vsixPath);
    } catch {
      /* best effort cleanup */
    }
  }
}

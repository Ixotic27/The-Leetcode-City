import * as vscode from "vscode";
import { initKeystore, getKey, getCachedKey, setKey, deleteKey } from "./auth/keystore";
import { initQueue, stopQueue } from "./api/queue";
import { initTracker, setPaused, isPaused, sendImmediateHeartbeat, sendOfflineSignal, buildOfflineHeartbeat } from "./activity/tracker";
import { sendDirect } from "./api/client";
import { initStatusBar, updateDisplay } from "./statusbar/item";
import { getConfig } from "./config";
import { ArenaProvider } from "./arena/ArenaProvider";
import { checkForUpdates } from "./updater";

export function activate(context: vscode.ExtensionContext) {
  initKeystore(context);
  initQueue(context);
  initStatusBar(context);

  // Check for extension updates from GitHub
  checkForUpdates(context);

  // Start tracker with status bar callback
  initTracker(context, (status) => {
    if (status === "paused") {
      updateDisplay("paused");
    } else if (status === "idle") {
      updateDisplay("idle");
    } else {
      updateDisplay("active");
    }
  });

  // Check if we have a key and update status bar accordingly
  getKey().then((key) => {
    if (!key) {
      updateDisplay("connect");
    } else if (getConfig().enabled) {
      updateDisplay("active");
    }
  });

  // Register Arena Sidebar Webview
  const arenaProvider = new ArenaProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ArenaProvider.viewType,
      arenaProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Command to open challenge
  context.subscriptions.push(
    vscode.commands.registerCommand("leetcodecity.openChallenge", (challengeId: string, origin?: string) => {
      arenaProvider.loadChallengeById(challengeId, origin);
    })
  );

  // Deep Link URI Handler (vscode://leetcode-city.leetcode-city-pulse/arena?challenge=xxx)
  class ArenaUriHandler implements vscode.UriHandler {
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      if (uri.path === "/arena" || uri.path === "arena") {
        const queryParams = new URLSearchParams(uri.query);
        const challengeId = queryParams.get("challenge");
        const origin = queryParams.get("origin") || queryParams.get("apiUrl") || undefined;
        
        if (origin) {
          const cfg = vscode.workspace.getConfiguration("leetcodecity");
          if (cfg.get("apiUrl") !== origin) {
            cfg.update("apiUrl", origin, vscode.ConfigurationTarget.Global).then(() => {
              vscode.window.showInformationMessage(`LeetCode City API URL updated to: ${origin}`);
            });
          }
        }

        if (challengeId) {
          vscode.commands.executeCommand("leetcodecity.openChallenge", challengeId, origin);
        }
      }
    }
  }

  context.subscriptions.push(
    vscode.window.registerUriHandler(new ArenaUriHandler())
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("leetcodecity.login", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Paste your API key from the-leetcode-city.vercel.app",
        placeHolder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        password: true,
        ignoreFocusOut: true,
      });

      if (key) {
        await setKey(key);
        updateDisplay("active");
        // Send a heartbeat immediately so the dev appears on the site within seconds
        sendImmediateHeartbeat();
        const action = await vscode.window.showInformationMessage(
          "Pulse connected. Your building is powering the city.",
          "See my building",
        );
        if (action === "See my building") {
          const { apiUrl } = getConfig();
          vscode.env.openExternal(vscode.Uri.parse(apiUrl));
        }
      }
    }),

    vscode.commands.registerCommand("leetcodecity.logout", async () => {
      await deleteKey();
      sendOfflineSignal();
      updateDisplay("connect");
      vscode.window.showInformationMessage("Pulse disconnected.");
    }),

    vscode.commands.registerCommand("leetcodecity.togglePause", () => {
      const newState = !isPaused();
      setPaused(newState);
      updateDisplay(newState ? "paused" : "active");
    }),

    vscode.commands.registerCommand("leetcodecity.showDashboard", () => {
      const { apiUrl } = getConfig();
      vscode.env.openExternal(vscode.Uri.parse(apiUrl));
    }),
  );
}

export async function deactivate() {
  // Use cached key since SecretStorage may be unavailable during shutdown.
  // VS Code waits for the returned Promise before killing the process.
  const key = getCachedKey();
  stopQueue();
  if (key) {
    await sendDirect(buildOfflineHeartbeat(), key);
  }
}

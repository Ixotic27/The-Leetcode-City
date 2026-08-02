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
  .catch(err => console.error(err))
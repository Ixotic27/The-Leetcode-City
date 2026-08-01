import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { fetchChallenge, fetchTodayChallenges, setupChallengeWorkspace, slugifyTitle, pascalCaseTitle, ChallengeData, fetchArenaStats, fetchArenaLeaderboard, fetchRabbitProgress, fetchDungeonBoss } from "./problemManager";
import { TimerManager, TimerState } from "./timerManager";
import { getAvailableLanguages, getLanguageConfigByExtension, LANGUAGES } from "./languageDetector";
import { runTests, RunResult } from "./testRunner";
import { decryptHiddenTests } from "./cryptoUtils";
import { submitSolution } from "./submitter";
import { getConfig } from "../config";

export class ArenaProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "leetcodecity.arenaView";
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _timerManager: TimerManager;
  
  private _activeChallenge?: ChallengeData;
  private _activeSolutionPath?: string;
  private _activeLanguageExt?: string;
  private _isRunningTests: boolean = false;
  private _isSubmitting: boolean = false;
  private _timerEnabled: boolean = true;

  // Cached challenges for the home view
  private _todayChallenges: ChallengeData[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._timerManager = new TimerManager(context);
    this._timerEnabled = context.globalState.get<boolean>("leetcodecity.timerEnabled", true);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Register messages from Webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "requestState": {
          this._sendState();
          break;
        }
        case "fetchDailyChallenges": {
          await this._handleFetchDaily();
          break;
        }
        case "loadChallenge": {
          await this.loadChallengeById(data.challengeId);
          break;
        }
        case "startCoding": {
          await this._handleStartCoding(data.ext);
          break;
        }
        case "runSample": {
          await this._handleRunSample();
          break;
        }
        case "submit": {
          await this._handleSubmit();
          break;
        }
        case "openFiles": {
          if (this._activeChallenge) {
            try {
              const ext = this._activeLanguageExt || "py";
              this._activeSolutionPath = await setupChallengeWorkspace(this._activeChallenge, ext);
              this._context.workspaceState.update(`leetcodecity.activeSolutionPath.${this._activeChallenge.id}`, this._activeSolutionPath);
              this._context.workspaceState.update(`leetcodecity.activeLanguage.${this._activeChallenge.id}`, ext);
            } catch (err: any) {
              vscode.window.showErrorMessage(err.message);
            }
          }
          break;
        }
        case "selectLanguage": {
          this._activeLanguageExt = data.ext;
          if (this._activeChallenge) {
            this._context.workspaceState.update(`leetcodecity.activeLanguage.${this._activeChallenge.id}`, data.ext);
          }
          this._sendState();
          break;
        }
        case "toggleTimer": {
          this._timerEnabled = data.enabled;
          this._context.globalState.update("leetcodecity.timerEnabled", this._timerEnabled);
          if (!this._timerEnabled) {
            this._timerManager.clearTimer();
          } else {
            if (this._activeChallenge) {
              this._timerManager.startTimer(this._activeChallenge.id, this._activeChallenge.difficulty, (timeLeftMs) => {
                this._view?.webview.postMessage({ type: "timerTick", timeLeftMs });
              });
            }
          }
          this._sendState();
          break;
        }
        case "fetchStats": {
          await this._handleFetchStats();
          break;
        }
      }
    });

    // Resume timer if there's an active one in workspace state
    this._timerManager.resumeTimerIfActive((timeLeftMs) => {
      this._view?.webview.postMessage({ type: "timerTick", timeLeftMs });
    });

    // Also look for currently open challenge in workspace state
    const timerState = this._timerManager.getActiveTimer();
    if (timerState && !this._activeChallenge) {
      this.loadChallengeById(timerState.challengeId);
    }
  }

  private async _handleFetchDaily() {
    if (!this._view) return;
    this._view.webview.postMessage({ type: "dailyLoading" });

    try {
      this._todayChallenges = await fetchTodayChallenges();
      this._view.webview.postMessage({
        type: "dailyChallenges",
        challenges: this._todayChallenges.map(ch => ({
          id: ch.id,
          difficulty: ch.difficulty,
          reward_points: ch.reward_points,
          reward_xp: ch.reward_xp,
          title: ch.problem.title,
          tags: ch.problem.tags,
          difficulty_rating: ch.problem.difficulty_rating,
          status: (ch as any).status,
        }))
      });
    } catch (err: any) {
      // Check if we are pointing to production but local dev server is active
      const config = getConfig();
      if (config.apiUrl.includes("vercel.app") || config.apiUrl.includes("the-leetcode-city")) {
        const localPorts = [3001, 3000];
        let foundLocal = false;
        for (const port of localPorts) {
          try {
            const testUrl = `http://localhost:${port}/api/arena/challenge/today`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);
            const testRes = await (globalThis as any).fetch(testUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (testRes.status === 200 || testRes.status === 401 || testRes.status === 404) {
              // Any response (even error but not connection refused) means a server is running there
              const switchMsg = `Your local dev server is running on port ${port}. Would you like to update the extension API URL to use it?`;
              const updateBtn = `Switch to port ${port}`;
              vscode.window.showInformationMessage(switchMsg, updateBtn).then(async (selection) => {
              .catch(err => console.error(err))
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { fetchChallenge, fetchTodayChallenges, setupChallengeWorkspace, slugifyTitle, pascalCaseTitle, ChallengeData } from "./problemManager";
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
                if (selection === updateBtn) {
                  const cfg = vscode.workspace.getConfiguration("leetcodecity");
                  await cfg.update("apiUrl", `http://localhost:${port}`, vscode.ConfigurationTarget.Global);
                  vscode.window.showInformationMessage(`API URL updated to http://localhost:${port}. Retrying...`);
                  this._handleFetchDaily();
                }
              });
              foundLocal = true;
              break;
            }
          } catch (e) {
            // ignore and try next port
          }
        }
        if (foundLocal) {
          this._view.webview.postMessage({ type: "dailyError", message: `${err.message} (Local server detected on active port)` });
          return;
        }
      }
      this._view.webview.postMessage({ type: "dailyError", message: err.message });
    }
  }

  private async _handleStartCoding(ext: string) {
    if (!this._activeChallenge) return;
    this._activeLanguageExt = ext;
    this._context.workspaceState.update(`leetcodecity.activeLanguage.${this._activeChallenge.id}`, ext);

    try {
      this._activeSolutionPath = await setupChallengeWorkspace(this._activeChallenge, ext);
      this._context.workspaceState.update(`leetcodecity.activeSolutionPath.${this._activeChallenge.id}`, this._activeSolutionPath);
      this._sendState();
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }

  public async loadChallengeById(challengeId: string, origin?: string) {
    if (!this._view) return;
    
    this._view.show(true);
    this._view.webview.postMessage({ type: "loading", challengeId });

    try {
      const challenge = await fetchChallenge(challengeId, origin);
      this._activeChallenge = challenge;

      // Detect available languages
      const availableLangs = await getAvailableLanguages();

      // Auto-detect existing solution file in .leetcode-city-arena
      let foundPath: string | undefined = undefined;
      let foundExt: string | undefined = undefined;
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const rootPath = folders[0].uri.fsPath;
        // Check for Java first
        const javaFileName = `${pascalCaseTitle(challenge.problem.title)}.java`;
        const javaPath = path.join(rootPath, ".leetcode-city-arena", javaFileName);
        if (fs.existsSync(javaPath)) {
          foundPath = javaPath;
          foundExt = "java";
        } else {
          // Check other languages
          for (const lang of Object.values(LANGUAGES)) {
            if (lang.extension === "java") continue;
            const fileName = `${slugifyTitle(challenge.problem.title)}.${lang.extension}`;
            const checkPath = path.join(rootPath, ".leetcode-city-arena", fileName);
            if (fs.existsSync(checkPath)) {
              foundPath = checkPath;
              foundExt = lang.extension;
              break;
            }
          }
        }
      }

      if (foundPath && foundExt) {
        this._activeSolutionPath = foundPath;
        this._activeLanguageExt = foundExt;
      } else {
        // Fallback to workspaceState or default
        const savedLang = this._context.workspaceState.get<string>(`leetcodecity.activeLanguage.${challengeId}`);
        const savedPath = this._context.workspaceState.get<string>(`leetcodecity.activeSolutionPath.${challengeId}`);
        if (savedLang && savedPath && fs.existsSync(savedPath)) {
          this._activeLanguageExt = savedLang;
          this._activeSolutionPath = savedPath;
        } else {
          this._activeLanguageExt = this._activeLanguageExt || availableLangs[0]?.extension || "py";
          this._activeSolutionPath = undefined;
        }
      }

      // Don't auto-create files anymore — user picks language first via "Start Coding"

      // Start timer if not already active
      const activeTimer = this._timerManager.getActiveTimer();
      if (!activeTimer || activeTimer.challengeId !== challengeId) {
        this._timerManager.startTimer(challengeId, challenge.difficulty, (timeLeftMs) => {
          this._view?.webview.postMessage({ type: "timerTick", timeLeftMs });
          if (timeLeftMs <= 0) {
            vscode.window.showWarningMessage(`Coding Arena: Time has expired for today's ${challenge.difficulty} challenge!`);
            this._sendState();
          }
        });
      }

      this._sendState();

      // Also tell the webview to navigate to the detail view
      this._view.webview.postMessage({ type: "navigateToDetail" });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to load challenge: ${err.message}`);
      this._view.webview.postMessage({ type: "error", message: err.message });
    }
  }

  private _sendState() {
    if (!this._view) return;

    const availableLangs = Object.values(LANGUAGES).map(l => ({
      name: l.name,
      extension: l.extension
    }));

    const timerState = this._timerManager.getActiveTimer();
    const remainingTime = this._timerManager.getRemainingTimeMs();

    this._view.webview.postMessage({
      type: "state",
      challenge: this._activeChallenge ? {
        id: this._activeChallenge.id,
        difficulty: this._activeChallenge.difficulty,
        reward_points: this._activeChallenge.reward_points,
        reward_xp: this._activeChallenge.reward_xp,
        problem: {
          id: this._activeChallenge.problem.id,
          title: this._activeChallenge.problem.title,
          description: this._activeChallenge.problem.description,
          tags: this._activeChallenge.problem.tags,
          difficulty_rating: this._activeChallenge.problem.difficulty_rating,
          time_limit_ms: this._activeChallenge.problem.time_limit_ms,
          memory_limit_mb: this._activeChallenge.problem.memory_limit_mb,
          sample_tests: this._activeChallenge.problem.sample_tests
        }
      } : null,
      selectedLanguage: this._activeLanguageExt,
      availableLanguages: availableLangs,
      timerActive: !this._timerEnabled ? true : (!!timerState && remainingTime > 0),
      timerEnabled: this._timerEnabled,
      timeLeftMs: remainingTime,
      isRunningTests: this._isRunningTests,
      isSubmitting: this._isSubmitting
    });
  }

  private async _handleRunSample() {
    if (!this._activeChallenge || !this._activeLanguageExt) return;

    // Resolve solution path using new naming
    let filePath = this._activeSolutionPath;
    if (!filePath || !fs.existsSync(filePath)) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const rootPath = folders[0].uri.fsPath;
        const isJava = this._activeLanguageExt === "java";
        const solutionFileName = isJava
          ? `${pascalCaseTitle(this._activeChallenge.problem.title)}.java`
          : `${slugifyTitle(this._activeChallenge.problem.title)}.${this._activeLanguageExt}`;
        filePath = path.join(rootPath, ".leetcode-city-arena", solutionFileName);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      vscode.window.showErrorMessage("Active solution file not found. Click 'Start Coding' to create it.");
      return;
    }

    // Save active document if it matches the solution path
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && activeDoc.fileName === filePath && activeDoc.isDirty) {
      await activeDoc.save();
    }

    const langConfig = getLanguageConfigByExtension(this._activeLanguageExt);
    if (!langConfig) {
      vscode.window.showErrorMessage(`Unsupported language extension: ${this._activeLanguageExt}`);
      return;
    }

    this._isRunningTests = true;
    this._sendState();
    this._view?.webview.postMessage({ type: "running", mode: "sample" });

    try {
      const runResult = await runTests(
        filePath,
        langConfig,
        this._activeChallenge.problem.sample_tests,
        this._activeChallenge.problem.time_limit_ms
      );

      this._view?.webview.postMessage({ type: "testResults", results: runResult });
    } catch (err: any) {
      this._view?.webview.postMessage({ type: "testResultsError", message: err.message });
    } finally {
      this._isRunningTests = false;
      this._sendState();
    }
  }

  private async _handleSubmit() {
    if (!this._activeChallenge || !this._activeLanguageExt) return;

    // Verify time remaining if timer is enabled
    if (this._timerEnabled && this._timerManager.getRemainingTimeMs() <= 0) {
      vscode.window.showErrorMessage("Challenge time has expired! You cannot submit anymore.");
      return;
    }

    // Resolve solution path using new naming
    let filePath = this._activeSolutionPath;
    if (!filePath || !fs.existsSync(filePath)) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        const rootPath = folders[0].uri.fsPath;
        const isJava = this._activeLanguageExt === "java";
        const solutionFileName = isJava
          ? `${pascalCaseTitle(this._activeChallenge.problem.title)}.java`
          : `${slugifyTitle(this._activeChallenge.problem.title)}.${this._activeLanguageExt}`;
        filePath = path.join(rootPath, ".leetcode-city-arena", solutionFileName);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      vscode.window.showErrorMessage("Active solution file not found. Click 'Start Coding' to create it.");
      return;
    }

    // Save active document if it matches the solution path
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && activeDoc.fileName === filePath && activeDoc.isDirty) {
      await activeDoc.save();
    }

    const langConfig = getLanguageConfigByExtension(this._activeLanguageExt);
    if (!langConfig) {
      vscode.window.showErrorMessage(`Unsupported language: ${this._activeLanguageExt}`);
      return;
    }

    this._isSubmitting = true;
    this._sendState();
    this._view?.webview.postMessage({ type: "running", mode: "submit" });

    try {
      // 1. Decrypt hidden tests
      const prob = this._activeChallenge.problem;
      const hiddenTests = decryptHiddenTests(prob.encrypted_hidden_tests, prob.iv);
      if (!hiddenTests || hiddenTests.length === 0) {
        throw new Error("Failed to decrypt hidden test suite. Please check your network.");
      }

      // 2. Run locally against ALL tests
      const runResult = await runTests(
        filePath,
        langConfig,
        hiddenTests,
        prob.time_limit_ms
      );

      // 3. Post results to server
      const code = fs.readFileSync(filePath, "utf8");
      const submitResponse = await submitSolution({
        challenge_id: this._activeChallenge.id,
        problem_id: prob.id,
        language: langConfig.name,
        code,
        status: runResult.status,
        tests_passed: runResult.testsPassed,
        tests_total: runResult.testsTotal,
        execution_time_ms: runResult.executionTimeMs
      });

      // 4. Update timer if fully accepted
      if (runResult.status === "accepted") {
        this._timerManager.clearTimer();
      }

      this._view?.webview.postMessage({ 
        type: "submitResults", 
        results: runResult,
        rewards: submitResponse.rewards,
        isFirstSolve: submitResponse.is_first_solve,
        droppedItems: submitResponse.dropped_items
      });

      if (runResult.status === "accepted") {
        vscode.window.showInformationMessage(`Accepted! You earned ${submitResponse.rewards.points} Points and ${submitResponse.rewards.xp} XP!`);
      } else {
        vscode.window.showWarningMessage(`Submission status: ${runResult.status.toUpperCase()} (${runResult.testsPassed}/${runResult.testsTotal} passed)`);
      }
    } catch (err: any) {
      this._view?.webview.postMessage({ type: "submitError", message: err.message });
    } finally {
      this._isSubmitting = false;
      this._sendState();
    }
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const { apiUrl } = getConfig();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src https://fonts.gstatic.com; style-src 'unsafe-inline' ${webview.cspSource} https://fonts.googleapis.com; img-src ${webview.cspSource} https: http://localhost:* http://127.0.0.1:* data:; script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource};">
  <title>Coding Arena</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Silkscreen&display=swap');

    :root {
      --bg: #0d0d0f;
      --bg-raised: #161618;
      --bg-card: #1c1c20;
      --accent: #ffa116;
      --accent-dim: #cc8111;
      --accent-glow: rgba(255, 161, 22, 0.15);
      --cream: #e8dcc8;
      --warm: #d4cfc4;
      --muted: #8c8c9c;
      --dim: #5c5c6c;
      --border: #2a2a30;
      --border-light: #3a3a44;
      --easy: #39ff14;
      --medium: #ffa116;
      --hard: #ff0055;
      --success: #39ff14;
      --danger: #ff0055;
      --warning: #ffb703;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--warm);
      font-family: 'Silkscreen', monospace;
      font-size: 11px;
      padding: 0;
      overflow-x: hidden;
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-light); }

    /* ── Views ── */
    .view { display: none; padding: 10px; }
    .view.active { display: block; }

    /* ── Header bar ── */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 10px 8px;
      border-bottom: 2px solid var(--accent);
      background: var(--bg-raised);
    }

    .header-title {
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
      flex: 1;
    }

    .header-icon {
      font-size: 14px;
    }

    /* ── Back button ── */
    .back-btn {
      background: none;
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 3px 8px;
      font-family: inherit;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .back-btn:hover {
      background: var(--accent-glow);
    }

    /* ── Section dropdown ── */
    details.section summary::-webkit-details-marker {
      display: none;
    }
    details.section summary {
      list-style: none;
      outline: none;
    }

    .section {
      border: 2px solid var(--accent);
      margin: 8px 0;
      background: var(--bg-raised);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }

    .section-header:hover {
      background: var(--accent-glow);
    }

    .section-title {
      color: var(--accent);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .section-arrow {
      color: var(--accent);
      font-size: 10px;
      transition: transform 0.2s;
    }

    details[open] .section-arrow {
      transform: rotate(90deg);
    }

    .section-body {
      padding: 0 8px 8px;
      border-top: 1px solid var(--border);
    }

    /* ── Challenge card ── */
    .challenge-card {
      border: 2px solid var(--border);
      background: var(--bg-card);
      padding: 10px;
      margin-top: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .challenge-card:hover {
      border-color: var(--accent);
      box-shadow: 0 0 8px var(--accent-glow);
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .difficulty-badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      border: 1px solid;
      font-family: inherit;
    }

    .badge-easy { color: var(--easy); border-color: var(--easy); background: rgba(57, 255, 20, 0.1); }
    .badge-medium { color: var(--medium); border-color: var(--medium); background: rgba(255, 161, 22, 0.1); }
    .badge-hard { color: var(--hard); border-color: var(--hard); background: rgba(255, 0, 85, 0.1); }

    .card-title {
      color: var(--cream);
      font-size: 11px;
      flex: 1;
    }

    .card-rewards {
      display: flex;
      gap: 8px;
      font-size: 9px;
      color: var(--muted);
      margin-top: 4px;
    }

    .card-rewards span {
      color: var(--accent);
    }

    /* ── Detail view ── */
    .detail-section {
      border: 2px solid var(--accent);
      background: var(--bg-raised);
      padding: 10px;
      margin-bottom: 8px;
    }

    .detail-section-title {
      color: var(--accent);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }

    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }

    .meta-item {
      text-align: center;
    }

    .meta-label {
      display: block;
      font-size: 8px;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .meta-value {
      display: block;
      font-size: 11px;
      color: var(--cream);
      font-weight: bold;
    }

    .tag {
      display: inline-block;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--warm);
      font-size: 9px;
      padding: 2px 6px;
      margin: 2px;
      font-family: inherit;
    }

    .description-text {
      color: var(--warm);
      font-size: 11px;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .desc-heading {
      color: #ffa116; /* Warm orange */
      font-size: 12px;
      margin: 14px 0 6px 0;
      border-bottom: 1px solid #333;
      padding-bottom: 4px;
      font-family: inherit;
    }

    .desc-paragraph {
      line-height: 1.6;
      margin-bottom: 10px;
      font-size: 11px;
      color: #dfdfe2;
    }

    .math-expr, .code-inline {
      font-family: "Courier New", monospace;
      background: #222;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 10px;
      color: #ffa116;
    }

    .sample-test {
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 6px 8px;
      margin: 4px 0;
      font-family: "Courier New", monospace;
      font-size: 10px;
      color: var(--cream);
      white-space: pre;
      overflow-x: auto;
    }

    .sample-label {
      color: var(--accent);
      font-size: 9px;
      font-family: inherit;
      margin-bottom: 2px;
    }

    /* ── Buttons ── */
    .btn {
      display: block;
      width: 100%;
      background: var(--accent);
      color: var(--bg);
      border: 2px solid var(--accent-dim);
      padding: 7px 10px;
      font-family: inherit;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
      letter-spacing: 1px;
      margin-top: 6px;
    }

    .btn:hover {
      background: var(--accent-dim);
      color: var(--cream);
    }

    .btn:disabled {
      background: var(--border);
      color: var(--dim);
      border-color: var(--border);
      cursor: not-allowed;
    }

    .btn-secondary {
      background: transparent;
      border: 2px solid var(--accent);
      color: var(--accent);
    }

    .btn-secondary:hover {
      background: var(--accent-glow);
    }

    .btn-submit {
      background: var(--warning);
      border-color: #cc9200;
      color: var(--bg);
    }

    .btn-submit:hover {
      background: #cc9200;
    }

    .btn-row {
      display: flex;
      gap: 6px;
    }

    .btn-row .btn { flex: 1; }

    /* ── Timer ── */
    .timer {
      text-align: center;
      font-family: "Courier New", monospace;
      font-size: 14px;
      font-weight: bold;
      padding: 6px;
      border: 1px dashed var(--accent);
      background: rgba(0,0,0,0.3);
      color: var(--cream);
      margin: 6px 0;
    }

    .timer-critical {
      color: var(--danger);
      animation: blink 1s infinite alternate;
    }

    @keyframes blink {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    /* ── Select ── */
    select {
      background: var(--bg-card);
      color: var(--cream);
      border: 2px solid var(--accent);
      padding: 5px 8px;
      font-family: inherit;
      font-size: 10px;
      width: 100%;
      margin-bottom: 6px;
      cursor: pointer;
    }

    /* ── Status area ── */
    .status-area {
      margin-top: 8px;
      padding: 8px;
      background: #000;
      border: 1px solid var(--border);
      font-family: "Courier New", monospace;
      font-size: 10px;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    .status-accepted { color: var(--success); }
    .status-wrong_answer { color: var(--danger); }
    .status-tle { color: var(--warning); }
    .status-rte { color: #f28b82; }

    /* ── Rewards ── */
    .rewards-alert {
      background: rgba(57, 255, 20, 0.1);
      border: 2px solid var(--success);
      padding: 8px;
      margin-top: 8px;
      text-align: center;
    }

    .items-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      margin-top: 6px;
    }

    .item-icon {
      width: 32px; height: 32px;
      background: var(--bg);
      border: 1px solid var(--accent);
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }

    .item-icon img { width: 28px; height: 28px; image-rendering: pixelated; }

    .item-tooltip {
      visibility: hidden;
      background: #000;
      color: #fff;
      text-align: center;
      padding: 3px 6px;
      position: absolute;
      z-index: 1;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      font-size: 8px;
      white-space: nowrap;
    }

    .item-icon:hover .item-tooltip { visibility: visible; }

    /* ── Loading ── */
    .loading {
      text-align: center;
      padding: 20px;
      color: var(--accent);
      font-size: 11px;
    }

    @keyframes dot-blink {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }

    .loading-dots span {
      animation: dot-blink 1.4s infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }

    /* ── Nav arrows ── */
    .nav-arrows {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-top: 1px solid var(--border);
      margin-top: 8px;
    }

    .nav-arrow-btn {
      background: none;
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 4px 12px;
      font-family: inherit;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .nav-arrow-btn:hover { background: var(--accent-glow); }
    .nav-arrow-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 16px 8px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.5;
    }

    .empty-state a {
      color: var(--accent);
      text-decoration: none;
    }

    /* ── Connected user ── */
    .footer {
      border-top: 2px solid var(--accent);
      padding: 8px 10px;
      font-size: 9px;
      color: var(--muted);
      background: var(--bg-raised);
      text-align: center;
      margin-top: 8px;
    }
  </style>
</head>
<body>

  <!-- ═══════════ HEADER ═══════════ -->
  <div class="header">
    <button id="nav-back-btn" class="back-btn" style="display:none;">&#9664; Back</button>
    <span class="header-title" id="header-title">Coding Arena</span>
    <span class="header-icon">&#9876;</span>
  </div>

  <!-- ═══════════ HOME VIEW ═══════════ -->
  <div id="view-home" class="view active">

    <!-- Daily Challenges Section -->
    <details class="section" id="section-daily" open>
      <summary class="section-header" id="header-daily">
        <span class="section-title">&#9876; Daily Challenges</span>
        <span class="section-arrow" id="arrow-daily">&#9654;</span>
      </summary>
      <div class="section-body" id="body-daily">
        <div id="daily-content">
          <div class="loading">Loading<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>
        </div>
      </div>
    </details>

    <!-- Active Quests Section -->
    <details class="section" id="section-quests">
      <summary class="section-header" id="header-quests">
        <span class="section-title">&#128220; Active Quests</span>
        <span class="section-arrow" id="arrow-quests">&#9654;</span>
      </summary>
      <div class="section-body" id="body-quests">
        <div class="empty-state">
          Visit the website to select a quest.<br/>
          Active quests will appear here.
        </div>
      </div>
    </details>

    <!-- Dungeons Section -->
    <details class="section" id="section-dungeons">
      <summary class="section-header" id="header-dungeons">
        <span class="section-title">&#127984; Dungeons</span>
        <span class="section-arrow" id="arrow-dungeons">&#9654;</span>
      </summary>
      <div class="section-body" id="body-dungeons">
        <div class="empty-state">
          Visit the website to enter a dungeon.<br/>
          Active dungeons will appear here.
        </div>
      </div>
    </details>

    <!-- Stats Section -->
    <details class="section" id="section-stats">
      <summary class="section-header" id="header-stats">
        <span class="section-title">&#128202; Stats & Leaderboard</span>
        <span class="section-arrow" id="arrow-stats">&#9654;</span>
      </summary>
      <div class="section-body" id="body-stats">
        <div class="empty-state">
          Solve challenges to track your rating and streak.
        </div>
      </div>
    </details>

  </div>

  <!-- ═══════════ DETAIL VIEW ═══════════ -->
  <div id="view-detail" class="view">

    <!-- Problem header -->
    <div class="detail-section">
      <div class="card-top">
        <span id="detail-badge" class="difficulty-badge badge-easy">EASY</span>
        <span id="detail-title" class="card-title" style="font-size:12px;">Problem Title</span>
      </div>
      <div class="detail-meta" id="detail-meta"></div>
      <div id="detail-tags"></div>
    </div>

    <!-- Description -->
    <div class="detail-section">
      <div class="detail-section-title">Description</div>
      <div id="detail-description" class="description-text"></div>
    </div>

    <!-- Sample Tests -->
    <div class="detail-section">
      <div class="detail-section-title">Sample Tests</div>
      <div id="detail-samples"></div>
    </div>

    <!-- Language + Start Coding -->
    <div class="detail-section">
      <div class="detail-section-title">Choose Language</div>
      <select id="lang-select"></select>
      <button id="btn-start-coding" class="btn">&#9654; Start Coding</button>
    </div>

    <!-- Timer -->
    <div class="detail-section">
      <div class="detail-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Timer</span>
        <label style="font-size: 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-family: inherit; text-transform: uppercase;">
          <input type="checkbox" id="timer-toggle" checked style="cursor:pointer; margin:0; width:10px; height:10px;" />
          <span id="timer-toggle-label">Active</span>
        </label>
      </div>
      <div class="timer" id="timer">-- : --</div>
    </div>

    <!-- Execution -->
    <div class="detail-section">
      <div class="detail-section-title">Execution</div>
      <div class="btn-row">
        <button id="btn-run" class="btn btn-secondary">&#9654; Run Samples</button>
        <button id="btn-submit" class="btn btn-submit">&#11014; Submit</button>
      </div>
      <div id="status-display" class="status-area" style="display:none;"></div>
      <div id="rewards-display" class="rewards-alert" style="display:none;">
        <div style="color:var(--success);font-weight:bold;margin-bottom:4px;">Challenge Solved!</div>
        <div id="rewards-text" style="font-size:10px;"></div>
        <div id="drops-display" class="items-grid"></div>
      </div>
    </div>

    <!-- Nav arrows -->
    <div class="nav-arrows">
      <button class="nav-arrow-btn" id="nav-prev">&#9664; Prev</button>
      <button class="nav-arrow-btn" id="nav-next">Next &#9654;</button>
    </div>

  </div>

  <script>
    try {
    var vscode = acquireVsCodeApi();

    // ── State ──
    let currentView = 'home';
    let navigationStack = ['home'];
    let dailyChallenges = [];
    let currentChallenge = null;
    let currentChallengeIndex = -1;
    let availableLanguages = [];
    let selectedLanguage = 'py';
    let timerEnabled = true;

    // ── Init ──
    vscode.postMessage({ type: "requestState" });

    // ── Event Listeners ──
    const addListener = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    addListener('nav-back-btn', 'click', goBack);
    
    addListener('lang-select', 'change', changeLanguage);
    addListener('btn-start-coding', 'click', startCoding);
    
    addListener('timer-toggle', 'change', toggleTimer);
    
    addListener('btn-run', 'click', runSample);
    addListener('btn-submit', 'click', submitSolution);
    
    addListener('nav-prev', 'click', navPrev);
    addListener('nav-next', 'click', navNext);

    // Set up toggle event listener for daily challenges
    const dailySection = document.getElementById('section-daily');
    if (dailySection) {
      dailySection.addEventListener('toggle', () => {
        if (dailySection.open && dailyChallenges.length === 0) {
          vscode.postMessage({ type: "fetchDailyChallenges" });
        }
      });
    }

    // ── View management ──
    function showView(viewName) {
      currentView = viewName;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + viewName).classList.add('active');

      const backBtn = document.getElementById('nav-back-btn');
      const title = document.getElementById('header-title');

      if (viewName === 'home') {
        backBtn.style.display = 'none';
        title.textContent = 'Coding Arena';
      } else {
        backBtn.style.display = '';
        title.textContent = currentChallenge ? currentChallenge.problem.title : 'Challenge';
      }
    }

    function navigateTo(viewName) {
      navigationStack.push(viewName);
      showView(viewName);
    }

    function goBack() {
      if (navigationStack.length > 1) {
        navigationStack.pop();
        const prev = navigationStack[navigationStack.length - 1];
        showView(prev);
      }
    }

    // Open daily section by default
    if (dailySection && dailySection.open && dailyChallenges.length === 0) {
      vscode.postMessage({ type: "fetchDailyChallenges" });
    }

    // ── Render daily challenge cards ──
    function renderDailyCards(challenges) {
      dailyChallenges = challenges;
      const container = document.getElementById('daily-content');

      if (!challenges || challenges.length === 0) {
        container.innerHTML = '<div class="empty-state">No daily challenges available today.</div>';
        return;
      }

      const solvedCount = challenges.filter(ch => ch.status === 'accepted').length;
      const totalCount = challenges.length;
      const progressPercent = totalCount > 0 ? (solvedCount / totalCount) * 100 : 0;

      let progressHtml = '';
      if (totalCount > 0) {
        progressHtml = 
          '<div style="margin-bottom:12px; border:1px solid var(--border); background:rgba(0,0,0,0.2); padding:6px 8px;">' +
            '<div style="display:flex; justify-content:space-between; font-size:8px; font-weight:bold; color:var(--cream); margin-bottom:4px;">' +
              '<span>DAILY PROGRESS</span>' +
              '<span style="color:' + (solvedCount === totalCount ? '#39ff14' : 'var(--accent)') + ';">' + solvedCount + '/' + totalCount + ' SOLVED</span>' +
            '</div>' +
            '<div style="width:100%; background:var(--bg); border:1px solid var(--border); height:6px; padding:1px; box-sizing:border-box;">' +
              '<div style="height:100%; width:' + progressPercent + '%; background-color:' + (solvedCount === totalCount ? '#39ff14' : 'var(--accent)') + '; transition:width 0.3s;"></div>' +
            '</div>' +
          '</div>';
      }

      container.innerHTML = progressHtml;
      challenges.forEach((ch, idx) => {
        const card = document.createElement('div');
        card.className = 'challenge-card';
        card.addEventListener('click', () => openChallenge(ch.id, idx));
        
        const solvedBadge = ch.status === 'accepted'
          ? '<span class="difficulty-badge" style="color:#39ff14; border-color:#39ff14; background:rgba(57,255,20,0.1); margin-left:6px;">✓ SOLVED</span>'
          : '';

        card.innerHTML =
          '<div class="card-top">' +
            '<span class="difficulty-badge badge-' + ch.difficulty + '">' + ch.difficulty + '</span>' +
            solvedBadge +
            '<span class="card-title">' + ch.title + '</span>' +
          '</div>' +
          '<div class="card-rewards">' +
            '<span>+' + ch.reward_points + ' Pts</span>' +
            '<span>+' + ch.reward_xp + ' XP</span>' +
          '</div>';
        container.appendChild(card);
      });
    }

    function openChallenge(challengeId, index) {
      currentChallengeIndex = index;
      vscode.postMessage({ type: "loadChallenge", challengeId: challengeId });
    }

    // ── Render detail view ──
    function renderDetail(state) {
      const c = state.challenge;
      if (!c) return;

      currentChallenge = c;

      // Badge
      const badge = document.getElementById('detail-badge');
      badge.textContent = c.difficulty.toUpperCase();
      badge.className = 'difficulty-badge badge-' + c.difficulty;

      // Title
      document.getElementById('detail-title').textContent = c.problem.title;

      // Meta
      const meta = document.getElementById('detail-meta');
      meta.innerHTML =
        '<div class="meta-item"><span class="meta-label">CF Rating</span><span class="meta-value">' + (c.problem.difficulty_rating || '--') + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">Time</span><span class="meta-value">' + c.problem.time_limit_ms + 'ms</span></div>' +
        '<div class="meta-item"><span class="meta-label">Memory</span><span class="meta-value">' + c.problem.memory_limit_mb + 'MB</span></div>' +
        '<div class="meta-item"><span class="meta-label">Points</span><span class="meta-value" style="color:var(--accent)">+' + c.reward_points + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">XP</span><span class="meta-value" style="color:var(--accent)">+' + c.reward_xp + '</span></div>';

      // Tags
      const tags = document.getElementById('detail-tags');
      tags.innerHTML = '';
      if (c.problem.tags) {
        c.problem.tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = t;
          tags.appendChild(span);
        });
      }

      // Description
      document.getElementById('detail-description').innerHTML = formatMarkdown(c.problem.description || 'No description available.');

      // Sample tests
      const samples = document.getElementById('detail-samples');
      samples.innerHTML = '';
      if (c.problem.sample_tests && c.problem.sample_tests.length > 0) {
        c.problem.sample_tests.slice(0, 3).forEach((t, i) => {
          const div = document.createElement('div');
          div.style.marginBottom = '8px';
          div.innerHTML =
            '<div class="sample-label">Test ' + (i + 1) + '</div>' +
            '<div class="sample-test"><strong style="color:var(--muted)">Input:</strong>\\n' + escapeHtml(t.input) + '</div>' +
            '<div class="sample-test"><strong style="color:var(--muted)">Output:</strong>\\n' + escapeHtml(t.output) + '</div>';
          samples.appendChild(div);
        });
      } else {
        samples.innerHTML = '<div class="empty-state">No sample tests available.</div>';
      }

      // Language select
      const select = document.getElementById('lang-select');
      select.innerHTML = '';
      availableLanguages = state.availableLanguages || [];
      availableLanguages.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.extension;
        opt.textContent = lang.name;
        if (lang.extension === state.selectedLanguage) opt.selected = true;
        select.appendChild(opt);
      });
      selectedLanguage = state.selectedLanguage || 'py';

      // Timer toggle checkbox state
      timerEnabled = state.timerEnabled !== false;
      const toggle = document.getElementById('timer-toggle');
      if (toggle) {
        toggle.checked = timerEnabled;
      }
      const toggleLabel = document.getElementById('timer-toggle-label');
      if (toggleLabel) {
        toggleLabel.textContent = timerEnabled ? 'Active' : 'Inactive';
      }
      const timerDiv = document.getElementById('timer');
      if (!timerEnabled) {
        timerDiv.textContent = 'DISABLED';
        timerDiv.classList.remove('timer-critical');
      } else {
        updateTimer(state.timeLeftMs);
      }

      // Run/Submit buttons
      document.getElementById('btn-run').disabled = state.isRunningTests || state.isSubmitting;
      document.getElementById('btn-submit').disabled = state.isRunningTests || state.isSubmitting || !state.timerActive;

      // Find index in daily list if loaded via direct link
      const foundIndex = dailyChallenges.findIndex(ch => ch.id === c.id);
      if (foundIndex !== -1) {
        currentChallengeIndex = foundIndex;
      } else {
        currentChallengeIndex = -1;
      }

      // Nav arrows
      const hasPrev = currentChallengeIndex > 0;
      const hasNext = currentChallengeIndex !== -1 && currentChallengeIndex < dailyChallenges.length - 1;
      document.getElementById('nav-prev').disabled = !hasPrev;
      document.getElementById('nav-next').disabled = !hasNext;
    }

    function toggleTimer() {
      const toggle = document.getElementById('timer-toggle');
      timerEnabled = toggle.checked;
      const toggleLabel = document.getElementById('timer-toggle-label');
      if (toggleLabel) {
        toggleLabel.textContent = timerEnabled ? 'Active' : 'Inactive';
      }
      vscode.postMessage({ type: "toggleTimer", enabled: timerEnabled });
      
      const timerDiv = document.getElementById('timer');
      if (!timerEnabled) {
        timerDiv.textContent = 'DISABLED';
        timerDiv.classList.remove('timer-critical');
        vscode.postMessage({ type: "requestState" });
      } else {
        vscode.postMessage({ type: "requestState" });
      }
    }

    function formatMarkdown(text) {
      if (!text) return '';
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      html = html.replace(/^### (.*?)$/gm, '<h3 class="desc-heading">$1</h3>');
      html = html.replace(/^## (.*?)$/gm, '<h2 class="desc-heading">$1</h2>');
      html = html.replace(/^# (.*?)$/gm, '<h1 class="desc-heading">$1</h1>');
      
      html = html.replace(/\\\\le/gi, '≤')
                 .replace(/\\\\ge/gi, '≥')
                 .replace(/\\\\ne/gi, '≠')
                 .replace(/\\\\lt/gi, '&lt;')
                 .replace(/\\\\gt/gi, '&gt;');
                 
      html = html.replace(/\\$(.*?)\\$/g, '<code class="math-expr">$1</code>');
      html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      html = html.split(String.fromCharCode(96)).map((part, idx) => idx % 2 === 1 ? '<code class="code-inline">' + part + '</code>' : part).join('');

      const paragraphs = html.split(/\\n\\n+/);
      html = paragraphs.map(p => {
        p = p.trim();
        if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<li')) return p;
        return '<p class="desc-paragraph">' + p.replace(/\\n/g, '<br/>') + '</p>';
      }).join('\\n');

      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ── Actions ──
    function startCoding() {
      const select = document.getElementById('lang-select');
      vscode.postMessage({ type: "startCoding", ext: select.value });
    }

    function changeLanguage() {
      const select = document.getElementById('lang-select');
      selectedLanguage = select.value;
      vscode.postMessage({ type: "selectLanguage", ext: select.value });
    }

    function runSample() {
      vscode.postMessage({ type: "runSample" });
    }

    function submitSolution() {
      vscode.postMessage({ type: "submit" });
    }

    function navPrev() {
      if (currentChallengeIndex > 0) {
        currentChallengeIndex--;
        openChallenge(dailyChallenges[currentChallengeIndex].id, currentChallengeIndex);
      }
    }

    function navNext() {
      if (currentChallengeIndex < dailyChallenges.length - 1) {
        currentChallengeIndex++;
        openChallenge(dailyChallenges[currentChallengeIndex].id, currentChallengeIndex);
      }
    }

    // ── Timer ──
    function updateTimer(timeLeftMs) {
      const timerDiv = document.getElementById('timer');
      if (timeLeftMs <= 0) {
        timerDiv.textContent = 'EXPIRED';
        timerDiv.classList.add('timer-critical');
        document.getElementById('btn-submit').disabled = true;
        return;
      }
      timerDiv.classList.remove('timer-critical');
      const totalSec = Math.floor(timeLeftMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      timerDiv.textContent = (h > 0 ? String(h).padStart(2,'0') + ':' : '') +
        String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      if (totalSec < 300) timerDiv.classList.add('timer-critical');
    }

    // ── Status rendering ──
    function showRunning(mode) {
      const statusDiv = document.getElementById('status-display');
      statusDiv.style.display = 'block';
      statusDiv.className = 'status-area';
      statusDiv.textContent = mode === 'submit'
        ? 'Submitting and running against final test cases...'
        : 'Compiling and running sample test cases...';
      document.getElementById('btn-run').disabled = true;
      document.getElementById('btn-submit').disabled = true;
    }

    function renderTestResults(res, isSubmit, rewards, isFirstSolve, droppedItems) {
      const statusDiv = document.getElementById('status-display');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '';

      const title = document.createElement('div');
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '6px';

      if (res.status === 'accepted') {
        title.textContent = (isSubmit ? 'ACCEPTED' : 'SAMPLE TESTS PASSED');
        title.className = 'status-accepted';
      } else {
        title.textContent = res.status.toUpperCase() + ' (' + res.testsPassed + '/' + res.testsTotal + ' passed)';
        title.className = 'status-' + res.status;
      }
      statusDiv.appendChild(title);

      if (res.details) {
        const details = document.createElement('div');
        details.style.color = '#f28b82';
        details.textContent = res.details;
        statusDiv.appendChild(details);
      }

      if (res.testCaseResults && res.testCaseResults.length > 0) {
        res.testCaseResults.forEach(tc => {
          const tcDiv = document.createElement('div');
          tcDiv.style.borderTop = '1px solid #333';
          tcDiv.style.paddingTop = '4px';
          tcDiv.style.marginTop = '4px';

          const lbl = document.createElement('span');
          lbl.textContent = 'Test #' + tc.index + '  ';
          lbl.style.fontWeight = 'bold';
          tcDiv.appendChild(lbl);

          const st = document.createElement('span');
          st.textContent = tc.status.toUpperCase() + ' (' + tc.timeMs + 'ms)';
          st.className = 'status-' + tc.status;
          tcDiv.appendChild(st);

          if (tc.errorMessage) {
            const err = document.createElement('div');
            err.style.color = '#f28b82';
            err.textContent = tc.errorMessage;
            tcDiv.appendChild(err);
          } else if (!tc.passed) {
            const io = document.createElement('div');
            io.style.color = '#ccc';
            io.textContent = 'Expected:\\n' + tc.expectedOutput + '\\nActual:\\n' + tc.actualOutput;
            tcDiv.appendChild(io);
          }
          statusDiv.appendChild(tcDiv);
        });
      }

      // Rewards
      const rewardsDiv = document.getElementById('rewards-display');
      if (isSubmit && res.status === 'accepted' && rewards) {
        rewardsDiv.style.display = 'block';
        document.getElementById('rewards-text').textContent = isFirstSolve
          ? 'Earned: +' + rewards.points + ' Points | +' + rewards.xp + ' XP'
          : 'Already solved! No duplicate rewards.';

        const dropsDiv = document.getElementById('drops-display');
        dropsDiv.innerHTML = '';
        if (droppedItems && droppedItems.length > 0) {
          droppedItems.forEach(item => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'item-icon';
            const img = document.createElement('img');
            img.style.display = 'none';
            img.onload = () => {
              img.style.display = '';
            };
            img.onerror = () => {
              img.onerror = null;
              img.onload = () => {
                img.style.display = '';
              };
              img.onerror = () => {
                img.onerror = null;
                img.style.display = 'none';
              };
              img.src = 'https://the-leetcode-city.vercel.app' + item.icon_path;
            };
            img.src = '${apiUrl}' + item.icon_path;
            const tooltip = document.createElement('span');
            tooltip.className = 'item-tooltip';
            tooltip.textContent = item.name + ' (' + item.rarity + ')';
            iconDiv.appendChild(img);
            iconDiv.appendChild(tooltip);
            dropsDiv.appendChild(iconDiv);
          });
        }
      } else {
        rewardsDiv.style.display = 'none';
      }

      vscode.postMessage({ type: "requestState" });
    }

    function renderError(message) {
      const statusDiv = document.getElementById('status-display');
      statusDiv.style.display = 'block';
      statusDiv.className = 'status-area';
      statusDiv.textContent = 'Error: ' + message;
      vscode.postMessage({ type: "requestState" });
    }

    // ── Message handler ──
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'dailyLoading':
          document.getElementById('daily-content').innerHTML =
            '<div class="loading">Loading<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>';
          break;
        case 'dailyChallenges':
          renderDailyCards(msg.challenges);
          break;
        case 'dailyError':
          document.getElementById('daily-content').innerHTML =
            '<div class="empty-state" style="color:var(--danger)">Failed to load: ' + escapeHtml(msg.message) + '<br/><br/>' +
            '<button class="btn btn-secondary" style="width:auto;display:inline-block;padding:4px 12px;" onclick="vscode.postMessage({type:\\'fetchDailyChallenges\\'})">Retry</button></div>';
          break;
        case 'loading':
          // Show a loading state — will transition to detail on "state" or "navigateToDetail"
          break;
        case 'navigateToDetail':
          navigateTo('detail');
          break;
        case 'state':
          if (msg.challenge) {
            renderDetail(msg);
            if (currentView === 'detail') {
              document.getElementById('header-title').textContent = msg.challenge.problem.title;
            }
          }
          break;
        case 'timerTick':
          updateTimer(msg.timeLeftMs);
          break;
        case 'running':
          showRunning(msg.mode);
          break;
        case 'testResults':
          renderTestResults(msg.results, false);
          break;
        case 'testResultsError':
          renderError(msg.message);
          break;
        case 'submitResults':
          renderTestResults(msg.results, true, msg.rewards, msg.isFirstSolve, msg.droppedItems);
          break;
        case 'submitError':
          renderError(msg.message);
          break;
        case 'error':
          renderError(msg.message);
          break;
      }
    });

    } catch(e) {
      console.error('JS error:', e);
    }
  </script>
</body>
</html>
`;
  }
}

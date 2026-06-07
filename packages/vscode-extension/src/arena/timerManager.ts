import * as vscode from "vscode";

const BASE_LIMITS: Record<string, number> = {
  easy: 15 * 60 * 1000,    // 15 minutes
  medium: 30 * 60 * 1000,  // 30 minutes
  hard: 60 * 60 * 1000,    // 60 minutes
};

export interface TimerState {
  challengeId: string;
  difficulty: string;
  startTime: number;
  durationMs: number;
}

export class TimerManager {
  private static readonly STORAGE_KEY = "leetcodecity.arenaTimerState";
  private context: vscode.ExtensionContext;
  private intervalId?: NodeJS.Timeout;
  private onTickCallback?: (timeLeftMs: number) => void;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public startTimer(
    challengeId: string,
    difficulty: string,
    onTick: (timeLeftMs: number) => void
  ): TimerState {
    this.stopTimer();

    const durationMs = BASE_LIMITS[difficulty] || 30 * 60 * 1000;
    const state: TimerState = {
      challengeId,
      difficulty,
      startTime: Date.now(),
      durationMs,
    };

    this.context.workspaceState.update(TimerManager.STORAGE_KEY, state);
    this.onTickCallback = onTick;
    this.runInterval(state);

    return state;
  }

  public getActiveTimer(): TimerState | undefined {
    return this.context.workspaceState.get<TimerState>(TimerManager.STORAGE_KEY);
  }

  public clearTimer(): void {
    this.stopTimer();
    this.context.workspaceState.update(TimerManager.STORAGE_KEY, undefined);
  }

  public getRemainingTimeMs(): number {
    const state = this.getActiveTimer();
    if (!state) return 0;
    
    const elapsed = Date.now() - state.startTime;
    const remaining = state.durationMs - elapsed;
    return Math.max(0, remaining);
  }

  public resumeTimerIfActive(onTick: (timeLeftMs: number) => void): boolean {
    const state = this.getActiveTimer();
    if (!state) return false;

    const remaining = this.getRemainingTimeMs();
    if (remaining <= 0) {
      this.clearTimer();
      return false;
    }

    this.onTickCallback = onTick;
    this.runInterval(state);
    return true;
  }

  private runInterval(state: TimerState): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Initial tick
    if (this.onTickCallback) {
      this.onTickCallback(this.getRemainingTimeMs());
    }

    this.intervalId = setInterval(() => {
      const remaining = this.getRemainingTimeMs();
      if (remaining <= 0) {
        this.clearTimer();
        if (this.onTickCallback) {
          this.onTickCallback(0);
        }
      } else {
        if (this.onTickCallback) {
          this.onTickCallback(remaining);
        }
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.onTickCallback = undefined;
  }
}

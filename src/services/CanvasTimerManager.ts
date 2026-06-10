// ✅ Production-Optimized Paths and Core Matrix Import Structures
import { supabase } from "@/lib/supabase"; 

export class CanvasTimerManager {
  private activeIntervals: Set<NodeJS.Timeout> = new Set();
  private abortController: AbortController | null = null;

  constructor() {
    this.abortController = new AbortController();
  }

  /**
   * Registers a safe, cancelable interval loop that hooks directly into the abort signal matrix.
   */
  public registerHeartbeat(callback: () => void, intervalMs: number): void {
    if (this.abortController?.signal.aborted) return;

    const intervalId = setInterval(() => {
      if (this.abortController?.signal.aborted) {
        this.clearIntervalLoop(intervalId);
        return;
      }
      callback();
    }, intervalMs);

    this.activeIntervals.add(intervalId);
  }

  /**
   * 🛑 Strict Unmount Lifecycle Handler: Flushes every active interval and aborts active streams.
   */
  public dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
    }

    this.activeIntervals.forEach((intervalId) => {
      this.clearIntervalLoop(intervalId);
    });

    this.activeIntervals.clear();
  }

  public getActiveCount(): number {
    return this.activeIntervals.size;
  }

  private clearIntervalLoop(id: NodeJS.Timeout): void {
    clearInterval(id);
    this.activeIntervals.delete(id);
  }
}

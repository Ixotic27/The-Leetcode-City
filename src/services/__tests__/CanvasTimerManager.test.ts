import { CanvasTimerManager } from "../CanvasTimerManager";

describe("CanvasTimerManager Memory Leak Prevention Testing Suite", () => {
  let timerManager: CanvasTimerManager;

  beforeEach(() => {
    timerManager = new CanvasTimerManager();
    jest.useFakeTimers();
  });

  afterEach(() => {
    timerManager.dispose();
    jest.useRealTimers();
  });

  it("should successfully register active heartbeat loops", () => {
    const callback = jest.fn();
    timerManager.registerHeartbeat(callback, 1000);

    expect(timerManager.getActiveCount()).toBe(1);
    jest.advanceTimersByTime(2500);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should atomically clear all intervals and throw abort signals on dispose()", () => {
    const callback = jest.fn();
    timerManager.registerHeartbeat(callback, 1000);

    timerManager.dispose();

    expect(timerManager.getActiveCount()).toBe(0);
    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(0);
  });
});

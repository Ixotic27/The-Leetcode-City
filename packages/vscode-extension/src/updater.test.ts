import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  compareSemver,
  fetchWithTimeout,
  fetchWithRetry,
  downloadFile,
  checkForUpdates,
} from "./updater";

// Mock vscode module
vi.mock("vscode", () => {
  return {
    extensions: {
      getExtension: vi.fn(),
    },
    window: {
      withProgress: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
    ProgressLocation: {
      Notification: 15,
    },
    Uri: {
      file: (p: string) => ({ fsPath: p }),
    },
  };
});

import * as vscode from "vscode";

describe("updater.ts", () => {
  const originalFetch = (globalThis as any).fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("compareSemver", () => {
    it("correctly compares version numbers", () => {
      expect(compareSemver("0.2.4", "0.2.3")).toBe(1);
      expect(compareSemver("0.2.3", "0.2.3")).toBe(0);
      expect(compareSemver("0.2.2", "0.2.3")).toBe(-1);
      expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
      expect(compareSemver("0.2.3", "1.0.0")).toBe(-1);
    });
  });

  describe("fetchWithTimeout", () => {
    it("resolves when fetch succeeds within timeout", async () => {
      const mockRes = { ok: true, status: 200 };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(mockRes);

      const res = await fetchWithTimeout("https://example.com/test", {}, 1000);
      expect(res).toBe(mockRes);
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
    });

    it("propagates caller signal abort to controller signal", async () => {
      const callerController = new AbortController();
      (globalThis as any).fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new Error("Aborted by signal"));
          });
        });
      });

      const fetchPromise = fetchWithTimeout(
        "https://example.com/test",
        { signal: callerController.signal },
        5000
      );

      callerController.abort();

      await expect(fetchPromise).rejects.toThrow("Aborted by signal");
    });
  });

  describe("fetchWithRetry", () => {
    it("succeeds on first attempt", async () => {
      const mockRes = { ok: true, status: 200 };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(mockRes);

      const res = await fetchWithRetry("https://example.com/test", {}, 1000, 2, 0);
      expect(res).toBe(mockRes);
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds eventually", async () => {
      const failRes = { ok: false, status: 500, statusText: "Internal Error" };
      const successRes = { ok: true, status: 200 };
      (globalThis as any).fetch = vi
        .fn()
        .mockResolvedValueOnce(failRes)
        .mockResolvedValueOnce(successRes);

      const res = await fetchWithRetry("https://example.com/test", {}, 1000, 2, 0);
      expect(res).toBe(successRes);
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(2);
    });

    it("throws error after exhausting retries", async () => {
      const failRes = { ok: false, status: 404, statusText: "Not Found" };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(failRes);

      await expect(
        fetchWithRetry("https://example.com/test", {}, 1000, 2, 0)
      ).rejects.toThrow("HTTP 404 Not Found");
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("downloadFile", () => {
    it("throws error if downloaded file buffer is empty", async () => {
      const emptyRes = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(emptyRes);

      const tmpFile = path.join(os.tmpdir(), "test_empty.vsix");
      await expect(downloadFile("https://example.com/empty.vsix", tmpFile, 0)).rejects.toThrow(
        "Downloaded file is empty"
      );
    });

    it("downloads and writes file successfully", async () => {
      const bufferContent = new TextEncoder().encode("vsix-mock-content").buffer;
      const successRes = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(bufferContent),
      };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(successRes);

      const tmpFile = path.join(os.tmpdir(), "test_success.vsix");
      await downloadFile("https://example.com/valid.vsix", tmpFile, 0);

      expect(fs.existsSync(tmpFile)).toBe(true);
      const readData = fs.readFileSync(tmpFile, "utf-8");
      expect(readData).toBe("vsix-mock-content");

      // Cleanup
      fs.unlinkSync(tmpFile);
    });
  });

  describe("checkForUpdates", () => {
    let mockContext: any;
    let globalStateStore: Record<string, any>;

    beforeEach(() => {
      globalStateStore = {};
      mockContext = {
        globalState: {
          get: vi.fn((key: string, defaultValue: any) => globalStateStore[key] ?? defaultValue),
          update: vi.fn((key: string, value: any) => {
            globalStateStore[key] = value;
            return Promise.resolve();
          }),
        },
      };
    });

    it("skips check if debounced (within 6 hours)", async () => {
      const recentTime = Date.now() - 1000;
      globalStateStore["leetcodecity.lastUpdateCheck"] = recentTime;

      (globalThis as any).fetch = vi.fn();

      await checkForUpdates(mockContext);
      expect((globalThis as any).fetch).not.toHaveBeenCalled();
    });

    it("logs warning and aborts cleanly when fetch throws an error", async () => {
      vi.useFakeTimers();
      (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error("Network disconnect"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        const updatePromise = checkForUpdates(mockContext);
        await vi.runAllTimersAsync();
        await updatePromise;
      } finally {
        vi.useRealTimers();
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LeetCode City Updater] Check for updates failed: Network disconnect")
      );
      expect(mockContext.globalState.update).not.toHaveBeenCalled();
    });

    it("updates lastCheck timestamp when local version is up-to-date", async () => {
      const mockPackageJsonRes = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ version: "0.2.3" })),
      };
      (globalThis as any).fetch = vi.fn().mockResolvedValue(mockPackageJsonRes);

      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: "0.2.3" },
      } as any);

      await checkForUpdates(mockContext);

      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        "leetcodecity.lastUpdateCheck",
        expect.any(Number)
      );
    });

    it("shows warning message when update download/install fails", async () => {
      vi.useFakeTimers();
      const mockPackageJsonRes = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ version: "0.3.0" })),
      };
      const failVsixRes = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      (globalThis as any).fetch = vi
        .fn()
        .mockResolvedValueOnce(mockPackageJsonRes)
        .mockResolvedValue(failVsixRes);

      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: "0.2.3" },
      } as any);

      vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
        return task({ report: vi.fn() } as any);
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        const updatePromise = checkForUpdates(mockContext);
        await vi.runAllTimersAsync();
        await updatePromise;
      } finally {
        vi.useRealTimers();
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LeetCode City Updater] Extension update failed")
      );
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("LeetCode City: Pulse update failed:")
      );
      expect(globalStateStore["leetcodecity.lastUpdateCheck"]).toBeUndefined();
    });

    it("installs vsix and updates timestamp on success", async () => {
      const mockPackageJsonRes = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ version: "0.3.0" })),
      };
      const bufferContent = new TextEncoder().encode("fake-vsix").buffer;
      const mockVsixRes = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(bufferContent),
      };

      (globalThis as any).fetch = vi
        .fn()
        .mockResolvedValueOnce(mockPackageJsonRes)
        .mockResolvedValueOnce(mockVsixRes);

      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        packageJSON: { version: "0.2.3" },
      } as any);

      vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) => {
        return task({ report: vi.fn() } as any);
      });

      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue("Reload Now" as any);

      await checkForUpdates(mockContext);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "workbench.extensions.installExtension",
        expect.anything()
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "workbench.action.reloadWindow"
      );
      expect(globalStateStore["leetcodecity.lastUpdateCheck"]).toBeGreaterThan(0);
    });
  });
});

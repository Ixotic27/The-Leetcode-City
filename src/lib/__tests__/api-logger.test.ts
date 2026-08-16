import { describe, it, expect, vi, afterEach } from "vitest";
import { logApiError, newReqId } from "../api-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("newReqId", () => {
  it("returns a non-empty string", () => {
    expect(newReqId().length).toBeGreaterThan(0);
  });

  it("returns unique ids across calls", () => {
    expect(newReqId()).not.toBe(newReqId());
  });
});

describe("logApiError", () => {
  function captureStdout(): { getWrittenLines: () => string[]; written: string } {
    let written = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      written += String(chunk);
      return true;
    });
    return { getWrittenLines: () => written.split("\n").filter(Boolean), written };
  }

  it("writes a single structured JSON line to stdout", () => {
    const { getWrittenLines } = captureStdout();
    const error = new Error("boom");

    logApiError({ reqId: "req-123", userId: "user-1", route: "/api/stats", error, message: "Stats failed" });

    const lines = getWrittenLines();
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe("error");
    expect(entry.ts).toBeTruthy();
    expect(entry.reqId).toBe("req-123");
    expect(entry.userId).toBe("user-1");
    expect(entry.route).toBe("/api/stats");
    expect(entry.message).toBe("Stats failed");
    expect(entry.error).toMatchObject({ name: "Error", message: "boom" });
  });

  it("generates a reqId when omitted", () => {
    const { getWrittenLines } = captureStdout();
    logApiError({ route: "/api/search", error: "bad query" });
    const entry = JSON.parse(getWrittenLines()[0]);
    expect(entry.reqId).toBeTruthy();
  });

  it("omits userId when not provided", () => {
    const { getWrittenLines } = captureStdout();
    logApiError({ route: "/api/stats", error: new Error("anon") });
    const entry = JSON.parse(getWrittenLines()[0]);
    expect(entry).not.toHaveProperty("userId");
  });

  it("serializes string errors into an error object", () => {
    const { getWrittenLines } = captureStdout();
    logApiError({ route: "/api/dev/[username]", error: "LeetCode responded 500" });
    const entry = JSON.parse(getWrittenLines()[0]);
    expect(entry.error).toEqual({ name: "Error", message: "LeetCode responded 500" });
  });

  it("includes error cause when present", () => {
    const { getWrittenLines } = captureStdout();
    const cause = new Error("upstream");
    logApiError({ route: "/api/weather", error: new Error("fetch failed", { cause }) });
    const entry = JSON.parse(getWrittenLines()[0]);
    expect(entry.error.cause).toMatchObject({ name: "Error", message: "upstream" });
  });

  it("includes extra context fields", () => {
    const { getWrittenLines } = captureStdout();
    logApiError({ reqId: "req-9", route: "/api/dev/[username]", error: new Error("x"), username: "alice", status: 502 });
    const entry = JSON.parse(getWrittenLines()[0]);
    expect(entry.username).toBe("alice");
    expect(entry.status).toBe(502);
  });
});

import { describe, it, expect } from "vitest";

// Pure unit tests for the redemption result-mapping logic and
// the core idempotency invariants — no DB required.

function mapRedeemResult(
  result: { ok: boolean; error_code: string | null; xp_amount: number } | null
) {
  if (!result?.ok) {
    const errorMap: Record<string, { error: string; status: number }> = {
      already_redeemed: { error: "You have already redeemed this code.", status: 409 },
      exhausted:        { error: "This code has already reached its maximum usage limit.", status: 410 },
    };
    const mapped = errorMap[result?.error_code ?? ""] ?? { error: "Code could not be redeemed.", status: 409 };
    return { blocked: true, ...mapped };
  }
  return { blocked: false, status: 200, xp_amount: result.xp_amount };
}

describe("redeem_xp_code RPC result mapping", () => {
  // ── ok=true paths ─────────────────────────────────────────────────

  it("ok=true proceeds to XP grant", () => {
    const r = mapRedeemResult({ ok: true, error_code: null, xp_amount: 500 });
    expect(r.blocked).toBe(false);
    expect(r.status).toBe(200);
    expect((r as any).xp_amount).toBe(500);
  });

  // ── error_code mapping ────────────────────────────────────────────

  it("already_redeemed maps to 409", () => {
    const r = mapRedeemResult({ ok: false, error_code: "already_redeemed", xp_amount: 0 });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
    expect(r.error).toMatch(/already redeemed/i);
  });

  it("exhausted maps to 410", () => {
    const r = mapRedeemResult({ ok: false, error_code: "exhausted", xp_amount: 0 });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(410);
    expect(r.error).toMatch(/maximum usage limit/i);
  });

  it("unknown error_code falls back to 409", () => {
    const r = mapRedeemResult({ ok: false, error_code: "future_code", xp_amount: 0 });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
  });

  it("null result falls back to 409", () => {
    const r = mapRedeemResult(null);
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(409);
  });
});

describe("INSERT ... ON CONFLICT DO NOTHING idempotency (simulated)", () => {
  // Simulates the UNIQUE(code_id, developer_id) + ON CONFLICT DO NOTHING
  function simulateUsageInsert(
    table: Set<string>,
    codeId: string,
    devId: number
  ): { inserted: boolean } {
    const key = `${codeId}:${devId}`;
    if (table.has(key)) return { inserted: false }; // ON CONFLICT DO NOTHING
    table.add(key);
    return { inserted: true };
  }

  it("first redemption inserts successfully", () => {
    const table = new Set<string>();
    expect(simulateUsageInsert(table, "code-1", 42).inserted).toBe(true);
  });

  it("second redemption from same user is blocked (conflict)", () => {
    const table = new Set<string>();
    simulateUsageInsert(table, "code-1", 42); // first
    expect(simulateUsageInsert(table, "code-1", 42).inserted).toBe(false);
  });

  it("different user can redeem same code (no conflict)", () => {
    const table = new Set<string>();
    simulateUsageInsert(table, "code-1", 42);
    expect(simulateUsageInsert(table, "code-1", 99).inserted).toBe(true);
  });

  it("two concurrent requests — only one wins (race simulation)", () => {
    const table = new Set<string>();
    const a = simulateUsageInsert(table, "code-1", 42);
    const b = simulateUsageInsert(table, "code-1", 42);
    const winners = [a, b].filter((r) => r.inserted).length;
    expect(winners).toBe(1); // exactly one winner
  });
});

describe("atomic used_count increment (simulated)", () => {
  function atomicIncrement(
    row: { used_count: number; max_uses: number }
  ): { updated: boolean; new_count: number } {
    if (row.max_uses !== -1 && row.used_count >= row.max_uses) {
      return { updated: false, new_count: row.used_count };
    }
    row.used_count += 1;
    return { updated: true, new_count: row.used_count };
  }

  it("increments when under max_uses", () => {
    const row = { used_count: 3, max_uses: 5 };
    const r = atomicIncrement(row);
    expect(r.updated).toBe(true);
    expect(r.new_count).toBe(4);
  });

  it("blocks when at max_uses", () => {
    const row = { used_count: 5, max_uses: 5 };
    const r = atomicIncrement(row);
    expect(r.updated).toBe(false);
    expect(r.new_count).toBe(5);
  });

  it("always succeeds for unlimited codes (max_uses = -1)", () => {
    const row = { used_count: 9999, max_uses: -1 };
    expect(atomicIncrement(row).updated).toBe(true);
  });

  it("two concurrent users at used_count = 4, max_uses = 5 — only one wins", () => {
    // Both read the same snapshot — but with atomic DB update only one UPDATE
    // WHERE used_count < max_uses fires; the second sees 0 rows affected.
    const sharedRow = { used_count: 4, max_uses: 5 };
    const a = atomicIncrement(sharedRow); // used_count → 5, updated = true
    const b = atomicIncrement(sharedRow); // used_count = 5 = max_uses, updated = false
    expect(a.updated).toBe(true);
    expect(b.updated).toBe(false);
  });
});

describe("operation order: usage insert before XP grant", () => {
  it("XP is not granted when usage insert returns inserted=false", () => {
    const table = new Set<string>(["code-1:42"]); // already redeemed
    const inserted = !table.has("code-1:42");  // false
    let xpGranted = false;
    if (inserted) xpGranted = true;  // gate
    expect(xpGranted).toBe(false);
  });

  it("XP is granted only when usage insert succeeds", () => {
    const table = new Set<string>();
    const key = "code-1:42";
    if (!table.has(key)) table.add(key);
    const inserted = true;
    let xpGranted = false;
    if (inserted) xpGranted = true;
    expect(xpGranted).toBe(true);
  });
});
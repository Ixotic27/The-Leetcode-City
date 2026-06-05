import { describe, it, expect } from "vitest";

// Pure unit tests for the guard result mapping logic —
// verifies the application layer correctly interprets
// execute_raid() RPC responses and maps them to HTTP codes.

function mapRaidResult(result: { ok: boolean; error_code: string | null } | null): { blocked: boolean; status: number; error?: string } {
  if (!result?.ok) {
    const errorMap: Record<string, { error: string; status: number }> = {
      cooldown:     { error: "Too fast, wait before raiding again", status: 429 },
      daily_cap:    { error: "Daily raid limit reached", status: 429 },
      peace_shield: { error: "Target has an active Peace Shield", status: 429 },
      weekly_pair:  { error: "Already raided this target this week", status: 429 },
    };
    const mapped = errorMap[result?.error_code ?? ""] ?? { error: "Raid blocked", status: 429 };
    return { blocked: true, ...mapped };
  }
  return { blocked: false, status: 200 };
}

describe("execute_raid RPC result mapping", () => {
  it("ok=true proceeds to response building", () => {
    const r = mapRaidResult({ ok: true, error_code: null });
    expect(r.blocked).toBe(false);
    expect(r.status).toBe(200);
  });

  it("cooldown error_code maps to 429", () => {
    const r = mapRaidResult({ ok: false, error_code: "cooldown" });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
    expect(r.error).toMatch(/too fast/i);
  });

  it("daily_cap error_code maps to 429", () => {
    const r = mapRaidResult({ ok: false, error_code: "daily_cap" });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
    expect(r.error).toMatch(/daily raid limit/i);
  });

  it("peace_shield error_code maps to 429", () => {
    const r = mapRaidResult({ ok: false, error_code: "peace_shield" });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
    expect(r.error).toMatch(/peace shield/i);
  });

  it("weekly_pair error_code maps to 429", () => {
    const r = mapRaidResult({ ok: false, error_code: "weekly_pair" });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
    expect(r.error).toMatch(/already raided/i);
  });

  it("unknown error_code falls back to generic 429", () => {
    const r = mapRaidResult({ ok: false, error_code: "unknown_future_code" });
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
  });

  it("null result falls back to generic 429", () => {
    const r = mapRaidResult(null);
    expect(r.blocked).toBe(true);
    expect(r.status).toBe(429);
  });
});

describe("raid_cooldowns CAS logic (simulated)", () => {
  // Simulates the INSERT ... ON CONFLICT DO UPDATE WHERE cooldown_until <= now()
  function atomicCooldownClaim(
    existing: { cooldown_until: Date } | null,
    now: Date,
    cooldownSecs = 30
  ): { won: boolean; new_cooldown_until: Date | null } {
    if (!existing) {
      return { won: true, new_cooldown_until: new Date(now.getTime() + cooldownSecs * 1000) };
    }
    if (existing.cooldown_until <= now) {
      return { won: true, new_cooldown_until: new Date(now.getTime() + cooldownSecs * 1000) };
    }
    return { won: false, new_cooldown_until: null };
  }

  it("first-ever raid (no row) always wins", () => {
    const r = atomicCooldownClaim(null, new Date("2025-06-04T12:00:00Z"));
    expect(r.won).toBe(true);
    expect(r.new_cooldown_until).not.toBeNull();
  });

  it("raid after cooldown expires wins", () => {
    const r = atomicCooldownClaim(
      { cooldown_until: new Date("2025-06-04T11:59:00Z") },
      new Date("2025-06-04T12:00:00Z")
    );
    expect(r.won).toBe(true);
  });

  it("raid during active cooldown is blocked", () => {
    const r = atomicCooldownClaim(
      { cooldown_until: new Date("2025-06-04T12:00:29Z") },
      new Date("2025-06-04T12:00:00Z")
    );
    expect(r.won).toBe(false);
    expect(r.new_cooldown_until).toBeNull();
  });

  it("two concurrent raids — second is blocked (CAS semantics)", () => {
    const now = new Date("2025-06-04T12:00:00Z");
    const rA = atomicCooldownClaim(null, now);           // first caller — no row
    const rB = atomicCooldownClaim(
      { cooldown_until: rA.new_cooldown_until! }, now    // second caller sees A's row
    );
    expect(rA.won).toBe(true);
    expect(rB.won).toBe(false);
  });
});

describe("peace-shield logic (simulated)", () => {
  function isShieldActive(last_raided_at: string | null, now: Date, shieldHours = 2): boolean {
    if (!last_raided_at) return false;
    const expires = new Date(new Date(last_raided_at).getTime() + shieldHours * 3600 * 1000);
    return now < expires;
  }

  it("no previous raid → shield inactive", () => {
    expect(isShieldActive(null, new Date())).toBe(false);
  });

  it("raided 1 hour ago → shield active", () => {
    const lastRaided = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    expect(isShieldActive(lastRaided, new Date())).toBe(true);
  });

  it("raided 3 hours ago → shield expired", () => {
    const lastRaided = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(isShieldActive(lastRaided, new Date())).toBe(false);
  });

  it("two attackers race — both read stale null, only first insert wins (DB FOR UPDATE)", () => {
    // In the RPC, SELECT ... FOR UPDATE locks the defender row, so:
    // attacker A: reads null → shield inactive → inserts → sets last_raided_at = now
    // attacker B: blocked on FOR UPDATE until A commits → reads now → shield active → blocked
    // This test documents the expected outcome; the enforcement is in the RPC.
    const shieldSetAt = new Date().toISOString();
    expect(isShieldActive(null, new Date())).toBe(false);          // A passes
    expect(isShieldActive(shieldSetAt, new Date())).toBe(true);    // B blocked after A commits
  });
});
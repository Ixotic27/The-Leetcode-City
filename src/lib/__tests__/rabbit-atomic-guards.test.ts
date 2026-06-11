import { describe, it, expect } from "vitest";

// Pure unit tests for the rabbit quest concurrency guard logic.
// Tests the application-layer invariants that route.ts enforces:
//   1. Optimistic lock: sighting-5 UPDATE only wins if rabbit_completed = false
//   2. Purchase insert idempotency: ON CONFLICT DO NOTHING semantics
//   3. Progress guard: sightings 1-4 only advance, never regress

// ---------------------------------------------------------------------------
// 1. Optimistic lock — simulates the WHERE rabbit_completed = false UPDATE
// ---------------------------------------------------------------------------

function optimisticCompleteQuest(
  dev: { rabbit_completed: boolean; rabbit_progress: number },
): { rowsAffected: number; newState: typeof dev } {
  if (dev.rabbit_completed) {
    // DB rejects update: WHERE rabbit_completed = false not satisfied
    return { rowsAffected: 0, newState: dev };
  }
  return {
    rowsAffected: 1,
    newState: { rabbit_completed: true, rabbit_progress: 5 },
  };
}

describe("sighting-5 optimistic lock", () => {
  it("first concurrent request wins (rabbit_completed = false)", () => {
    const dev = { rabbit_completed: false, rabbit_progress: 4 };
    const r = optimisticCompleteQuest(dev);
    expect(r.rowsAffected).toBe(1);
    expect(r.newState.rabbit_completed).toBe(true);
  });

  it("second concurrent request is a no-op (rabbit_completed = true)", () => {
    const dev = { rabbit_completed: true, rabbit_progress: 5 };
    const r = optimisticCompleteQuest(dev);
    expect(r.rowsAffected).toBe(0);
    expect(r.newState.rabbit_completed).toBe(true); // unchanged
  });

  it("two concurrent requests — only first grants the item", () => {
    const sharedDev = { rabbit_completed: false, rabbit_progress: 4 };

    const rA = optimisticCompleteQuest({ ...sharedDev });
    const stateAfterA = rA.newState;
    const rB = optimisticCompleteQuest({ ...stateAfterA });

    expect(rA.rowsAffected).toBe(1); // A wins
    expect(rB.rowsAffected).toBe(0); // B is blocked
  });
});

// ---------------------------------------------------------------------------
// 2. Purchase insert idempotency — ON CONFLICT DO NOTHING semantics
// ---------------------------------------------------------------------------

// Simulates a partial unique index on (developer_id, item_id) WHERE status='completed'
class PurchaseTable {
  private rows: Array<{ developer_id: number; item_id: string; status: string }> = [];

  insertIgnoreDuplicate(row: { developer_id: number; item_id: string; status: string }): { inserted: boolean } {
    const exists = this.rows.some(
      (r) => r.developer_id === row.developer_id && r.item_id === row.item_id && r.status === row.status,
    );
    if (exists) return { inserted: false };
    this.rows.push(row);
    return { inserted: true };
  }

  countAll(developer_id: number, item_id: string, status: string): number {
    return this.rows.filter(
      (r) => r.developer_id === developer_id && r.item_id === item_id && r.status === status,
    ).length;
  }
}

describe("white_rabbit purchase ON CONFLICT DO NOTHING", () => {
  it("single insert succeeds", () => {
    const table = new PurchaseTable();
    const r = table.insertIgnoreDuplicate({ developer_id: 1, item_id: "white_rabbit", status: "completed" });
    expect(r.inserted).toBe(true);
    expect(table.countAll(1, "white_rabbit", "completed")).toBe(1);
  });

  it("duplicate insert is silently ignored", () => {
    const table = new PurchaseTable();
    table.insertIgnoreDuplicate({ developer_id: 1, item_id: "white_rabbit", status: "completed" });
    const r = table.insertIgnoreDuplicate({ developer_id: 1, item_id: "white_rabbit", status: "completed" });
    expect(r.inserted).toBe(false);
    expect(table.countAll(1, "white_rabbit", "completed")).toBe(1); // still only 1 row
  });

  it("two concurrent requests — only one row is inserted", () => {
    const table = new PurchaseTable();
    const purchase = { developer_id: 1, item_id: "white_rabbit", status: "completed" };

    const rA = table.insertIgnoreDuplicate({ ...purchase });
    const rB = table.insertIgnoreDuplicate({ ...purchase });

    expect(rA.inserted !== rB.inserted).toBe(true); // exactly one succeeds
    expect(table.countAll(1, "white_rabbit", "completed")).toBe(1);
  });

  it("different developer_id gets its own row", () => {
    const table = new PurchaseTable();
    table.insertIgnoreDuplicate({ developer_id: 1, item_id: "white_rabbit", status: "completed" });
    const r = table.insertIgnoreDuplicate({ developer_id: 2, item_id: "white_rabbit", status: "completed" });
    expect(r.inserted).toBe(true);
    expect(table.countAll(1, "white_rabbit", "completed")).toBe(1);
    expect(table.countAll(2, "white_rabbit", "completed")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Progress advancement guard — .lt("rabbit_progress", sighting)
// ---------------------------------------------------------------------------

function advanceProgress(
  current: number,
  sighting: number,
): { rowsAffected: number; newProgress: number } {
  // WHERE rabbit_progress < sighting — only advance, never regress
  if (current >= sighting) {
    return { rowsAffected: 0, newProgress: current };
  }
  return { rowsAffected: 1, newProgress: sighting };
}

describe("sightings 1-4 progress guard (.lt)", () => {
  it("advances from 0 to 1", () => {
    const r = advanceProgress(0, 1);
    expect(r.rowsAffected).toBe(1);
    expect(r.newProgress).toBe(1);
  });

  it("advances from 3 to 4", () => {
    const r = advanceProgress(3, 4);
    expect(r.rowsAffected).toBe(1);
    expect(r.newProgress).toBe(4);
  });

  it("does not regress: sighting=2 when progress=3", () => {
    const r = advanceProgress(3, 2);
    expect(r.rowsAffected).toBe(0);
    expect(r.newProgress).toBe(3); // unchanged
  });

  it("does not regress: same value is a no-op", () => {
    const r = advanceProgress(2, 2);
    expect(r.rowsAffected).toBe(0);
    expect(r.newProgress).toBe(2);
  });

  it("two concurrent sighting-1 requests — progress stays at 1", () => {
    let progress = 0;

    const rA = advanceProgress(progress, 1);
    progress = rA.newProgress;           // A commits first
    const rB = advanceProgress(progress, 1); // B runs against committed state

    expect(rA.rowsAffected).toBe(1);
    expect(rB.rowsAffected).toBe(0);
    expect(progress).toBe(1);
  });
});
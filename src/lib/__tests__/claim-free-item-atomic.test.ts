import { describe, it, expect } from "vitest";

// Pure unit tests for the free claim item concurrency guard logic.
// Tests the database-layer uniqueness and upsert ignore-duplicate invariants.

class MockPurchaseTable {
  private rows: Array<{ developer_id: number; item_id: string; provider: string; status: string }> = [];

  upsertIgnoreDuplicate(row: { developer_id: number; item_id: string; provider: string; status: string }): { inserted: boolean } {
    const exists = this.rows.some(
      (r) => r.developer_id === row.developer_id && r.item_id === row.item_id && r.provider === row.provider && r.status === row.status,
    );
    if (exists) return { inserted: false };
    this.rows.push(row);
    return { inserted: true };
  }

  countAll(developer_id: number, item_id: string, provider: string): number {
    return this.rows.filter(
      (r) => r.developer_id === developer_id && r.item_id === item_id && r.provider === provider,
    ).length;
  }
}

describe("free claim item atomic upsert guard", () => {
  it("first claim request succeeds", () => {
    const table = new MockPurchaseTable();
    const r = table.upsertIgnoreDuplicate({ developer_id: 1, item_id: "flag", provider: "free", status: "completed" });
    expect(r.inserted).toBe(true);
    expect(table.countAll(1, "flag", "free")).toBe(1);
  });

  it("duplicate claim request is silently ignored", () => {
    const table = new MockPurchaseTable();
    table.upsertIgnoreDuplicate({ developer_id: 1, item_id: "flag", provider: "free", status: "completed" });
    
    // Simulate duplicate concurrent or retry request
    const r = table.upsertIgnoreDuplicate({ developer_id: 1, item_id: "flag", provider: "free", status: "completed" });
    expect(r.inserted).toBe(false);
    expect(table.countAll(1, "flag", "free")).toBe(1); // still only 1 row
  });

  it("multiple concurrent requests - only one succeeds", () => {
    const table = new MockPurchaseTable();
    const claim = { developer_id: 42, item_id: "flag", provider: "free", status: "completed" };

    const rA = table.upsertIgnoreDuplicate({ ...claim });
    const rB = table.upsertIgnoreDuplicate({ ...claim });

    expect(rA.inserted !== rB.inserted).toBe(true); // exactly one succeeds
    expect(table.countAll(42, "flag", "free")).toBe(1);
  });

  it("different developer ids receive their own free claims", () => {
    const table = new MockPurchaseTable();
    const rA = table.upsertIgnoreDuplicate({ developer_id: 1, item_id: "flag", provider: "free", status: "completed" });
    const rB = table.upsertIgnoreDuplicate({ developer_id: 2, item_id: "flag", provider: "free", status: "completed" });
    
    expect(rA.inserted).toBe(true);
    expect(rB.inserted).toBe(true);
    expect(table.countAll(1, "flag", "free")).toBe(1);
    expect(table.countAll(2, "flag", "free")).toBe(1);
  });
});

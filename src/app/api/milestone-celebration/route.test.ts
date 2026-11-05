import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ row: null as unknown, notify: vi.fn(() => Promise.resolve()) }));

vi.mock("@/lib/notification-senders/community-milestone", () => ({
  sendCommunityMilestoneNotifications: mocks.notify,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) =>
      table === "developers"
        ? { select: () => Promise.resolve({ count: 15_634 }) }
        : { upsert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: mocks.row, error: null }) }) }) },
  }),
}));

const call = (auth = "Bearer s3cret") =>
  POST(new NextRequest("http://localhost/api/milestone-celebration", { method: "POST", headers: { authorization: auth } }));

describe("POST /api/milestone-celebration", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    mocks.notify.mockClear();
  });

  it("rejects callers without the cron secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
  });

  it("records and notifies a newly reached milestone", async () => {
    mocks.row = { milestone: 15000, reached_at: "2026-10-30T00:00:00Z" };
    const res = await call();
    expect(await res.json()).toMatchObject({ celebrated: true, milestone: 15000 });
    expect(mocks.notify).toHaveBeenCalledWith(15000);
  });

  it("does not notify again when the milestone already exists", async () => {
    mocks.row = null;
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ celebrated: false, milestone: 15000 });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from "./route";

type FeedEvent = {
  id: string;
  event_type: string;
  actor_id: number | null;
  target_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const TIMESTAMP = "2026-07-20T12:00:00Z";
const FIRST_ID = "00000000-0000-4000-8000-000000000003";
const SECOND_ID = "00000000-0000-4000-8000-000000000002";
const THIRD_ID = "00000000-0000-4000-8000-000000000001";

function event(id: string): FeedEvent {
  return {
    id,
    event_type: "claim",
    actor_id: null,
    target_id: null,
    metadata: {},
    created_at: TIMESTAMP,
  };
}

function mockFeed({
  pages = [],
  cursor = null,
}: {
  pages?: FeedEvent[][];
  cursor?: { id: string; created_at: string } | null;
}) {
  const order = vi.fn();
  const limit = vi.fn();
  const or = vi.fn();
  let pageIndex = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "activity_feed") {
      const query = {
        data: [] as FeedEvent[],
        select: () => query,
        order: (...args: Parameters<typeof order>) => {
          order(...args);
          return query;
        },
        limit: (value: number) => {
          limit(value);
          query.data = pages[pageIndex++] ?? [];
          return query;
        },
        gte: () => query,
        eq: () => query,
        or: (filter: string) => {
          or(filter);
          return query;
        },
        maybeSingle: vi.fn().mockResolvedValue({ data: cursor }),
      };
      return query;
    }

    if (table === "developers") {
      const query = {
        data: [],
        select: () => query,
        in: () => query,
      };
      return query;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { limit, or, order };
}

describe("GET /api/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a compound cursor so rows sharing a timestamp continue on the next page", async () => {
    const { limit, or, order } = mockFeed({
      pages: [
        [event(FIRST_ID), event(SECOND_ID), event(THIRD_ID)],
        [event(THIRD_ID)],
      ],
      cursor: { id: SECOND_ID, created_at: TIMESTAMP },
    });

    const firstPage = await GET(new Request("http://localhost/api/feed?limit=2"));
    const secondPage = await GET(new Request(`http://localhost/api/feed?limit=2&before=${SECOND_ID}`));

    await expect(firstPage.json()).resolves.toMatchObject({
      events: [{ id: FIRST_ID }, { id: SECOND_ID }],
      has_more: true,
    });
    await expect(secondPage.json()).resolves.toMatchObject({
      events: [{ id: THIRD_ID }],
      has_more: false,
    });
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(limit).toHaveBeenCalledWith(3);
    expect(or).toHaveBeenCalledWith(
      `created_at.lt.${TIMESTAMP},and(created_at.eq.${TIMESTAMP},id.lt.${SECOND_ID})`,
    );
  });

  it("rejects an invalid cursor before querying Supabase", async () => {
    const response = await GET(new Request("http://localhost/api/feed?before=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 404 when a valid-looking cursor does not exist", async () => {
    mockFeed({ cursor: null });

    const response = await GET(new Request(`http://localhost/api/feed?before=${SECOND_ID}`));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Cursor not found." });
  });

  it("sets has_more only when an extra row exists", async () => {
    const { limit } = mockFeed({
      pages: [
        [event(FIRST_ID), event(SECOND_ID)],
        [event(FIRST_ID), event(SECOND_ID), event(THIRD_ID)],
      ],
    });

    const exactPage = await GET(new Request("http://localhost/api/feed?limit=2"));
    const extraPage = await GET(new Request("http://localhost/api/feed?limit=2"));

    await expect(exactPage.json()).resolves.toMatchObject({ has_more: false });
    await expect(extraPage.json()).resolves.toMatchObject({
      events: [{ id: FIRST_ID }, { id: SECOND_ID }],
      has_more: true,
    });
    expect(limit).toHaveBeenCalledTimes(2);
  });
});

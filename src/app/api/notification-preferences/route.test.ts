import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

// Mock supabase-server getUser
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock admin client
const mockFrom = vi.fn();
const mockAdminObj = {
  from: mockFrom,
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => mockAdminObj),
}));

describe("/api/notification-preferences route", () => {
  let developersResponse: any;
  let prefsResponse: any;
  let upsertResult: any;
  let lastUpsertArgs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    developersResponse = { data: { id: 42 } };
    prefsResponse = { data: null };
    upsertResult = { data: { developer_id: 42, email_enabled: false }, error: null };
    lastUpsertArgs = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => developersResponse,
            }),
          }),
        };
      }

      if (table === "notification_preferences") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => prefsResponse,
            }),
          }),
          upsert: (payload: any, opts: any) => {
            lastUpsertArgs = { payload, opts };
            return {
              select: () => ({
                single: async () => upsertResult,
              }),
            };
          },
        };
      }

      return {} as any;
    });
  });

  // GET handler tests
  it("returns default preferences when no prefs record exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "TestUser" } } } });
    developersResponse = { data: { id: 7 } };
    prefsResponse = { data: null };

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.email_enabled).toBe(true);
    expect(json.transactional).toBe(true);
    expect(json.digest_frequency).toBe("realtime");
  });

  it("returns 401 when not authenticated (GET)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 404 when developer not found (GET)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Nobody" } } } });
    developersResponse = { data: null };

    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Developer not found");
  });

  it("returns defaults when preferences select returns an error or null (GET database failure)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "TestUser" } } } });
    developersResponse = { data: { id: 9 } };
    prefsResponse = { data: null, error: { message: "boom" } };

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    // Should still return defaults
    expect(json.email_enabled).toBe(true);
    expect(json.transactional).toBe(true);
  });

  // PATCH handler tests
  it("rejects invalid digest_frequency values", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 5 } };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ digest_frequency: "monthly" }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid digest_frequency");
  });

  it("rejects invalid quiet_hours_start values (out of range)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 5 } };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ quiet_hours_start: 24 }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("quiet_hours_start must be 0-23");
  });

  it("rejects invalid quiet_hours_end values (out of range)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 5 } };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ quiet_hours_end: -1 }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("quiet_hours_end must be 0-23");
  });

  it("rejects payloads with no valid update fields", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 5 } };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ transactional: false, unknown_field: true }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No valid fields to update");
  });

  it("does not send transactional in the upsert payload when provided (transactional ignored)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 123 } };
    upsertResult = { data: { developer_id: 123, email_enabled: false }, error: null };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ transactional: false, email_enabled: false }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.developer_id).toBe(123);
    // Ensure transactional was not included in the upsert payload
    expect(lastUpsertArgs).not.toBeNull();
    expect(lastUpsertArgs.payload.transactional).toBeUndefined();
    expect(lastUpsertArgs.payload.email_enabled).toBe(false);
  });

  it("returns 401 when not authenticated (PATCH)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ email_enabled: false }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 404 when developer not found (PATCH)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "X" } } } });
    developersResponse = { data: null };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ email_enabled: false }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Developer not found");
  });

  it("returns 500 when upsert returns an error (PATCH database failure)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 55 } };
    upsertResult = { data: null, error: { message: "upsert failed" } };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ email_enabled: false }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("upsert failed");
  });

  it("performs a successful update and returns updated payload (PATCH)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Tester" } } } });
    developersResponse = { data: { id: 77 } };
    upsertResult = { data: { developer_id: 77, email_enabled: true, updated_at: new Date().toISOString() }, error: null };

    const request = new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ email_enabled: true }),
    });

    const res = await PATCH(request as unknown as Request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.developer_id).toBe(77);
    expect(json.email_enabled).toBe(true);
  });
});

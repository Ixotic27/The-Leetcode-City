import { describe, it, expect, beforeEach, vi } from "vitest";

const { authUser, mockGetUser, mockFrom } = vi.hoisted(() => ({
  authUser: { id: "user-1" },
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { GET, PUT, DELETE } from "../route";

describe("POST /api/profile/bio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: authUser } });

    mockFrom.mockImplementation((table: string) => {
      if (table !== "developers") throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { bio: "Safe bio" }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { bio: "Updated bio" }, error: null }),
            }),
          }),
        }),
      };
    });
  });

  describe("GET - Retrieve bio", () => {
    it("should return user's current bio", async () => {
      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.bio).toBeDefined();
    });

    it("should return empty string if no bio", async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { bio: null }, error: null }),
          }),
        }),
      }));

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.bio).toBe("");
    });

    it("should return 401 if not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await GET();

      expect(response.status).toBe(401);
    });
  });

  describe("PUT - Update bio with sanitization", () => {
    it("should sanitize HTML tags before saving", async () => {
      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: JSON.stringify({ bio: "Hello <script>alert(1)</script> World" }),
      });

      const response = await PUT(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toContain("successfully");
    });

    it("should enforce 500 character limit", async () => {
      const longBio = "x".repeat(600);

      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: JSON.stringify({ bio: longBio }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });

    it("should reject invalid JSON", async () => {
      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: "not json",
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid JSON");
    });

    it("should reject non-string bio", async () => {
      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: JSON.stringify({ bio: 123 }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("string");
    });

    it("should handle database errors", async () => {
      mockFrom.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      }));

      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: JSON.stringify({ bio: "Test bio" }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toContain("Failed to update bio");
    });

    it("should return 401 if not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const request = new Request("http://localhost/api/profile/bio", {
        method: "PUT",
        body: JSON.stringify({ bio: "Test" }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE - Clear bio", () => {
    it("should clear user's bio", async () => {
      const response = await DELETE();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.message).toContain("successfully");
    });

    it("should return 401 if not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await DELETE();

      expect(response.status).toBe(401);
    });
  });
});

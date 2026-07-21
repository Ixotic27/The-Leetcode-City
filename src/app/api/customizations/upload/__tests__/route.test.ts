import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they are available inside vi.mock calls
const { mockSharp, mockRotate, mockWithMetadata, mockToBuffer } = vi.hoisted(() => {
  const rotate = vi.fn().mockReturnThis();
  const withMetadata = vi.fn().mockReturnThis();
  const toBuffer = vi.fn().mockResolvedValue(Buffer.from("processed-image-bytes"));
  const sharpInstance = vi.fn(() => ({
    rotate,
    withMetadata,
    toBuffer,
  }));
  return {
    mockSharp: sharpInstance,
    mockRotate: rotate,
    mockWithMetadata: withMetadata,
    mockToBuffer: toBuffer,
  };
});

vi.mock("sharp", () => ({
  default: mockSharp,
}));

import { POST } from "../route";

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
const mockListBuckets = vi.fn();
const mockCreateBucket = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

const mockAdminObj = {
  from: mockFrom,
  storage: {
    listBuckets: mockListBuckets,
    createBucket: mockCreateBucket,
    from: vi.fn(() => ({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })),
  },
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => mockAdminObj),
}));

describe("POST /api/customizations/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockListBuckets.mockResolvedValue({ data: [{ name: "billboards" }] });
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/test.jpg" } });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request("http://localhost/api/customizations/upload", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 if developer not found or unclaimed", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null }),
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any;
    });

    const req = new Request("http://localhost/api/customizations/upload", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("successfully processes image with sharp and uploads to storage", async () => {
    // Mock developer lookup
    const mockDev = { id: "dev-456", github_login: "testdev", claimed: true, claimed_by: "user-123" };
    // Mock purchase lookup for 1 billboard
    const mockPurchaseCount = { count: 1 };
    // Mock existing config
    const mockConfig = { data: null };

    // To mock the builder chain correctly for purchases:
    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockDev }),
        };
      }
      if (table === "purchases") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
        };
        // resolve to mockPurchaseCount on await or then
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chain.then = (onfulfilled: any) => Promise.resolve(onfulfilled(mockPurchaseCount));
        return chain;
      }
      if (table === "developer_customizations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(mockConfig),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any;
    });

    // Create a 12-byte buffer representing a JPEG (FF D8 FF ...)
    const jpegHeader = Buffer.alloc(12);
    jpegHeader[0] = 0xff;
    jpegHeader[1] = 0xd8;
    jpegHeader[2] = 0xff;
    const jpegBlob = new Blob([jpegHeader], { type: "image/jpeg" });
    const jpegFile = new File([jpegBlob], "test.jpg", { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("file", jpegFile);
    formData.append("slot_index", "0");

    const req = new Request("http://localhost/api/customizations/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify sharp was called to sanitize image metadata
    expect(mockSharp).toHaveBeenCalled();
    expect(mockRotate).toHaveBeenCalled();
    expect(mockWithMetadata).toHaveBeenCalledWith({});
    expect(mockToBuffer).toHaveBeenCalled();

    // Verify upload was called with the processed-image-bytes Buffer
    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });
});

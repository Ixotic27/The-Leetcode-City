import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoadCityData = vi.fn();

vi.mock("@/services/cityService", () => ({
  CityService: class {
    loadCityData = mockLoadCityData;
  },
}));

import { GET } from "./route";

describe("GET /api/city", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty and inverted pagination windows", async () => {
    const emptyResponse = await GET(
      new Request("http://localhost/api/city?from=5&to=5"),
    );
    const invertedResponse = await GET(
      new Request("http://localhost/api/city?from=6&to=5"),
    );

    expect(emptyResponse.status).toBe(400);
    expect(invertedResponse.status).toBe(400);
    expect(mockLoadCityData).not.toHaveBeenCalled();
  });

  it("propagates service failures without allowing them to be cached", async () => {
    mockLoadCityData.mockResolvedValue({
      status: 500,
      headers: { "Cache-Control": "no-store" },
      body: { error: "Failed to load city data" },
    });

    const response = await GET(
      new Request("http://localhost/api/city?from=0&to=50"),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load city data",
    });
  });
});

import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("/api/github/[username] validation", () => {
  it("redirects valid usernames to /api/dev", async () => {
    const response = await GET(
      new Request("https://theleetcodecity.tech/api/github/rajdeep"),
      { params: Promise.resolve({ username: "rajdeep" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://theleetcodecity.tech/api/dev/rajdeep",
    );
  });

  it("returns 400 with field-level errors for invalid usernames", async () => {
    const response = await GET(
      new Request("https://theleetcodecity.tech/api/github/bad%20name"),
      { params: Promise.resolve({ username: "bad name" }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      error: "Validation failed",
      details: [
        expect.objectContaining({
          field: "params.username",
        }),
      ],
    });
  });
});

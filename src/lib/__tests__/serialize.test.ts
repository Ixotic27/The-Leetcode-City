import { describe, it, expect } from "vitest";
import { serializeDeveloper } from "../serialize";

describe("serializeDeveloper", () => {
  it("should keep vital fields", () => {
    const dev = {
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
    };
    const serialized = serializeDeveloper(dev);
    expect(serialized).toEqual(dev);
  });

  it("should strip null and undefined fields", () => {
    const dev = {
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
      name: null,
      avatar_url: undefined,
    };
    const serialized = serializeDeveloper(dev);
    expect(serialized).toEqual({
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
    });
  });

  it("should strip default/empty array fields", () => {
    const dev = {
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
      owned_items: [],
      achievements: [],
    };
    const serialized = serializeDeveloper(dev);
    expect(serialized).toEqual({
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
    });
  });

  it("should keep custom styles if they differ from default", () => {
    const dev = {
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
      building_style: "bungalow",
      custom_color: "#ff0000",
    };
    const serialized = serializeDeveloper(dev);
    expect(serialized).toEqual({
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
      building_style: "bungalow",
      custom_color: "#ff0000",
    });
  });

  it("should strip default loadout and active_raid_tag", () => {
    const dev = {
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
      loadout: { crown: null, roof: null, aura: null, faces: null },
      active_raid_tag: { attacker_login: "", tag_style: "", expires_at: "" },
    };
    const serialized = serializeDeveloper(dev);
    expect(serialized).toEqual({
      id: 123,
      github_login: "test-user",
      contributions: 50,
      total_stars: 10,
      public_repos: 5,
    });
  });
});

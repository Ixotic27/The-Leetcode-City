import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getInitialReducedMotion,
  persistReducedMotion,
  REDUCED_MOTION_STORAGE_KEY,
} from "../reducedMotion";

describe("reducedMotion utility", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      clear: () => {
        store = {};
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      length: 0,
      key: () => null,
    };

    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("window", {
      localStorage: mockLocalStorage,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns stored preference '1' as true", () => {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, "1");
    expect(getInitialReducedMotion()).toBe(true);
  });

  it("returns stored preference '0' as false even if matchMedia is reduce", () => {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, "0");
    vi.stubGlobal("window", {
      localStorage: window.localStorage,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
      })),
    });
    expect(getInitialReducedMotion()).toBe(false);
  });

  it("falls back to matchMedia when no stored key exists", () => {
    vi.stubGlobal("window", {
      localStorage: window.localStorage,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
      })),
    });
    expect(getInitialReducedMotion()).toBe(true);
  });

  it("persists reduced motion preference to localStorage", () => {
    persistReducedMotion(true);
    expect(localStorage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBe("1");

    persistReducedMotion(false);
    expect(localStorage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBe("0");
  });
});
